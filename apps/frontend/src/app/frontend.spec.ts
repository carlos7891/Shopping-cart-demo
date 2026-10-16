import '@angular/compiler';
import { Injector, runInInjectionContext } from '@angular/core';
import {
  CartQuoteBreakdownDto,
  DEFAULT_KATA_RULES_CONFIG,
  DEMO_HIGH_DISCOUNT_RULES_CONFIG,
  MAX_DISCOUNT_CAP_ALERT_MESSAGE,
  OrderConfirmationDto,
  ProductDto
} from '@shopping-cart/shared';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AppComponent } from './app.component';
import { APP_ROUTES } from './app.routes';
import { AdminRulesPageComponent } from './pages/admin/admin-rules-page.component';
import { CheckoutPageComponent } from './pages/checkout/checkout-page.component';
import { EcommerceApiService } from './services/ecommerce-api.service';
import { CartStoreService } from './state/cart-store.service';

const MOCK_PRODUCTS: ProductDto[] = [
  {
    id: 'prod-tech-1',
    name: 'Monitor 4K',
    description: 'Monitor IPS',
    priceCents: 20000,
    priceUsd: 200,
    category: 'Tecnología',
    stock: 2
  },
  {
    id: 'prod-book-1',
    name: 'Clean Architecture',
    description: 'Book',
    priceCents: 5000,
    priceUsd: 50,
    category: 'Libros',
    stock: 5
  }
];

function buildMockQuote(capReached: boolean): CartQuoteBreakdownDto {
  return {
    items: [
      {
        productId: 'prod-tech-1',
        name: 'Monitor 4K',
        category: 'Tecnología',
        unitPriceCents: 20000,
        unitPriceUsd: 200,
        quantity: 1,
        lineSubtotalCents: 20000,
        lineSubtotalUsd: 200
      }
    ],
    originalSubtotalCents: 20000,
    originalSubtotalUsd: 200,
    categoryDiscountCents: 2000,
    categoryDiscountUsd: 20,
    subtotalAfterCategoryCents: 18000,
    volumeDiscountCents: 900,
    volumeDiscountUsd: 9,
    subtotalAfterVolumeCents: 17100,
    couponDiscountCents: capReached ? 5130 : 2565,
    couponDiscountUsd: capReached ? 51.3 : 25.65,
    subtotalAfterCouponCents: capReached ? 11970 : 14535,
    uncappedTotalDiscountCents: capReached ? 8030 : 5465,
    uncappedDiscountPercentage: capReached ? 40.15 : 27.33,
    maxAllowedDiscountCents: 7000,
    maxCapPercentage: 35,
    capReached,
    capAlertMessage: capReached ? MAX_DISCOUNT_CAP_ALERT_MESSAGE : null,
    totalDiscountCents: capReached ? 7000 : 5465,
    totalDiscountUsd: capReached ? 70 : 54.65,
    effectiveDiscountPercentage: capReached ? 35 : 27.33,
    finalTotalCents: capReached ? 13000 : 14535,
    finalTotalUsd: capReached ? 130 : 145.35,
    couponCode: capReached ? 'VIP50' : 'WELCOME2026',
    couponStatus: 'APPLIED',
    steps: []
  };
}

describe('Frontend Angular Suite — Signals Store, API Client, Checkout & Admin Studio (>=80% cov)', () => {
  let apiMock: EcommerceApiService;
  let store: CartStoreService;

  beforeEach(() => {
    apiMock = {
      getProducts: vi.fn().mockResolvedValue(MOCK_PRODUCTS),
      quoteCart: vi.fn().mockResolvedValue(buildMockQuote(false)),
      checkout: vi.fn().mockResolvedValue({
        orderId: 'ORD-TEST01',
        createdAt: '2026-10-15T12:00:00.000Z',
        breakdown: buildMockQuote(false)
      } satisfies OrderConfirmationDto),
      getOrders: vi.fn().mockResolvedValue([]),
      getRulesConfig: vi.fn().mockResolvedValue(DEFAULT_KATA_RULES_CONFIG),
      updateRulesConfig: vi.fn().mockResolvedValue(DEFAULT_KATA_RULES_CONFIG),
      applyPreset: vi.fn().mockResolvedValue(DEMO_HIGH_DISCOUNT_RULES_CONFIG),
      resetDemo: vi.fn().mockResolvedValue({
        products: MOCK_PRODUCTS,
        rules: DEFAULT_KATA_RULES_CONFIG
      })
    } as unknown as EcommerceApiService;

    store = new CartStoreService(apiMock);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('CartStoreService (HU 1, HU 2, HU 3, HU 4 & Edge Cases)', () => {
    it('initializes products, rules and orders from backend', async () => {
      await store.initializeStore();
      expect(store.products().length).toBe(2);
      expect(store.rulesConfig().maxCapPercentage).toBe(35);
      expect(store.loading()).toBe(false);
    });

    it('handles error during initializeStore gracefully', async () => {
      vi.spyOn(apiMock, 'getProducts').mockRejectedValueOnce(new Error('Network down'));
      await store.initializeStore();
      expect(store.errorMessage()).toBe('Network down');
    });

    it('HU 1: adds, decrements and removes items updating immediateSubtotalUsd and preventing stock overflow', async () => {
      await store.initializeStore();

      // Non-existent product
      await store.addToCart('non-existent');
      expect(store.errorMessage()).toContain('Producto no encontrado');

      // Add 1st unit of Monitor ($200, stock 2)
      await store.addToCart('prod-tech-1');
      expect(store.totalItemsCount()).toBe(1);
      expect(store.immediateSubtotalUsd()).toBe(200);

      // Add 2nd unit of Monitor ($400, stock 2)
      await store.addToCart('prod-tech-1');
      expect(store.totalItemsCount()).toBe(2);
      expect(store.immediateSubtotalUsd()).toBe(400);

      // Attempt 3rd unit -> exceeds stock (2)
      await store.addToCart('prod-tech-1');
      expect(store.totalItemsCount()).toBe(2);
      expect(store.errorMessage()).toContain('Has alcanzado el límite de stock disponible');

      // Dismiss modal notification (X button / Entendido)
      store.dismissNotification();
      expect(store.errorMessage()).toBeNull();
      expect(store.infoMessage()).toBeNull();

      // Decrement from 2 -> 1
      await store.decrementFromCart('prod-tech-1');
      expect(store.totalItemsCount()).toBe(1);

      // Decrement from 1 -> 0 (removes key)
      await store.decrementFromCart('prod-tech-1');
      expect(store.totalItemsCount()).toBe(0);
      expect(store.quoteBreakdown()).toBeNull();

      // Decrement when already 0 does nothing
      await store.decrementFromCart('prod-tech-1');

      // Add and remove directly
      await store.addToCart('prod-book-1');
      expect(store.totalItemsCount()).toBe(1);
      await store.removeFromCart('prod-book-1');
      expect(store.totalItemsCount()).toBe(0);
    });

    it('HU 2 & HU 4: applies coupon, updates quote breakdown and activates 35% cap alert signal when capReached is true', async () => {
      await store.initializeStore();
      await store.addToCart('prod-tech-1');

      expect(store.isMaxDiscountCapReached()).toBe(false);
      expect(store.maxDiscountCapBannerText()).toBeNull();

      // Simulate backend returning capReached = true with VIP50
      vi.spyOn(apiMock, 'quoteCart').mockResolvedValueOnce(buildMockQuote(true));
      await store.applyCoupon('  vip50 ');

      expect(store.appliedCouponCode()).toBe('VIP50');
      expect(store.isMaxDiscountCapReached()).toBe(true);
      expect(store.maxDiscountCapBannerText()).toBe(
        '¡Enhorabuena! Has alcanzado el límite máximo de ahorro permitido (35%)'
      );
    });

    it('HU 3: confirms checkout, clears cart and refreshes stock/orders; handles empty cart or checkout failure', async () => {
      await store.initializeStore();

      // Empty cart checkout attempt
      const emptyOrder = await store.confirmCheckout();
      expect(emptyOrder).toBeNull();
      expect(store.errorMessage()).toContain('vacío');

      // Valid checkout
      await store.addToCart('prod-tech-1');
      const order = await store.confirmCheckout();
      expect(order?.orderId).toBe('ORD-TEST01');
      expect(store.totalItemsCount()).toBe(0);
      expect(store.infoMessage()).toContain('ORD-TEST01');

      // Checkout failure
      await store.addToCart('prod-tech-1');
      vi.spyOn(apiMock, 'checkout').mockRejectedValueOnce(new Error('Stock agotado'));
      const failed = await store.confirmCheckout();
      expect(failed).toBeNull();
      expect(store.errorMessage()).toBe('Stock agotado');
    });

    it('manages admin rules, presets and demo reset in CartStoreService', async () => {
      await store.initializeStore();
      await store.saveAdminRules(DEFAULT_KATA_RULES_CONFIG);
      expect(store.infoMessage()).toContain('actualizadas');

      await store.activateRulePreset('DEMO_CAP_35');
      expect(store.rulesConfig().categoryRule.discountPercentage).toBe(25);

      await store.activateRulePreset('OFFICIAL_KATA');
      await store.resetDemoEnvironment();
      expect(store.infoMessage()).toContain('restaurados');
    });
  });

  describe('EcommerceApiService HTTP Client', () => {
    it('executes GET, POST and PUT requests and handles HTTP errors', async () => {
      const realApi = new EcommerceApiService();
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => {
        return {
          ok: true,
          status: 200,
          json: async () => MOCK_PRODUCTS
        } as Response;
      });

      const prods = await realApi.getProducts();
      expect(prods).toEqual(MOCK_PRODUCTS);
      expect(fetchSpy).toHaveBeenCalledTimes(1);

      await realApi.quoteCart({ items: [{ productId: 'p1', quantity: 1 }] });
      await realApi.checkout({ items: [{ productId: 'p1', quantity: 1 }] });
      await realApi.getOrders();
      await realApi.getRulesConfig();
      await realApi.updateRulesConfig(DEFAULT_KATA_RULES_CONFIG);
      await realApi.applyPreset('DEMO_CAP_35');
      await realApi.resetDemo();

      fetchSpy.mockResolvedValueOnce({
        ok: false,
        status: 409,
        json: async () => ({ message: 'Stock insuficiente' })
      } as Response);

      await expect(realApi.getProducts()).rejects.toThrow('Stock insuficiente');
    });
  });

  describe('Angular Standalone Components & Routes (Checkout, Admin Studio & Root)', () => {
    it('instantiates CheckoutPageComponent, AdminRulesPageComponent, AppComponent and APP_ROUTES within DI context', async () => {
      const injector = Injector.create({
        providers: [{ provide: CartStoreService, useValue: store }]
      });

      expect(APP_ROUTES.length).toBeGreaterThanOrEqual(3);

      await runInInjectionContext(injector, async () => {
        const rootComp = new AppComponent();
        expect(rootComp.store).toBe(store);

        const checkoutComp = new CheckoutPageComponent();
        checkoutComp.ngOnInit();
        expect(checkoutComp.store).toBe(store);

        // Verify product image carousel navigation (multi-image and fallback)
        expect(checkoutComp.getProductImages('prod-tech-laptop').length).toBe(3);
        expect(checkoutComp.getCurrentImage('prod-tech-laptop')).toBe('assets/laptop.webp');
        checkoutComp.nextImage('prod-tech-laptop');
        expect(checkoutComp.getCurrentImage('prod-tech-laptop')).toBe('assets/laptop2.webp');
        checkoutComp.prevImage('prod-tech-laptop');
        expect(checkoutComp.getCurrentImage('prod-tech-laptop')).toBe('assets/laptop.webp');
        checkoutComp.selectImage('prod-tech-laptop', 2);
        expect(checkoutComp.getActiveSlideIndex('prod-tech-laptop')).toBe(2);
        expect(checkoutComp.getCurrentImage('unknown-id')).toBe('assets/monitor1.webp');

        const adminComp = new AdminRulesPageComponent();
        await adminComp.ngOnInit();
        expect(adminComp.maxCapPercentage).toBe(35);

        await adminComp.applyPreset('DEMO_CAP_35');
        expect(adminComp.categoryPercentage).toBe(25);

        adminComp.categoryPercentage = 15;
        await adminComp.saveChanges();
        expect(apiMock.updateRulesConfig).toHaveBeenCalled();

        await adminComp.resetFullDemo();
        expect(apiMock.resetDemo).toHaveBeenCalled();
      });
    });
  });
});
