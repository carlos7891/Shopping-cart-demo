import { DiscountRulesConfigDto } from '@shopping-cart/shared';
import { MaxDiscountCapPolicy } from './max-discount-cap.policy';
import { CategoryDiscountStrategy } from './strategies/category-discount.strategy';
import { CouponDiscountStrategy } from './strategies/coupon-discount.strategy';
import { DiscountStrategy } from './strategies/discount-strategy.interface';
import { VolumeDiscountStrategy } from './strategies/volume-discount.strategy';

export interface DiscountPipelineBundle {
  readonly strategies: readonly DiscountStrategy[];
  readonly capPolicy: MaxDiscountCapPolicy;
}

/**
 * Patrón Factory:
 * Instancia y ordena determinísticamente las estrategias de descuento según su precedencia
 * de negocio (1. Categoría -> 2. Volumen -> 3. Cupón) más la política de tope absoluto (4. Cap 35%).
 */
export class DiscountRuleFactory {
  public static createPipeline(config: DiscountRulesConfigDto): DiscountPipelineBundle {
    const strategies: DiscountStrategy[] = [
      new CategoryDiscountStrategy(config.categoryRule),
      new VolumeDiscountStrategy(config.volumeRule),
      new CouponDiscountStrategy(config.coupons)
    ];

    strategies.sort((a, b) => a.orderPrecedence - b.orderPrecedence);

    return {
      strategies,
      capPolicy: new MaxDiscountCapPolicy(config.maxCapPercentage)
    };
  }
}
