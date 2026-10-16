import { ProductCategory } from '@shopping-cart/shared';
import { Money } from '../../value-objects/money.vo';
import {
  DiscountCalculationContext,
  DiscountStrategy,
  DiscountStrategyResult
} from './discount-strategy.interface';

export interface CategoryRuleParams {
  readonly enabled: boolean;
  readonly targetCategory: ProductCategory;
  readonly discountPercentage: number;
}

/**
 * Regla 1 (Precedencia 1): Descuento de Categoría.
 * Si la orden contiene al menos un producto de la categoría configurada (ej. "Tecnología"),
 * se aplica el porcentaje configurado (ej. 10%) exclusivamente sobre esos productos.
 */
export class CategoryDiscountStrategy implements DiscountStrategy {
  public readonly ruleId = 'CATEGORY_DISCOUNT' as const;
  public readonly orderPrecedence = 1;

  constructor(private readonly params: CategoryRuleParams) {}

  public evaluate(context: DiscountCalculationContext): DiscountStrategyResult {
    const label = `Descuento de Categoría (${this.params.targetCategory} - ${this.params.discountPercentage}%)`;

    if (!this.params.enabled || this.params.discountPercentage <= 0) {
      return {
        discountAmount: Money.zero(),
        nextSubtotal: context.currentSubtotal,
        step: {
          ruleId: this.ruleId,
          label,
          applied: false,
          percentage: this.params.discountPercentage,
          baseAmountCents: 0,
          discountAmountCents: 0,
          subtotalAfterRuleCents: context.currentSubtotal.cents,
          reason: 'Regla de categoría deshabilitada.'
        }
      };
    }

    const matchingSubtotal = context.items
      .filter((item) => item.product.category === this.params.targetCategory)
      .reduce((acc, item) => acc.add(item.lineSubtotal), Money.zero());

    if (matchingSubtotal.cents === 0) {
      return {
        discountAmount: Money.zero(),
        nextSubtotal: context.currentSubtotal,
        step: {
          ruleId: this.ruleId,
          label,
          applied: false,
          percentage: this.params.discountPercentage,
          baseAmountCents: 0,
          discountAmountCents: 0,
          subtotalAfterRuleCents: context.currentSubtotal.cents,
          reason: `El carrito no contiene productos de la categoría "${this.params.targetCategory}".`
        }
      };
    }

    const discountAmount = matchingSubtotal.allocatePercentage(this.params.discountPercentage);
    const nextSubtotal = context.currentSubtotal.subtract(discountAmount);

    return {
      discountAmount,
      nextSubtotal,
      step: {
        ruleId: this.ruleId,
        label,
        applied: true,
        percentage: this.params.discountPercentage,
        baseAmountCents: matchingSubtotal.cents,
        discountAmountCents: discountAmount.cents,
        subtotalAfterRuleCents: nextSubtotal.cents,
        reason: `${this.params.discountPercentage}% aplicado sobre $${matchingSubtotal.usd.toFixed(2)} USD en productos de ${this.params.targetCategory}.`
      }
    };
  }
}
