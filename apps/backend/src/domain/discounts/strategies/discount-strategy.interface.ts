import {
  CouponApplicationStatus,
  DiscountStepBreakdownDto
} from '@shopping-cart/shared';
import { CartLineDomainItem } from '../../entities/cart-domain.models';
import { Money } from '../../value-objects/money.vo';

/**
 * Contexto inmutable que fluye paso a paso a través de la cadena de estrategias en cascada.
 */
export interface DiscountCalculationContext {
  readonly items: readonly CartLineDomainItem[];
  readonly originalSubtotal: Money;
  readonly currentSubtotal: Money;
  readonly couponCode?: string;
  readonly evaluationTime: Date;
}

/**
 * Resultado devuelto por una estrategia individual del motor.
 */
export interface DiscountStrategyResult {
  readonly step: DiscountStepBreakdownDto;
  readonly discountAmount: Money;
  readonly nextSubtotal: Money;
  readonly couponStatus?: CouponApplicationStatus;
}

/**
 * Patrón Strategy (SOLID - Single Responsibility & Open/Closed):
 * Cada tipo de descuento implementa esta interfaz de manera aislada.
 */
export interface DiscountStrategy {
  readonly ruleId: DiscountStepBreakdownDto['ruleId'];
  readonly orderPrecedence: number;
  evaluate(context: DiscountCalculationContext): DiscountStrategyResult;
}
