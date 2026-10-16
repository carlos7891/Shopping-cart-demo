import {
  CartQuoteBreakdownDto,
  CouponApplicationStatus,
  DiscountRulesConfigDto,
  DiscountStepBreakdownDto,
  EnrichedCartItemDto,
  sanitizeCouponCode
} from '@shopping-cart/shared';
import { CartLineDomainItem } from '../entities/cart-domain.models';
import { DomainException } from '../exceptions/domain.exception';
import { Money } from '../value-objects/money.vo';
import { DiscountRuleFactory } from './discount-rule.factory';

export interface CalculateCartDiscountsInput {
  readonly items: readonly CartLineDomainItem[];
  readonly couponCode?: string;
  readonly rulesConfig: DiscountRulesConfigDto;
  readonly evaluationTime?: Date;
}

/**
 * Motor Central de Descuentos Acumulativos en Cascada.
 * Aplica secuencialmente cada estrategia inyectada por el Factory (Open/Closed Principle)
 * y garantiza el límite infranqueable del 35% mediante MaxDiscountCapPolicy.
 */
export class CumulativeDiscountEngine {
  public calculate(input: CalculateCartDiscountsInput): CartQuoteBreakdownDto {
    if (!input.items || input.items.length === 0) {
      throw new DomainException(
        'EMPTY_CART',
        'No se puede calcular el desglose de un carrito vacío.'
      );
    }

    const evaluationTime = input.evaluationTime ?? new Date();
    const normalizedCoupon = sanitizeCouponCode(input.couponCode) ?? null;

    const originalSubtotal = input.items.reduce(
      (acc, line) => acc.add(line.lineSubtotal),
      Money.zero()
    );

    const { strategies, capPolicy } = DiscountRuleFactory.createPipeline(
      input.rulesConfig
    );

    let runningSubtotal = originalSubtotal;
    let categoryDiscount = Money.zero();
    let subtotalAfterCategory = originalSubtotal;
    let volumeDiscount = Money.zero();
    let subtotalAfterVolume = originalSubtotal;
    let couponDiscount = Money.zero();
    let subtotalAfterCoupon = originalSubtotal;
    let couponStatus: CouponApplicationStatus = 'NONE';

    const steps: DiscountStepBreakdownDto[] = [];

    for (const strategy of strategies) {
      const result = strategy.evaluate({
        items: input.items,
        originalSubtotal,
        currentSubtotal: runningSubtotal,
        couponCode: normalizedCoupon ?? undefined,
        evaluationTime
      });

      runningSubtotal = result.nextSubtotal;
      steps.push(result.step);

      if (strategy.ruleId === 'CATEGORY_DISCOUNT') {
        categoryDiscount = result.discountAmount;
        subtotalAfterCategory = result.nextSubtotal;
      } else if (strategy.ruleId === 'VOLUME_DISCOUNT') {
        volumeDiscount = result.discountAmount;
        subtotalAfterVolume = result.nextSubtotal;
      } else if (strategy.ruleId === 'COUPON_DISCOUNT') {
        couponDiscount = result.discountAmount;
        subtotalAfterCoupon = result.nextSubtotal;
        couponStatus = result.couponStatus ?? 'NONE';
      }
    }

    const uncappedTotalDiscount = categoryDiscount
      .add(volumeDiscount)
      .add(couponDiscount);

    const capEvaluation = capPolicy.applyCap(originalSubtotal, uncappedTotalDiscount);

    const enrichedItems: EnrichedCartItemDto[] = input.items.map((line) => ({
      productId: line.product.id,
      name: line.product.name,
      category: line.product.category,
      unitPriceCents: line.product.price.cents,
      unitPriceUsd: line.product.price.usd,
      quantity: line.quantity,
      lineSubtotalCents: line.lineSubtotal.cents,
      lineSubtotalUsd: line.lineSubtotal.usd
    }));

    return {
      items: enrichedItems,
      originalSubtotalCents: originalSubtotal.cents,
      originalSubtotalUsd: originalSubtotal.usd,
      categoryDiscountCents: categoryDiscount.cents,
      categoryDiscountUsd: categoryDiscount.usd,
      subtotalAfterCategoryCents: subtotalAfterCategory.cents,
      volumeDiscountCents: volumeDiscount.cents,
      volumeDiscountUsd: volumeDiscount.usd,
      subtotalAfterVolumeCents: subtotalAfterVolume.cents,
      couponDiscountCents: couponDiscount.cents,
      couponDiscountUsd: couponDiscount.usd,
      subtotalAfterCouponCents: subtotalAfterCoupon.cents,
      uncappedTotalDiscountCents: capEvaluation.uncappedTotalDiscount.cents,
      uncappedDiscountPercentage: capEvaluation.uncappedDiscountPercentage,
      maxAllowedDiscountCents: capEvaluation.maxAllowedDiscount.cents,
      maxCapPercentage: capEvaluation.maxCapPercentage,
      capReached: capEvaluation.capReached,
      capAlertMessage: capEvaluation.capAlertMessage,
      totalDiscountCents: capEvaluation.effectiveTotalDiscount.cents,
      totalDiscountUsd: capEvaluation.effectiveTotalDiscount.usd,
      effectiveDiscountPercentage: capEvaluation.effectiveDiscountPercentage,
      finalTotalCents: capEvaluation.finalTotal.cents,
      finalTotalUsd: capEvaluation.finalTotal.usd,
      couponCode: normalizedCoupon,
      couponStatus,
      steps
    };
  }
}
