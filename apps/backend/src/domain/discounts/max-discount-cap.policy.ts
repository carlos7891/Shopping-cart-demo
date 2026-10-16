import { MAX_DISCOUNT_CAP_ALERT_MESSAGE } from '@shopping-cart/shared';
import { Money } from '../value-objects/money.vo';

export interface CapEvaluationResult {
  readonly maxCapPercentage: number;
  readonly maxAllowedDiscount: Money;
  readonly uncappedTotalDiscount: Money;
  readonly uncappedDiscountPercentage: number;
  readonly effectiveTotalDiscount: Money;
  readonly effectiveDiscountPercentage: number;
  readonly finalTotal: Money;
  readonly capReached: boolean;
  readonly capAlertMessage: string | null;
}

/**
 * Regla 4 (Límite de Descuento Absoluto Infranqueable - 35%):
 * Bajo ninguna circunstancia el descuento total consolidado puede superar el porcentaje máximo
 * (por defecto 35%) del valor total original de los productos agregados.
 * Si el cálculo acumulado resulta en un descuento mayor (o alcanza el límite),
 * trunca el descuento exactamente en el límite y emite la alerta de la HU 4.
 */
export class MaxDiscountCapPolicy {
  constructor(private readonly maxCapPercentage: number = 35) {
    if (
      !Number.isFinite(maxCapPercentage) ||
      maxCapPercentage <= 0 ||
      maxCapPercentage > 90
    ) {
      throw new Error(`El porcentaje de tope máximo debe estar entre 1 y 90. Recibido: ${maxCapPercentage}`);
    }
  }

  public applyCap(originalSubtotal: Money, uncappedDiscount: Money): CapEvaluationResult {
    if (originalSubtotal.cents === 0) {
      return {
        maxCapPercentage: this.maxCapPercentage,
        maxAllowedDiscount: Money.zero(),
        uncappedTotalDiscount: Money.zero(),
        uncappedDiscountPercentage: 0,
        effectiveTotalDiscount: Money.zero(),
        effectiveDiscountPercentage: 0,
        finalTotal: Money.zero(),
        capReached: false,
        capAlertMessage: null
      };
    }

    const maxAllowedDiscount = originalSubtotal.allocatePercentage(this.maxCapPercentage);
    const uncappedDiscountPercentage =
      Math.round((uncappedDiscount.cents / originalSubtotal.cents) * 10000) / 100;

    const exceedsOrReachesCap = uncappedDiscount.cents >= maxAllowedDiscount.cents && maxAllowedDiscount.cents > 0;
    const effectiveTotalDiscount =
      uncappedDiscount.cents > maxAllowedDiscount.cents
        ? maxAllowedDiscount
        : uncappedDiscount;

    const finalTotal = originalSubtotal.subtract(effectiveTotalDiscount);
    const effectiveDiscountPercentage = exceedsOrReachesCap
      ? this.maxCapPercentage
      : Math.round((effectiveTotalDiscount.cents / originalSubtotal.cents) * 10000) / 100;

    return {
      maxCapPercentage: this.maxCapPercentage,
      maxAllowedDiscount,
      uncappedTotalDiscount: uncappedDiscount,
      uncappedDiscountPercentage,
      effectiveTotalDiscount,
      effectiveDiscountPercentage,
      finalTotal,
      capReached: exceedsOrReachesCap,
      capAlertMessage: exceedsOrReachesCap ? MAX_DISCOUNT_CAP_ALERT_MESSAGE : null
    };
  }
}
