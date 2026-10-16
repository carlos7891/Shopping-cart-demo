/**
 * Categorías oficiales del catálogo de productos.
 */
export type ProductCategory = 'Tecnología' | 'Hogar' | 'Accesorios' | 'Libros';

/**
 * Mensaje obligatorio de la HU 4 cuando se alcanza o supera el límite del 35%.
 */
export const MAX_DISCOUNT_CAP_ALERT_MESSAGE =
  '¡Enhorabuena! Has alcanzado el límite máximo de ahorro permitido (35%)';

/**
 * Constantes por defecto del enunciado oficial de la Kata.
 */
export const DEFAULT_KATA_RULES_CONFIG: DiscountRulesConfigDto = {
  categoryRule: {
    enabled: true,
    targetCategory: 'Tecnología',
    discountPercentage: 10
  },
  volumeRule: {
    enabled: true,
    thresholdCents: 10000, // $100.00 USD
    discountPercentage: 5
  },
  maxCapPercentage: 35,
  coupons: [
    {
      code: 'WELCOME2026',
      discountPercentage: 15,
      active: true,
      expiresAt: '2027-12-31T23:59:59.000Z',
      description: 'Cupón oficial de bienvenida (15% en cascada tras volumen)'
    },
    {
      code: 'VIP50',
      discountPercentage: 30,
      active: true,
      expiresAt: '2027-12-31T23:59:59.000Z',
      description: 'Cupón VIP para demostrar activación del límite máximo del 35% (HU 4)'
    },
    {
      code: 'EXPIRED2024',
      discountPercentage: 20,
      active: true,
      expiresAt: '2024-01-01T00:00:00.000Z',
      description: 'Cupón expirado para pruebas de borde (Edge Case)'
    }
  ]
};

/**
 * Preset de demostración rápida para superar el 35% incluso con el cupón WELCOME2026.
 */
export const DEMO_HIGH_DISCOUNT_RULES_CONFIG: DiscountRulesConfigDto = {
  categoryRule: {
    enabled: true,
    targetCategory: 'Tecnología',
    discountPercentage: 25
  },
  volumeRule: {
    enabled: true,
    thresholdCents: 10000,
    discountPercentage: 10
  },
  maxCapPercentage: 35,
  coupons: DEFAULT_KATA_RULES_CONFIG.coupons
};

/**
 * Representación de un producto en el catálogo.
 * Precios almacenados y transmitidos tanto en centavos enteros (precisión exacta)
 * como en dólares (presentación).
 */
export interface ProductDto {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly priceCents: number;
  readonly priceUsd: number;
  readonly category: ProductCategory;
  readonly stock: number;
}

/**
 * Ítem enviado por el cliente en peticiones de cotización o checkout.
 * SEGURIDAD (Anti-Price Tampering): El cliente SOLO envía productId y quantity.
 * Jamás envía precios ni porcentajes de descuento.
 */
export interface CartItemInputDto {
  readonly productId: string;
  readonly quantity: number;
}

/**
 * Petición para cotizar o confirmar un carrito.
 */
export interface CartRequestDto {
  readonly items: readonly CartItemInputDto[];
  readonly couponCode?: string;
}

/**
 * Estado de evaluación del cupón ingresado.
 */
export type CouponApplicationStatus =
  | 'NONE'
  | 'APPLIED'
  | 'INVALID_CODE'
  | 'EXPIRED'
  | 'INACTIVE';

/**
 * Detalle individual de una regla aplicada en la cascada.
 */
export interface DiscountStepBreakdownDto {
  readonly ruleId: 'CATEGORY_DISCOUNT' | 'VOLUME_DISCOUNT' | 'COUPON_DISCOUNT';
  readonly label: string;
  readonly applied: boolean;
  readonly percentage: number;
  readonly baseAmountCents: number;
  readonly discountAmountCents: number;
  readonly subtotalAfterRuleCents: number;
  readonly reason: string;
}

/**
 * Detalle enriquecido de línea del carrito tras validar con catálogo del servidor.
 */
export interface EnrichedCartItemDto {
  readonly productId: string;
  readonly name: string;
  readonly category: ProductCategory;
  readonly unitPriceCents: number;
  readonly unitPriceUsd: number;
  readonly quantity: number;
  readonly lineSubtotalCents: number;
  readonly lineSubtotalUsd: number;
}

/**
 * Desglose matemático completo del motor de descuentos en cascada.
 */
export interface CartQuoteBreakdownDto {
  readonly items: readonly EnrichedCartItemDto[];
  readonly originalSubtotalCents: number;
  readonly originalSubtotalUsd: number;
  readonly categoryDiscountCents: number;
  readonly categoryDiscountUsd: number;
  readonly subtotalAfterCategoryCents: number;
  readonly volumeDiscountCents: number;
  readonly volumeDiscountUsd: number;
  readonly subtotalAfterVolumeCents: number;
  readonly couponDiscountCents: number;
  readonly couponDiscountUsd: number;
  readonly subtotalAfterCouponCents: number;
  readonly uncappedTotalDiscountCents: number;
  readonly uncappedDiscountPercentage: number;
  readonly maxAllowedDiscountCents: number;
  readonly maxCapPercentage: number;
  readonly capReached: boolean;
  readonly capAlertMessage: string | null;
  readonly totalDiscountCents: number;
  readonly totalDiscountUsd: number;
  readonly effectiveDiscountPercentage: number;
  readonly finalTotalCents: number;
  readonly finalTotalUsd: number;
  readonly couponCode: string | null;
  readonly couponStatus: CouponApplicationStatus;
  readonly steps: readonly DiscountStepBreakdownDto[];
}

/**
 * Confirmación de orden persistida (HU 3).
 */
export interface OrderConfirmationDto {
  readonly orderId: string;
  readonly createdAt: string;
  readonly breakdown: CartQuoteBreakdownDto;
}

/**
 * Definición de un cupón configurable.
 */
export interface CouponRuleConfigDto {
  readonly code: string;
  readonly discountPercentage: number;
  readonly active: boolean;
  readonly expiresAt: string;
  readonly description: string;
}

/**
 * Configuración dinámica completa del motor de descuentos (administrable en /admin).
 */
export interface DiscountRulesConfigDto {
  readonly categoryRule: {
    readonly enabled: boolean;
    readonly targetCategory: ProductCategory;
    readonly discountPercentage: number;
  };
  readonly volumeRule: {
    readonly enabled: boolean;
    readonly thresholdCents: number;
    readonly discountPercentage: number;
  };
  readonly maxCapPercentage: number;
  readonly coupons: readonly CouponRuleConfigDto[];
}

/**
 * Códigos de error de negocio estandarizados.
 */
export type BusinessErrorCode =
  | 'EMPTY_CART'
  | 'INVALID_CART_PAYLOAD'
  | 'PRODUCT_NOT_FOUND'
  | 'INSUFFICIENT_STOCK'
  | 'INVALID_RULE_CONFIG';

export interface ApiErrorResponseDto {
  readonly statusCode: number;
  readonly errorCode: BusinessErrorCode;
  readonly message: string;
  readonly details?: readonly string[];
}
