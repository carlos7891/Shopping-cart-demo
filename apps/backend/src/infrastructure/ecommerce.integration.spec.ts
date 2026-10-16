import 'reflect-metadata';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import {
  DEFAULT_KATA_RULES_CONFIG,
  MAX_DISCOUNT_CAP_ALERT_MESSAGE
} from '@shopping-cart/shared';
import supertest from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { EcommerceApplicationService } from '../application/ecommerce-application.service';
import {
  ORDER_REPOSITORY_PORT,
  PRODUCT_REPOSITORY_PORT,
  RULE_CONFIG_REPOSITORY_PORT
} from '../application/ports/repositories.ports';
import { AppModule } from './app.module';
import { DomainExceptionFilter } from './http/domain-exception.filter';
import { EcommerceController } from './http/ecommerce.controller';
import { SqlitePersistenceAdapter } from './persistence/sqlite-persistence.adapter';

describe('Backend Integration & ACID SQLite Persistence (HTTP + Application + Infrastructure)', () => {
  let app: INestApplication;
  let sqliteAdapter: SqlitePersistenceAdapter;

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule]
    }).compile();

    app = moduleRef.createNestApplication();
    app.useGlobalFilters(new DomainExceptionFilter());
    await app.init();

    sqliteAdapter = moduleRef.get(SqlitePersistenceAdapter);
  });

  beforeEach(() => {
    sqliteAdapter.resetCatalogSeed();
    sqliteAdapter.saveRulesConfig(DEFAULT_KATA_RULES_CONFIG);
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /api/products returns the seeded catalog with initial stock and cents/USD prices', async () => {
    const res = await supertest(app.getHttpServer()).get('/api/products').expect(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThanOrEqual(6);

    const monitor = res.body.find((p: { id: string }) => p.id === 'prod-tech-monitor');
    expect(monitor).toBeDefined();
    expect(monitor.priceCents).toBe(20000);
    expect(monitor.priceUsd).toBe(200);
    expect(monitor.stock).toBe(8);
  });

  it('POST /api/cart/quote calculates cascade discounts without deducting stock', async () => {
    const res = await supertest(app.getHttpServer())
      .post('/api/cart/quote')
      .send({
        items: [{ productId: 'prod-tech-monitor', quantity: 1 }],
        couponCode: 'WELCOME2026'
      })
      .expect(200);

    expect(res.body.originalSubtotalCents).toBe(20000);
    expect(res.body.categoryDiscountCents).toBe(2000);
    expect(res.body.volumeDiscountCents).toBe(900);
    expect(res.body.couponDiscountCents).toBe(2565);
    expect(res.body.finalTotalCents).toBe(14535);
    expect(res.body.capReached).toBe(false);

    // Stock remains 8
    const afterProduct = sqliteAdapter.findById('prod-tech-monitor');
    expect(afterProduct?.stock).toBe(8);
  });

  it('POST /api/checkout persists order in SQLite, deducts stock atomically and retrieves order via GET /api/orders/:id (HU 3)', async () => {
    const checkoutRes = await supertest(app.getHttpServer())
      .post('/api/checkout')
      .send({
        items: [{ productId: 'prod-tech-monitor', quantity: 2 }],
        couponCode: 'WELCOME2026'
      })
      .expect(201);

    expect(checkoutRes.body.orderId).toMatch(/^ORD-/);
    expect(checkoutRes.body.breakdown.originalSubtotalCents).toBe(40000);
    expect(checkoutRes.body.breakdown.finalTotalCents).toBe(29070);

    // Verify stock was decremented from 8 to 6
    const updatedMonitor = sqliteAdapter.findById('prod-tech-monitor');
    expect(updatedMonitor?.stock).toBe(6);

    // Verify order persistence via GET /api/orders/:id and GET /api/orders
    const orderId = checkoutRes.body.orderId as string;
    const orderGet = await supertest(app.getHttpServer())
      .get(`/api/orders/${orderId}`)
      .expect(200);
    expect(orderGet.body.orderId).toBe(orderId);

    const allOrders = await supertest(app.getHttpServer()).get('/api/orders').expect(200);
    expect(allOrders.body.length).toBeGreaterThanOrEqual(1);
  });

  it('Edge Case: Rejects checkout with 409 INSUFFICIENT_STOCK and rolls back any partial stock changes (ACID Atomicity)', async () => {
    // Monitor has stock 8, Laptop has stock 5. Request 2 Monitors (valid) and 99 Laptops (invalid)
    const res = await supertest(app.getHttpServer())
      .post('/api/checkout')
      .send({
        items: [
          { productId: 'prod-tech-monitor', quantity: 2 },
          { productId: 'prod-tech-laptop', quantity: 99 }
        ]
      })
      .expect(409);

    expect(res.body.errorCode).toBe('INSUFFICIENT_STOCK');

    // Monitor stock MUST still be 8 (no partial deduction!)
    expect(sqliteAdapter.findById('prod-tech-monitor')?.stock).toBe(8);
    expect(sqliteAdapter.findById('prod-tech-laptop')?.stock).toBe(5);
  });

  it('Edge Case: Rejects empty cart (422), corrupt payload / price tampering (400), and non-existent product (404)', async () => {
    const emptyRes = await supertest(app.getHttpServer())
      .post('/api/cart/quote')
      .send({ items: [] })
      .expect(422);
    expect(emptyRes.body.errorCode).toBe('EMPTY_CART');

    const tamperRes = await supertest(app.getHttpServer())
      .post('/api/checkout')
      .send({
        items: [{ productId: 'prod-tech-monitor', quantity: 1, priceCents: 1 }]
      })
      .expect(400);
    expect(tamperRes.body.errorCode).toBe('INVALID_CART_PAYLOAD');

    const notFoundRes = await supertest(app.getHttpServer())
      .post('/api/checkout')
      .send({
        items: [{ productId: 'prod-non-existent', quantity: 1 }]
      })
      .expect(404);
    expect(notFoundRes.body.errorCode).toBe('PRODUCT_NOT_FOUND');

    await supertest(app.getHttpServer()).get('/api/orders/ORD-DOES-NOT-EXIST').expect(404);
  });

  it('Admin Rule Engine Studio (/api/admin/rules & presets) dynamically updates rules and triggers 35% cap alert (HU 4)', async () => {
    const currentRules = await supertest(app.getHttpServer())
      .get('/api/admin/rules')
      .expect(200);
    expect(currentRules.body.maxCapPercentage).toBe(35);

    // Switch to DEMO_CAP_35 preset
    const presetRes = await supertest(app.getHttpServer())
      .post('/api/admin/rules/preset')
      .send({ preset: 'DEMO_CAP_35' })
      .expect(200);
    expect(presetRes.body.categoryRule.discountPercentage).toBe(25);

    // Quote with WELCOME2026 now exceeds 35% and gets truncated at 35%
    const quoteRes = await supertest(app.getHttpServer())
      .post('/api/cart/quote')
      .send({
        items: [{ productId: 'prod-tech-monitor', quantity: 1 }],
        couponCode: 'WELCOME2026'
      })
      .expect(200);

    expect(quoteRes.body.capReached).toBe(true);
    expect(quoteRes.body.effectiveDiscountPercentage).toBe(35);
    expect(quoteRes.body.capAlertMessage).toBe(MAX_DISCOUNT_CAP_ALERT_MESSAGE);

    // Update custom rules via PUT /api/admin/rules
    await supertest(app.getHttpServer())
      .put('/api/admin/rules')
      .send(DEFAULT_KATA_RULES_CONFIG)
      .expect(200);

    // Invalid rule update returns 400
    await supertest(app.getHttpServer())
      .put('/api/admin/rules')
      .send({ invalid: true })
      .expect(400);

    // Reset demo endpoint restores catalog and rules
    const resetRes = await supertest(app.getHttpServer())
      .post('/api/admin/reset-demo')
      .expect(200);
    expect(resetRes.body.products.length).toBeGreaterThanOrEqual(6);
  });

  it('Direct controller & adapter edge cases (transaction rollback on mid-transaction stock race condition)', () => {
    // Direct test of createOrderWithStockDeduction rollback if stock becomes insufficient right inside the transaction
    const quote = new EcommerceApplicationService(
      sqliteAdapter,
      sqliteAdapter,
      sqliteAdapter
    ).quoteCart({
      items: [
        { productId: 'prod-tech-monitor', quantity: 2 },
        { productId: 'prod-tech-laptop', quantity: 5 }
      ]
    });

    // Simulate concurrent purchase depleting laptop stock before transaction commits
    const laptopQuote = new EcommerceApplicationService(
      sqliteAdapter,
      sqliteAdapter,
      sqliteAdapter
    ).quoteCart({
      items: [{ productId: 'prod-tech-laptop', quantity: 2 }]
    });
    sqliteAdapter.createOrderWithStockDeduction(laptopQuote);
    expect(sqliteAdapter.findById('prod-tech-laptop')?.stock).toBe(3);

    // Now attempting to commit the first quote (needs 5 laptops, only 3 left) must throw and rollback monitor stock deduction!
    expect(() => sqliteAdapter.createOrderWithStockDeduction(quote)).toThrow();
    expect(sqliteAdapter.findById('prod-tech-monitor')?.stock).toBe(8);

    // Verify controller instantiation and port tokens
    expect(PRODUCT_REPOSITORY_PORT).toBeDefined();
    expect(ORDER_REPOSITORY_PORT).toBeDefined();
    expect(RULE_CONFIG_REPOSITORY_PORT).toBeDefined();
    const ctrl = app.get(EcommerceController);
    expect(ctrl).toBeDefined();
  });
});
