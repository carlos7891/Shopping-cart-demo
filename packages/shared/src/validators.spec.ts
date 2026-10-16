import { describe, expect, it } from 'vitest';
import {
  DEFAULT_KATA_RULES_CONFIG,
  DEMO_HIGH_DISCOUNT_RULES_CONFIG,
  MAX_DISCOUNT_CAP_ALERT_MESSAGE
} from './contracts';
import {
  sanitizeCouponCode,
  validateCartRequest,
  validateDiscountRulesConfig
} from './validators';

describe('@shopping-cart/shared — Validators & Security Contracts', () => {
  describe('sanitizeCouponCode', () => {
    it('normalizes whitespace and lowercase characters to uppercase', () => {
      expect(sanitizeCouponCode('  welcome2026  ')).toBe('WELCOME2026');
    });

    it('returns undefined for null, undefined or blank strings', () => {
      expect(sanitizeCouponCode(undefined)).toBeUndefined();
      expect(sanitizeCouponCode(null)).toBeUndefined();
      expect(sanitizeCouponCode('   ')).toBeUndefined();
    });
  });

  describe('validateCartRequest (Anti-Tampering & Corrupt Data Protection)', () => {
    it('accepts a valid cart request and consolidates duplicate product IDs', () => {
      const result = validateCartRequest({
        items: [
          { productId: 'prod-1', quantity: 2 },
          { productId: 'prod-1', quantity: 3 },
          { productId: 'prod-2', quantity: 1 }
        ],
        couponCode: ' welcome2026 '
      });

      expect(result.valid).toBe(true);
      expect(result.data).toEqual({
        items: [
          { productId: 'prod-1', quantity: 5 },
          { productId: 'prod-2', quantity: 1 }
        ],
        couponCode: 'WELCOME2026'
      });
    });

    it('rejects non-object payloads or arrays', () => {
      expect(validateCartRequest(null).valid).toBe(false);
      expect(validateCartRequest('invalid').valid).toBe(false);
      expect(validateCartRequest([]).valid).toBe(false);
    });

    it('rejects empty cart items array', () => {
      const result = validateCartRequest({ items: [] });
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('El carrito no puede estar vacío.');
    });

    it('rejects price or discount tampering fields in root or item objects', () => {
      const result = validateCartRequest({
        items: [{ productId: 'prod-1', quantity: 1, unitPriceCents: 1 }],
        overrideDiscount: 99
      });
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('overrideDiscount'))).toBe(true);
      expect(result.errors.some((e) => e.includes('unitPriceCents'))).toBe(true);
    });

    it('rejects negative, zero, decimal, NaN or excessive quantities', () => {
      const result = validateCartRequest({
        items: [
          { productId: 'prod-1', quantity: 0 },
          { productId: 'prod-2', quantity: -3 },
          { productId: 'prod-3', quantity: 1.5 },
          { productId: '', quantity: 1000 }
        ]
      });
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThanOrEqual(4);
    });

    it('rejects duplicate items whose consolidated quantity exceeds 999', () => {
      const result = validateCartRequest({
        items: [
          { productId: 'prod-1', quantity: 600 },
          { productId: 'prod-1', quantity: 500 }
        ]
      });
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('supera el máximo permitido');
    });

    it('rejects malformed coupon codes or non-string coupons', () => {
      const badType = validateCartRequest({
        items: [{ productId: 'prod-1', quantity: 1 }],
        couponCode: 12345
      });
      expect(badType.valid).toBe(false);

      const sqlInjectionAttempt = validateCartRequest({
        items: [{ productId: 'prod-1', quantity: 1 }],
        couponCode: "WELCOME'; DROP TABLE orders;--"
      });
      expect(sqlInjectionAttempt.valid).toBe(false);
    });
  });

  describe('validateDiscountRulesConfig', () => {
    it('validates the official Kata rules and demo high discount rules', () => {
      expect(validateDiscountRulesConfig(DEFAULT_KATA_RULES_CONFIG).valid).toBe(true);
      expect(validateDiscountRulesConfig(DEMO_HIGH_DISCOUNT_RULES_CONFIG).valid).toBe(true);
      expect(MAX_DISCOUNT_CAP_ALERT_MESSAGE).toBe(
        '¡Enhorabuena! Has alcanzado el límite máximo de ahorro permitido (35%)'
      );
    });

    it('rejects invalid rule configurations', () => {
      expect(validateDiscountRulesConfig(null).valid).toBe(false);
      const invalid = validateDiscountRulesConfig({
        categoryRule: { enabled: 'yes', targetCategory: 'InvalidCat', discountPercentage: 120 },
        volumeRule: { enabled: false, thresholdCents: -10, discountPercentage: -5 },
        maxCapPercentage: 0,
        coupons: [{ code: '!', discountPercentage: 0, active: 'true', expiresAt: 'not-a-date' }]
      });
      expect(invalid.valid).toBe(false);
      expect(invalid.errors.length).toBeGreaterThanOrEqual(7);
    });
  });
});
