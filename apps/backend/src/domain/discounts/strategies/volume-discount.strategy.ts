import { Money } from '../../value-objects/money.vo';
import {
  DiscountCalculationContext,
  DiscountStrategy,
  DiscountStrategyResult
} from './discount-strategy.interface';

export interface VolumeRuleParams {
  readonly enabled: boolean;
  readonly thresholdCents: number;
  readonly discountPercentage: number;
}

/**
 * Regla 2 (Precedencia 2): Descuento por Volumen en Cascada.
 * Si el subtotal de la compra (DESPUÉS de aplicar el Descuento de Categoría)
 * supera estrictamente el umbral configurado ($100.00 USD = 10000 centavos),
 * se aplica un porcentaje adicional (5%) sobre ese subtotal remanente.
 */
export class VolumeDiscountStrategy implements DiscountStrategy {
  public readonly ruleId = 'VOLUME_DISCOUNT' as const;
  public readonly orderPrecedence = 2;

  constructor(private readonly params: VolumeRuleParams) {}

  public evaluate(context: DiscountCalculationContext): DiscountStrategyResult {
    const thresholdMoney = Money.fromCents(this.params.thresholdCents);
    const label = `Descuento por Volumen (> $${thresholdMoney.usd.toFixed(2)} USD - ${this.params.discountPercentage}%)`;

    if (!this.params.enabled || this.params.discountPercentage <= 0) {
      return {
        discountAmount: Money.zero(),
        nextSubtotal: context.currentSubtotal,
        step: {
          ruleId: this.ruleId,
          label,
          applied: false,
          percentage: this.params.discountPercentage,
          baseAmountCents: context.currentSubtotal.cents,
          discountAmountCents: 0,
          subtotalAfterRuleCents: context.currentSubtotal.cents,
          reason: 'Regla por volumen deshabilitada.'
        }
      };
    }

    if (!context.currentSubtotal.isGreaterThan(thresholdMoney)) {
      return {
        discountAmount: Money.zero(),
        nextSubtotal: context.currentSubtotal,
        step: {
          ruleId: this.ruleId,
          label,
          applied: false,
          percentage: this.params.discountPercentage,
          baseAmountCents: context.currentSubtotal.cents,
          discountAmountCents: 0,
          subtotalAfterRuleCents: context.currentSubtotal.cents,
          reason: `Subtotal tras categoría ($${context.currentSubtotal.usd.toFixed(2)} USD) no supera los $${thresholdMoney.usd.toFixed(2)} USD.`
        }
      };
    }

    const discountAmount = context.currentSubtotal.allocatePercentage(
      this.params.discountPercentage
    );
    const nextSubtotal = context.currentSubtotal.subtract(discountAmount);

    return {
      discountAmount,
      nextSubtotal,
      step: {
        ruleId: this.ruleId,
        label,
        applied: true,
        percentage: this.params.discountPercentage,
        baseAmountCents: context.currentSubtotal.cents,
        discountAmountCents: discountAmount.cents,
        subtotalAfterRuleCents: nextSubtotal.cents,
        reason: `${this.params.discountPercentage}% en cascada aplicado sobre subtotal remanente de $${context.currentSubtotal.usd.toFixed(2)} USD.`
      }
    };
  }
}
