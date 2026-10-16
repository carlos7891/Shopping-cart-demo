import {
  DEFAULT_KATA_RULES_CONFIG,
  DEMO_HIGH_DISCOUNT_RULES_CONFIG,
  DiscountRulesConfigDto,
  MAX_DISCOUNT_CAP_ALERT_MESSAGE
} from '@shopping-cart/shared';
import { describe, expect, it } from 'vitest';
import { CartLineDomainItem, ProductEntity } from '../entities/cart-domain.models';
import { DomainException } from '../exceptions/domain.exception';
import { Money } from '../value-objects/money.vo';
import { CumulativeDiscountEngine } from './cumulative-discount.engine';
import { MaxDiscountCapPolicy } from './max-discount-cap.policy';

function makeProduct(
  id: string,
  name: string,
  priceCents: number,
  category: ProductEntity['category'],
  stock = 10
): ProductEntity {
  return {
    id,
    name,
    description: `${name} desc`,
    price: Money.fromCents(priceCents),
    category,
    stock
  };
}

function makeCartLine(product: ProductEntity, quantity: number): CartLineDomainItem {
  return {
    product,
    quantity,
    lineSubtotal: product.price.multiplyByQuantity(quantity)
  };
}

describe('Domain Layer — Money VO & CumulativeDiscountEngine (Cascade & 35% Cap)', () => {
  const engine = new CumulativeDiscountEngine();
  const evaluationTime = new Date('2026-10-15T12:00:00.000Z');

  describe('Money Value Object', () => {
    it('creates money from cents and USD without IEEE-754 floating point drift', () => {
      const a = Money.fromUsd(0.1);
      const b = Money.fromUsd(0.2);
      const sum = a.add(b);
      expect(sum.cents).toBe(30);
      expect(sum.usd).toBe(0.3);
      expect(sum.equals(Money.fromCents(30))).toBe(true);
    });

    it('rejects negative, NaN, infinite or non-integer cents', () => {
      expect(() => Money.fromCents(-1)).toThrow();
      expect(() => Money.fromCents(12.34)).toThrow();
      expect(() => Money.fromUsd(-5)).toThrow();
      expect(() => Money.fromCents(100).multiplyByQuantity(0)).toThrow();
      expect(() => Money.fromCents(100).allocatePercentage(105)).toThrow();
    });

    it('subtracts safely clamping at zero', () => {
      const a = Money.fromCents(50);
      const b = Money.fromCents(100);
      expect(a.subtract(b).cents).toBe(0);
    });
  });

  describe('Cascade Precedence & Multiplicative Math (Not Additive)', () => {
    it('applies 10% Category -> 5% Volume -> 15% Coupon sequentially in cascade (BVA-04)', () => {
      // Producto Tecnología de $200.00 (20000 centavos)
      // Si fuera aditivo (ERROR común de IA): 10% + 5% + 15% = 30% -> $60.00 descuento -> $140.00 final
      // En cascada real:
      // 1. Categoría (10% de $200.00) = $20.00 -> Subtotal 1 = $180.00
      // 2. Volumen (>$100, 5% de $180.00) = $9.00 -> Subtotal 2 = $171.00
      // 3. Cupón WELCOME2026 (15% de $171.00) = $25.65 -> Subtotal 3 = $145.35
      // Total Descuento = $20 + $9 + $25.65 = $54.65 (27.33%), Final = $145.35
      const laptop = makeProduct('tech-1', 'Monitor Pro', 20000, 'Tecnología');
      const result = engine.calculate({
        items: [makeCartLine(laptop, 1)],
        couponCode: 'WELCOME2026',
        rulesConfig: DEFAULT_KATA_RULES_CONFIG,
        evaluationTime
      });

      expect(result.originalSubtotalCents).toBe(20000);
      expect(result.categoryDiscountCents).toBe(2000);
      expect(result.subtotalAfterCategoryCents).toBe(18000);
      expect(result.volumeDiscountCents).toBe(900);
      expect(result.subtotalAfterVolumeCents).toBe(17100);
      expect(result.couponDiscountCents).toBe(2565);
      expect(result.subtotalAfterCouponCents).toBe(14535);
      expect(result.totalDiscountCents).toBe(5465);
      expect(result.effectiveDiscountPercentage).toBe(27.33);
      expect(result.finalTotalCents).toBe(14535);
      expect(result.capReached).toBe(false);
      expect(result.capAlertMessage).toBeNull();
    });

    it('applies Category discount ONLY to Tecnología items in a mixed cart', () => {
      const mouseTech = makeProduct('tech-2', 'Mouse Gamer', 10000, 'Tecnología'); // $100
      const deskHome = makeProduct('home-1', 'Silla Ergonómica', 10000, 'Hogar'); // $100
      // Subtotal original: $200.00
      // 1. Categoría: 10% solo sobre $100 (Tecnología) = $10.00 -> Subtotal 1 = $190.00
      // 2. Volumen: Subtotal 1 ($190) > $100 -> 5% sobre TODO el carrito ($190) = $9.50 -> Subtotal 2 = $180.50
      const result = engine.calculate({
        items: [makeCartLine(mouseTech, 1), makeCartLine(deskHome, 1)],
        rulesConfig: DEFAULT_KATA_RULES_CONFIG,
        evaluationTime
      });

      expect(result.originalSubtotalCents).toBe(20000);
      expect(result.categoryDiscountCents).toBe(1000);
      expect(result.subtotalAfterCategoryCents).toBe(19000);
      expect(result.volumeDiscountCents).toBe(950);
      expect(result.finalTotalCents).toBe(18050);
    });
  });

  describe('Boundary Value Analysis — Volume Threshold ($100.00 vs $100.01)', () => {
    it('does NOT apply volume discount when subtotal after category is exactly $100.00 (BVA-02)', () => {
      const chair = makeProduct('home-2', 'Mesa Auxiliar', 10000, 'Hogar');
      const result = engine.calculate({
        items: [makeCartLine(chair, 1)],
        rulesConfig: DEFAULT_KATA_RULES_CONFIG,
        evaluationTime
      });

      expect(result.subtotalAfterCategoryCents).toBe(10000);
      expect(result.volumeDiscountCents).toBe(0);
      expect(result.finalTotalCents).toBe(10000);
    });

    it('does NOT apply volume discount if Category discount drops subtotal from $110.00 down to $99.00', () => {
      const headphones = makeProduct('tech-3', 'Audífonos', 11000, 'Tecnología');
      const result = engine.calculate({
        items: [makeCartLine(headphones, 1)],
        rulesConfig: DEFAULT_KATA_RULES_CONFIG,
        evaluationTime
      });

      expect(result.originalSubtotalCents).toBe(11000);
      expect(result.categoryDiscountCents).toBe(1100);
      expect(result.subtotalAfterCategoryCents).toBe(9900); // $99.00 <= $100.00
      expect(result.volumeDiscountCents).toBe(0);
    });

    it('applies volume discount when subtotal after category is $100.01 (BVA-03)', () => {
      const item = makeProduct('home-3', 'Lámpara', 10001, 'Hogar');
      const result = engine.calculate({
        items: [makeCartLine(item, 1)],
        rulesConfig: DEFAULT_KATA_RULES_CONFIG,
        evaluationTime
      });

      expect(result.volumeDiscountCents).toBe(500); // round(10001 * 0.05) = 500
    });
  });

  describe('Edge Case 1: Absolute 35% Discount Cap Exceeded & Exact Boundary (HU 4)', () => {
    it('truncates total discount at exactly 35% of original subtotal and triggers HU 4 alert when exceeded (BVA-06)', () => {
      // Con cupón VIP50 (30%):
      // Tech $200.00 -> Cat 10% (-$20 -> $180) -> Vol 5% (-$9 -> $171) -> VIP50 30% (-$51.30 -> $119.70)
      // Descuento bruto sin tope = $20 + $9 + $51.30 = $80.30 (40.15% > 35%)
      // Tope máximo permitido (35% de $200.00) = $70.00 (7000 centavos)
      // Total final truncado = $200.00 - $70.00 = $130.00 (13000 centavos)
      const laptop = makeProduct('tech-1', 'Laptop Pro', 20000, 'Tecnología');
      const result = engine.calculate({
        items: [makeCartLine(laptop, 1)],
        couponCode: 'VIP50',
        rulesConfig: DEFAULT_KATA_RULES_CONFIG,
        evaluationTime
      });

      expect(result.uncappedTotalDiscountCents).toBe(8030);
      expect(result.uncappedDiscountPercentage).toBe(40.15);
      expect(result.maxAllowedDiscountCents).toBe(7000);
      expect(result.totalDiscountCents).toBe(7000);
      expect(result.totalDiscountUsd).toBe(70);
      expect(result.effectiveDiscountPercentage).toBe(35);
      expect(result.finalTotalCents).toBe(13000);
      expect(result.finalTotalUsd).toBe(130);
      expect(result.capReached).toBe(true);
      expect(result.capAlertMessage).toBe(MAX_DISCOUNT_CAP_ALERT_MESSAGE);
    });

    it('truncates to 35% when using DEMO_HIGH_DISCOUNT_RULES_CONFIG with WELCOME2026', () => {
      const laptop = makeProduct('tech-1', 'Laptop Pro', 20000, 'Tecnología');
      const result = engine.calculate({
        items: [makeCartLine(laptop, 1)],
        couponCode: 'WELCOME2026',
        rulesConfig: DEMO_HIGH_DISCOUNT_RULES_CONFIG,
        evaluationTime
      });

      expect(result.capReached).toBe(true);
      expect(result.effectiveDiscountPercentage).toBe(35);
      expect(result.totalDiscountCents).toBe(7000);
      expect(result.finalTotalCents).toBe(13000);
      expect(result.capAlertMessage).toBe(
        '¡Enhorabuena! Has alcanzado el límite máximo de ahorro permitido (35%)'
      );
    });

    it('handles exact 35.00% boundary and zero subtotal in MaxDiscountCapPolicy (BVA-05)', () => {
      const policy = new MaxDiscountCapPolicy(35);
      const exact = policy.applyCap(Money.fromCents(10000), Money.fromCents(3500));
      expect(exact.capReached).toBe(true);
      expect(exact.effectiveTotalDiscount.cents).toBe(3500);
      expect(exact.finalTotal.cents).toBe(6500);

      const zero = policy.applyCap(Money.zero(), Money.zero());
      expect(zero.capReached).toBe(false);
      expect(zero.finalTotal.cents).toBe(0);

      expect(() => new MaxDiscountCapPolicy(0)).toThrow();
    });
  });

  describe('Edge Case 2 & 3: Empty Cart, Unregistered, Inactive & Expired Coupons (BVA-01, BVA-07)', () => {
    it('throws EMPTY_CART DomainException when items array is empty', () => {
      expect(() =>
        engine.calculate({
          items: [],
          rulesConfig: DEFAULT_KATA_RULES_CONFIG,
          evaluationTime
        })
      ).toThrowError(DomainException);
    });

    it('marks unregistered coupon as INVALID_CODE with 0 coupon discount', () => {
      const book = makeProduct('book-1', 'Clean Architecture', 5000, 'Libros');
      const result = engine.calculate({
        items: [makeCartLine(book, 1)],
        couponCode: 'FAKECOUPON',
        rulesConfig: DEFAULT_KATA_RULES_CONFIG,
        evaluationTime
      });

      expect(result.couponStatus).toBe('INVALID_CODE');
      expect(result.couponDiscountCents).toBe(0);
      expect(result.finalTotalCents).toBe(5000);
    });

    it('marks expired coupon as EXPIRED with 0 coupon discount', () => {
      const book = makeProduct('book-1', 'Clean Architecture', 5000, 'Libros');
      const result = engine.calculate({
        items: [makeCartLine(book, 1)],
        couponCode: 'EXPIRED2024',
        rulesConfig: DEFAULT_KATA_RULES_CONFIG,
        evaluationTime
      });

      expect(result.couponStatus).toBe('EXPIRED');
      expect(result.couponDiscountCents).toBe(0);
    });

    it('marks inactive coupon as INACTIVE and supports disabled category/volume rules', () => {
      const customConfig: DiscountRulesConfigDto = {
        categoryRule: { enabled: false, targetCategory: 'Tecnología', discountPercentage: 10 },
        volumeRule: { enabled: false, thresholdCents: 10000, discountPercentage: 5 },
        maxCapPercentage: 35,
        coupons: [
          {
            code: 'PAUSED10',
            discountPercentage: 10,
            active: false,
            expiresAt: '2028-01-01T00:00:00.000Z',
            description: 'Paused'
          }
        ]
      };

      const laptop = makeProduct('tech-1', 'Laptop Pro', 20000, 'Tecnología');
      const result = engine.calculate({
        items: [makeCartLine(laptop, 1)],
        couponCode: 'PAUSED10',
        rulesConfig: customConfig,
        evaluationTime
      });

      expect(result.categoryDiscountCents).toBe(0);
      expect(result.volumeDiscountCents).toBe(0);
      expect(result.couponDiscountCents).toBe(0);
      expect(result.couponStatus).toBe('INACTIVE');
      expect(result.finalTotalCents).toBe(20000);
    });
  });
});
