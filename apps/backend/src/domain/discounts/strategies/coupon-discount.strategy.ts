import {
  CouponApplicationStatus,
  CouponRuleConfigDto,
  sanitizeCouponCode
} from '@shopping-cart/shared';
import { Money } from '../../value-objects/money.vo';
import {
  DiscountCalculationContext,
  DiscountStrategy,
  DiscountStrategyResult
} from './discount-strategy.interface';

/**
 * Regla 3 (Precedencia 3): Descuento por Cupón Promocional en Cascada.
 * Si el usuario ingresa un código de cupón activo y vigente (ej. "WELCOME2026"),
 * se aplica su porcentaje (ej. 15%) sobre el subtotal obtenido tras la regla 2.
 */
export class CouponDiscountStrategy implements DiscountStrategy {
  public readonly ruleId = 'COUPON_DISCOUNT' as const;
  public readonly orderPrecedence = 3;

  constructor(private readonly availableCoupons: readonly CouponRuleConfigDto[]) {}

  public evaluate(context: DiscountCalculationContext): DiscountStrategyResult {
    const normalizedCode = sanitizeCouponCode(context.couponCode);

    if (!normalizedCode) {
      return this.buildUnappliedResult(
        context,
        'NONE',
        'Descuento por Cupón',
        'No se ingresó código de cupón.'
      );
    }

    const matchedCoupon = this.availableCoupons.find(
      (c) => sanitizeCouponCode(c.code) === normalizedCode
    );

    if (!matchedCoupon) {
      return this.buildUnappliedResult(
        context,
        'INVALID_CODE',
        `Cupón (${normalizedCode})`,
        `El cupón "${normalizedCode}" no está registrado en el sistema.`
      );
    }

    if (!matchedCoupon.active) {
      return this.buildUnappliedResult(
        context,
        'INACTIVE',
        `Cupón (${normalizedCode})`,
        `El cupón "${normalizedCode}" se encuentra inactivo.`
      );
    }

    const expirationTimestamp = Date.parse(matchedCoupon.expiresAt);
    if (
      Number.isNaN(expirationTimestamp) ||
      context.evaluationTime.getTime() > expirationTimestamp
    ) {
      return this.buildUnappliedResult(
        context,
        'EXPIRED',
        `Cupón (${normalizedCode})`,
        `El cupón "${normalizedCode}" ha expirado.`
      );
    }

    const discountAmount = context.currentSubtotal.allocatePercentage(
      matchedCoupon.discountPercentage
    );
    const nextSubtotal = context.currentSubtotal.subtract(discountAmount);

    return {
      discountAmount,
      nextSubtotal,
      couponStatus: 'APPLIED',
      step: {
        ruleId: this.ruleId,
        label: `Cupón "${normalizedCode}" (${matchedCoupon.discountPercentage}%)`,
        applied: true,
        percentage: matchedCoupon.discountPercentage,
        baseAmountCents: context.currentSubtotal.cents,
        discountAmountCents: discountAmount.cents,
        subtotalAfterRuleCents: nextSubtotal.cents,
        reason: `Cupón "${normalizedCode}" (${matchedCoupon.discountPercentage}%) aplicado en cascada sobre $${context.currentSubtotal.usd.toFixed(2)} USD.`
      }
    };
  }

  private buildUnappliedResult(
    context: DiscountCalculationContext,
    status: CouponApplicationStatus,
    label: string,
    reason: string
  ): DiscountStrategyResult {
    return {
      discountAmount: Money.zero(),
      nextSubtotal: context.currentSubtotal,
      couponStatus: status,
      step: {
        ruleId: this.ruleId,
        label,
        applied: false,
        percentage: 0,
        baseAmountCents: context.currentSubtotal.cents,
        discountAmountCents: 0,
        subtotalAfterRuleCents: context.currentSubtotal.cents,
        reason
      }
    };
  }
}
