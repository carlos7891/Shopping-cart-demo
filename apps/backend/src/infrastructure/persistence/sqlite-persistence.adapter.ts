import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import {
  CartQuoteBreakdownDto,
  DEFAULT_KATA_RULES_CONFIG,
  DiscountRulesConfigDto,
  OrderConfirmationDto,
  ProductCategory
} from '@shopping-cart/shared';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import initSqlJs, { Database } from 'sql.js';
import {
  OrderRepositoryPort,
  ProductRepositoryPort,
  RuleConfigRepositoryPort
} from '../../application/ports/repositories.ports';
import { ProductEntity } from '../../domain/entities/cart-domain.models';
import { DomainException } from '../../domain/exceptions/domain.exception';
import { Money } from '../../domain/value-objects/money.vo';
import { INITIAL_PRODUCTS_SEED } from './catalog.seed';

/**
 * Adaptador de Persistencia Relacional SQLite ACID (Patrón Adapter / Repository).
 * - Utiliza consultas 100% parametrizadas (prevención de SQL Injection).
 * - Ejecuta el checkout en una transacción SQL atómica (`BEGIN TRANSACTION ... COMMIT / ROLLBACK`)
 *   con restricción `CHECK (stock >= 0)` para impedir sobreventa (overselling).
 */
@Injectable()
export class SqlitePersistenceAdapter
  implements
    ProductRepositoryPort,
    OrderRepositoryPort,
    RuleConfigRepositoryPort,
    OnModuleInit,
    OnModuleDestroy
{
  private db!: Database;
  private readonly dbFilePath: string | null;

  constructor(customDbFilePath?: string | null) {
    if (customDbFilePath !== undefined) {
      this.dbFilePath = customDbFilePath;
    } else if (process.env.NODE_ENV === 'test') {
      this.dbFilePath = null; // En memoria durante pruebas automatizadas
    } else {
      this.dbFilePath = path.resolve(process.cwd(), 'data', 'ecommerce.sqlite');
    }
  }

  public async onModuleInit(): Promise<void> {
    if (this.db) {
      return;
    }
    const SQL = await initSqlJs();

    if (this.dbFilePath && fs.existsSync(this.dbFilePath)) {
      const fileBuffer = fs.readFileSync(this.dbFilePath);
      this.db = new SQL.Database(new Uint8Array(fileBuffer));
    } else {
      this.db = new SQL.Database();
    }

    this.initializeSchemaAndSeed();
  }

  public onModuleDestroy(): void {
    if (this.db) {
      this.db.close();
    }
  }

  public findAll(): ProductEntity[] {
    const stmt = this.db.prepare(
      'SELECT id, name, description, price_cents, category, stock FROM products ORDER BY id ASC'
    );
    const items: ProductEntity[] = [];
    while (stmt.step()) {
      const row = stmt.getAsObject() as {
        id: string;
        name: string;
        description: string;
        price_cents: number;
        category: ProductCategory;
        stock: number;
      };
      items.push({
        id: row.id,
        name: row.name,
        description: row.description,
        price: Money.fromCents(Number(row.price_cents)),
        category: row.category,
        stock: Number(row.stock)
      });
    }
    stmt.free();
    return items;
  }

  public findById(id: string): ProductEntity | null {
    const stmt = this.db.prepare(
      'SELECT id, name, description, price_cents, category, stock FROM products WHERE id = ?'
    );
    stmt.bind([id]);
    let entity: ProductEntity | null = null;
    if (stmt.step()) {
      const row = stmt.getAsObject() as {
        id: string;
        name: string;
        description: string;
        price_cents: number;
        category: ProductCategory;
        stock: number;
      };
      entity = {
        id: row.id,
        name: row.name,
        description: row.description,
        price: Money.fromCents(Number(row.price_cents)),
        category: row.category,
        stock: Number(row.stock)
      };
    }
    stmt.free();
    return entity;
  }

  public resetCatalogSeed(): ProductEntity[] {
    this.db.run('BEGIN TRANSACTION');
    try {
      this.db.run('DELETE FROM products');
      const insertStmt = this.db.prepare(
        'INSERT INTO products (id, name, description, price_cents, category, stock) VALUES (?, ?, ?, ?, ?, ?)'
      );
      for (const item of INITIAL_PRODUCTS_SEED) {
        insertStmt.run([
          item.id,
          item.name,
          item.description,
          item.priceCents,
          item.category,
          item.stock
        ]);
      }
      insertStmt.free();
      this.db.run('COMMIT');
      this.flushToDisk();
    } catch (error) {
      this.db.run('ROLLBACK');
      throw error;
    }
    return this.findAll();
  }

  /**
   * Ejecuta de forma atómica (ACID):
   * 1. Verificación y descuento de stock por cada ítem.
   * 2. Inserción de la cabecera de la orden en `orders`.
   * 3. Inserción de las líneas en `order_items`.
   * Si cualquier ítem falla por stock insuficiente, ejecuta `ROLLBACK` dejando el inventario intacto.
   */
  public createOrderWithStockDeduction(
    breakdown: CartQuoteBreakdownDto
  ): OrderConfirmationDto {
    const orderId = `ORD-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
    const createdAt = new Date().toISOString();

    this.db.run('BEGIN TRANSACTION');
    try {
      for (const line of breakdown.items) {
        const currentProduct = this.findById(line.productId);
        if (!currentProduct) {
          throw new DomainException(
            'PRODUCT_NOT_FOUND',
            `El producto "${line.productId}" no existe.`
          );
        }
        if (currentProduct.stock < line.quantity) {
          throw new DomainException(
            'INSUFFICIENT_STOCK',
            `Stock insuficiente para "${currentProduct.name}". Solicitado: ${line.quantity}, Disponible: ${currentProduct.stock}.`
          );
        }

        const updateStmt = this.db.prepare(
          'UPDATE products SET stock = stock - ? WHERE id = ? AND stock >= ?'
        );
        updateStmt.run([line.quantity, line.productId, line.quantity]);
        updateStmt.free();

        if (this.db.getRowsModified() !== 1) {
          throw new DomainException(
            'INSUFFICIENT_STOCK',
            `No fue posible descontar stock para "${currentProduct.name}" por concurrencia.`
          );
        }
      }

      const insertOrderStmt = this.db.prepare(`
        INSERT INTO orders (
          id, created_at, original_subtotal_cents, total_discount_cents,
          effective_discount_pct, final_total_cents, coupon_code, cap_reached, breakdown_json
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      insertOrderStmt.run([
        orderId,
        createdAt,
        breakdown.originalSubtotalCents,
        breakdown.totalDiscountCents,
        breakdown.effectiveDiscountPercentage,
        breakdown.finalTotalCents,
        breakdown.couponCode,
        breakdown.capReached ? 1 : 0,
        JSON.stringify(breakdown)
      ]);
      insertOrderStmt.free();

      const insertItemStmt = this.db.prepare(`
        INSERT INTO order_items (
          order_id, product_id, product_name, unit_price_cents, quantity, line_subtotal_cents
        ) VALUES (?, ?, ?, ?, ?, ?)
      `);
      for (const line of breakdown.items) {
        insertItemStmt.run([
          orderId,
          line.productId,
          line.name,
          line.unitPriceCents,
          line.quantity,
          line.lineSubtotalCents
        ]);
      }
      insertItemStmt.free();

      this.db.run('COMMIT');
      this.flushToDisk();

      return {
        orderId,
        createdAt,
        breakdown
      };
    } catch (error) {
      this.db.run('ROLLBACK');
      throw error;
    }
  }

  public findAllOrders(): OrderConfirmationDto[] {
    const stmt = this.db.prepare(
      'SELECT id, created_at, breakdown_json FROM orders ORDER BY created_at DESC'
    );
    const orders: OrderConfirmationDto[] = [];
    while (stmt.step()) {
      const row = stmt.getAsObject() as {
        id: string;
        created_at: string;
        breakdown_json: string;
      };
      orders.push({
        orderId: row.id,
        createdAt: row.created_at,
        breakdown: JSON.parse(row.breakdown_json) as CartQuoteBreakdownDto
      });
    }
    stmt.free();
    return orders;
  }

  public findOrderById(orderId: string): OrderConfirmationDto | null {
    const stmt = this.db.prepare(
      'SELECT id, created_at, breakdown_json FROM orders WHERE id = ?'
    );
    stmt.bind([orderId]);
    let found: OrderConfirmationDto | null = null;
    if (stmt.step()) {
      const row = stmt.getAsObject() as {
        id: string;
        created_at: string;
        breakdown_json: string;
      };
      found = {
        orderId: row.id,
        createdAt: row.created_at,
        breakdown: JSON.parse(row.breakdown_json) as CartQuoteBreakdownDto
      };
    }
    stmt.free();
    return found;
  }

  public getRulesConfig(): DiscountRulesConfigDto {
    const stmt = this.db.prepare(
      'SELECT config_json FROM rule_configs WHERE id = 1'
    );
    let config: DiscountRulesConfigDto = DEFAULT_KATA_RULES_CONFIG;
    if (stmt.step()) {
      const row = stmt.getAsObject() as { config_json: string };
      config = JSON.parse(row.config_json) as DiscountRulesConfigDto;
    }
    stmt.free();
    return config;
  }

  public saveRulesConfig(config: DiscountRulesConfigDto): DiscountRulesConfigDto {
    const stmt = this.db.prepare(
      'INSERT OR REPLACE INTO rule_configs (id, config_json, updated_at) VALUES (1, ?, ?)'
    );
    stmt.run([JSON.stringify(config), new Date().toISOString()]);
    stmt.free();
    this.flushToDisk();
    return config;
  }

  private initializeSchemaAndSeed(): void {
    this.db.run(`
      CREATE TABLE IF NOT EXISTS products (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT NOT NULL,
        price_cents INTEGER NOT NULL CHECK (price_cents >= 0),
        category TEXT NOT NULL,
        stock INTEGER NOT NULL CHECK (stock >= 0)
      );

      CREATE TABLE IF NOT EXISTS orders (
        id TEXT PRIMARY KEY,
        created_at TEXT NOT NULL,
        original_subtotal_cents INTEGER NOT NULL,
        total_discount_cents INTEGER NOT NULL,
        effective_discount_pct REAL NOT NULL,
        final_total_cents INTEGER NOT NULL,
        coupon_code TEXT,
        cap_reached INTEGER NOT NULL,
        breakdown_json TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS order_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        order_id TEXT NOT NULL,
        product_id TEXT NOT NULL,
        product_name TEXT NOT NULL,
        unit_price_cents INTEGER NOT NULL,
        quantity INTEGER NOT NULL CHECK (quantity > 0),
        line_subtotal_cents INTEGER NOT NULL,
        FOREIGN KEY (order_id) REFERENCES orders(id)
      );

      CREATE TABLE IF NOT EXISTS rule_configs (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        config_json TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
    `);

    const existingProducts = this.findAll();
    if (existingProducts.length === 0) {
      this.resetCatalogSeed();
    }

    const ruleStmt = this.db.prepare('SELECT id FROM rule_configs WHERE id = 1');
    const hasRuleConfig = ruleStmt.step();
    ruleStmt.free();
    if (!hasRuleConfig) {
      this.saveRulesConfig(DEFAULT_KATA_RULES_CONFIG);
    }
  }

  private flushToDisk(): void {
    if (!this.dbFilePath) {
      return;
    }
    const dir = path.dirname(this.dbFilePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    const binaryData = this.db.export();
    fs.writeFileSync(this.dbFilePath, Buffer.from(binaryData));
  }
}
