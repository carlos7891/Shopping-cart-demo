import {
  CartRequestDto,
  DiscountRulesConfigDto,
  ProductCategory
} from './contracts';

export interface ValidationResult<T> {
  readonly valid: boolean;
  readonly data?: T;
  readonly errors: readonly string[];
}

const VALID_CATEGORIES: readonly ProductCategory[] = [
  'Tecnología',
  'Hogar',
  'Accesorios',
  'Libros'
];

const MAX_ITEMS_PER_LINE = 999;
const MAX_DISTINCT_PRODUCTS = 50;
const COUPON_REGEX = /^[A-Z0-9_-]{3,25}$/;

/**
 * Sanitiza un código de cupón removiendo espacios y normalizando a mayúsculas.
 */
export function sanitizeCouponCode(rawCode?: string | null): string | undefined {
  if (rawCode === undefined || rawCode === null) {
    return undefined;
  }
  const trimmed = String(rawCode).trim().toUpperCase();
  return trimmed.length > 0 ? trimmed : undefined;
}

/**
 * Valida estrictamente un payload de carrito (Anti-Tampering + prevención de datos corruptos).
 * Rechaza propiedades adicionales no permitidas en la raíz o en cada ítem.
 */
export function validateCartRequest(payload: unknown): ValidationResult<CartRequestDto> {
  const errors: string[] = [];

  if (typeof payload !== 'object' || payload === null || Array.isArray(payload)) {
    return {
      valid: false,
      errors: ['El payload del carrito debe ser un objeto JSON válido.']
    };
  }

  const record = payload as Record<string, unknown>;
  const allowedRootKeys = new Set(['items', 'couponCode']);
  for (const key of Object.keys(record)) {
    if (!allowedRootKeys.has(key)) {
      errors.push(`Propiedad no permitida en la petición: "${key}" (Anti-Tampering activo).`);
    }
  }

  if (!Array.isArray(record.items)) {
    errors.push('El campo "items" es obligatorio y debe ser un arreglo.');
  } else {
    if (record.items.length === 0) {
      errors.push('El carrito no puede estar vacío.');
    }
    if (record.items.length > MAX_DISTINCT_PRODUCTS) {
      errors.push(`El carrito no puede superar ${MAX_DISTINCT_PRODUCTS} líneas distintas.`);
    }

    const allowedItemKeys = new Set(['productId', 'quantity']);
    record.items.forEach((rawItem: unknown, idx: number) => {
      if (typeof rawItem !== 'object' || rawItem === null || Array.isArray(rawItem)) {
        errors.push(`El ítem en la posición [${idx}] debe ser un objeto válido.`);
        return;
      }

      const itemObj = rawItem as Record<string, unknown>;
      for (const itemKey of Object.keys(itemObj)) {
        if (!allowedItemKeys.has(itemKey)) {
          errors.push(
            `Propiedad no permitida "${itemKey}" en items[${idx}]. El cliente solo puede enviar productId y quantity.`
          );
        }
      }

      if (typeof itemObj.productId !== 'string' || itemObj.productId.trim().length === 0) {
        errors.push(`items[${idx}].productId debe ser un string no vacío.`);
      }

      if (
        typeof itemObj.quantity !== 'number' ||
        !Number.isInteger(itemObj.quantity) ||
        !Number.isFinite(itemObj.quantity) ||
        itemObj.quantity <= 0 ||
        itemObj.quantity > MAX_ITEMS_PER_LINE
      ) {
        errors.push(
          `items[${idx}].quantity debe ser un número entero positivo entre 1 y ${MAX_ITEMS_PER_LINE}.`
        );
      }
    });
  }

  let normalizedCoupon: string | undefined;
  if (record.couponCode !== undefined && record.couponCode !== null) {
    if (typeof record.couponCode !== 'string') {
      errors.push('El campo "couponCode" debe ser una cadena de texto.');
    } else {
      normalizedCoupon = sanitizeCouponCode(record.couponCode);
      if (normalizedCoupon !== undefined && !COUPON_REGEX.test(normalizedCoupon)) {
        errors.push(
          'El código de cupón contiene caracteres inválidos o longitud fuera de rango (3-25 caracteres alfanuméricos).'
        );
      }
    }
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  const rawItems = record.items as Array<{ productId: string; quantity: number }>;
  // Consolidar productos duplicados sumando cantidades
  const consolidatedMap = new Map<string, number>();
  for (const item of rawItems) {
    const cleanId = item.productId.trim();
    const nextQty = (consolidatedMap.get(cleanId) ?? 0) + item.quantity;
    if (nextQty > MAX_ITEMS_PER_LINE) {
      return {
        valid: false,
        errors: [`La cantidad acumulada para el producto "${cleanId}" supera el máximo permitido (${MAX_ITEMS_PER_LINE}).`]
      };
    }
    consolidatedMap.set(cleanId, nextQty);
  }

  return {
    valid: true,
    errors: [],
    data: {
      items: Array.from(consolidatedMap.entries()).map(([productId, quantity]) => ({
        productId,
        quantity
      })),
      ...(normalizedCoupon ? { couponCode: normalizedCoupon } : {})
    }
  };
}

/**
 * Valida la configuración de reglas administrables desde el panel /admin.
 */
export function validateDiscountRulesConfig(
  payload: unknown
): ValidationResult<DiscountRulesConfigDto> {
  const errors: string[] = [];

  if (typeof payload !== 'object' || payload === null || Array.isArray(payload)) {
    return { valid: false, errors: ['La configuración de reglas debe ser un objeto válido.'] };
  }

  const obj = payload as Record<string, unknown>;
  const categoryRule = obj.categoryRule as Record<string, unknown> | undefined;
  const volumeRule = obj.volumeRule as Record<string, unknown> | undefined;

  if (!categoryRule || typeof categoryRule !== 'object') {
    errors.push('categoryRule es obligatorio.');
  } else {
    if (typeof categoryRule.enabled !== 'boolean') {
      errors.push('categoryRule.enabled debe ser booleano.');
    }
    if (!VALID_CATEGORIES.includes(categoryRule.targetCategory as ProductCategory)) {
      errors.push(`categoryRule.targetCategory debe ser una categoría válida (${VALID_CATEGORIES.join(', ')}).`);
    }
    if (
      typeof categoryRule.discountPercentage !== 'number' ||
      !Number.isFinite(categoryRule.discountPercentage) ||
      categoryRule.discountPercentage < 0 ||
      categoryRule.discountPercentage > 90
    ) {
      errors.push('categoryRule.discountPercentage debe estar entre 0 y 90.');
    }
  }

  if (!volumeRule || typeof volumeRule !== 'object') {
    errors.push('volumeRule es obligatorio.');
  } else {
    if (typeof volumeRule.enabled !== 'boolean') {
      errors.push('volumeRule.enabled debe ser booleano.');
    }
    if (
      typeof volumeRule.thresholdCents !== 'number' ||
      !Number.isInteger(volumeRule.thresholdCents) ||
      volumeRule.thresholdCents < 0
    ) {
      errors.push('volumeRule.thresholdCents debe ser un entero >= 0.');
    }
    if (
      typeof volumeRule.discountPercentage !== 'number' ||
      !Number.isFinite(volumeRule.discountPercentage) ||
      volumeRule.discountPercentage < 0 ||
      volumeRule.discountPercentage > 90
    ) {
      errors.push('volumeRule.discountPercentage debe estar entre 0 y 90.');
    }
  }

  if (
    typeof obj.maxCapPercentage !== 'number' ||
    !Number.isFinite(obj.maxCapPercentage) ||
    obj.maxCapPercentage <= 0 ||
    obj.maxCapPercentage > 90
  ) {
    errors.push('maxCapPercentage debe ser un número entre 1 y 90.');
  }

  if (!Array.isArray(obj.coupons)) {
    errors.push('coupons debe ser un arreglo.');
  } else {
    obj.coupons.forEach((c: unknown, idx: number) => {
      if (typeof c !== 'object' || c === null) {
        errors.push(`coupons[${idx}] debe ser un objeto.`);
        return;
      }
      const coupon = c as Record<string, unknown>;
      const cleanCode = sanitizeCouponCode(
        typeof coupon.code === 'string' ? coupon.code : undefined
      );
      if (!cleanCode || !COUPON_REGEX.test(cleanCode)) {
        errors.push(`coupons[${idx}].code es inválido.`);
      }
      if (
        typeof coupon.discountPercentage !== 'number' ||
        !Number.isFinite(coupon.discountPercentage) ||
        coupon.discountPercentage <= 0 ||
        coupon.discountPercentage > 90
      ) {
        errors.push(`coupons[${idx}].discountPercentage debe estar entre 1 y 90.`);
      }
      if (typeof coupon.active !== 'boolean') {
        errors.push(`coupons[${idx}].active debe ser booleano.`);
      }
      if (typeof coupon.expiresAt !== 'string' || Number.isNaN(Date.parse(coupon.expiresAt))) {
        errors.push(`coupons[${idx}].expiresAt debe ser una fecha ISO válida.`);
      }
    });
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  const validCategory = categoryRule as DiscountRulesConfigDto['categoryRule'];
  const validVolume = volumeRule as DiscountRulesConfigDto['volumeRule'];
  const validCoupons = (obj.coupons as DiscountRulesConfigDto['coupons']).map((c) => ({
    code: sanitizeCouponCode(c.code)!,
    discountPercentage: c.discountPercentage,
    active: c.active,
    expiresAt: c.expiresAt,
    description: typeof c.description === 'string' ? c.description.trim() : ''
  }));

  return {
    valid: true,
    errors: [],
    data: {
      categoryRule: {
        enabled: validCategory.enabled,
        targetCategory: validCategory.targetCategory,
        discountPercentage: validCategory.discountPercentage
      },
      volumeRule: {
        enabled: validVolume.enabled,
        thresholdCents: validVolume.thresholdCents,
        discountPercentage: validVolume.discountPercentage
      },
      maxCapPercentage: obj.maxCapPercentage as number,
      coupons: validCoupons
    }
  };
}
