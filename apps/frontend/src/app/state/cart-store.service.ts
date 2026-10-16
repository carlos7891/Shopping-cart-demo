import { computed, Injectable, signal } from '@angular/core';
import {
  CartItemInputDto,
  CartQuoteBreakdownDto,
  DEFAULT_KATA_RULES_CONFIG,
  DiscountRulesConfigDto,
  MAX_DISCOUNT_CAP_ALERT_MESSAGE,
  OrderConfirmationDto,
  ProductDto,
  sanitizeCouponCode
} from '@shopping-cart/shared';
import { EcommerceApiService } from '../services/ecommerce-api.service';

export interface CartUiLineItem {
  readonly product: ProductDto;
  readonly quantity: number;
  readonly lineSubtotalCents: number;
  readonly lineSubtotalUsd: number;
}

/**
 * Patrón Observer Reactivo implementado con Angular Signals (`signal` y `computed`).
 * Gestiona el estado del catálogo, el carrito en tiempo real (HU 1), la cotización en cascada (HU 2),
 * la confirmación de órdenes (HU 3) y la alerta persistente del tope del 35% (HU 4).
 */
@Injectable({ providedIn: 'root' })
export class CartStoreService {
  public readonly products = signal<readonly ProductDto[]>([]);
  public readonly quantitiesByProductId = signal<Readonly<Record<string, number>>>({});
  public readonly couponInput = signal<string>('');
  public readonly appliedCouponCode = signal<string | undefined>(undefined);
  public readonly quoteBreakdown = signal<CartQuoteBreakdownDto | null>(null);
  public readonly lastOrder = signal<OrderConfirmationDto | null>(null);
  public readonly recentOrders = signal<readonly OrderConfirmationDto[]>([]);
  public readonly rulesConfig = signal<DiscountRulesConfigDto>(DEFAULT_KATA_RULES_CONFIG);
  public readonly loading = signal<boolean>(false);
  public readonly errorMessage = signal<string | null>(null);
  public readonly infoMessage = signal<string | null>(null);

  /**
   * Líneas del carrito derivadas reactivamente del catálogo y mapa de cantidades (HU 1).
   */
  public readonly cartLines = computed<readonly CartUiLineItem[]>(() => {
    const catalog = this.products();
    const map = this.quantitiesByProductId();
    const lines: CartUiLineItem[] = [];

    for (const product of catalog) {
      const qty = map[product.id] ?? 0;
      if (qty > 0) {
        const lineSubtotalCents = product.priceCents * qty;
        lines.push({
          product,
          quantity: qty,
          lineSubtotalCents,
          lineSubtotalUsd: Number((lineSubtotalCents / 100).toFixed(2))
        });
      }
    }
    return lines;
  });

  public readonly totalItemsCount = computed<number>(() =>
    this.cartLines().reduce((acc, line) => acc + line.quantity, 0)
  );

  /**
   * Subtotal original actualizado inmediatamente en pantalla (HU 1).
   */
  public readonly immediateSubtotalCents = computed<number>(() =>
    this.cartLines().reduce((acc, line) => acc + line.lineSubtotalCents, 0)
  );

  public readonly immediateSubtotalUsd = computed<number>(() =>
    Number((this.immediateSubtotalCents() / 100).toFixed(2))
  );

  /**
   * Indicador reactivo de superación/alcance del límite del 35% (HU 4).
   */
  public readonly isMaxDiscountCapReached = computed<boolean>(
    () => this.quoteBreakdown()?.capReached === true
  );

  public readonly maxDiscountCapBannerText = computed<string | null>(() =>
    this.isMaxDiscountCapReached() ? MAX_DISCOUNT_CAP_ALERT_MESSAGE : null
  );

  constructor(private readonly api: EcommerceApiService) {}

  public async initializeStore(): Promise<void> {
    this.loading.set(true);
    this.errorMessage.set(null);
    try {
      const [products, rules, orders] = await Promise.all([
        this.api.getProducts(),
        this.api.getRulesConfig(),
        this.api.getOrders()
      ]);
      this.products.set(products);
      this.rulesConfig.set(rules);
      this.recentOrders.set(orders);
    } catch (error) {
      this.errorMessage.set(
        error instanceof Error ? error.message : 'No fue posible conectar con el backend.'
      );
    } finally {
      this.loading.set(false);
    }
  }

  public dismissNotification(): void {
    this.errorMessage.set(null);
    this.infoMessage.set(null);
  }

  public getProductQuantity(productId: string): number {
    return this.quantitiesByProductId()[productId] ?? 0;
  }

  public async addToCart(productId: string): Promise<void> {
    this.errorMessage.set(null);
    this.infoMessage.set(null);

    const product = this.products().find((p) => p.id === productId);
    if (!product) {
      this.errorMessage.set('Producto no encontrado.');
      return;
    }

    const currentQty = this.quantitiesByProductId()[productId] ?? 0;
    if (currentQty + 1 > product.stock) {
      this.errorMessage.set(
        `Has alcanzado el límite de stock disponible para "${product.name}" (${product.stock} unidades).`
      );
      return;
    }

    this.quantitiesByProductId.update((prev) => ({
      ...prev,
      [productId]: currentQty + 1
    }));

    await this.refreshServerQuote();
  }

  public async decrementFromCart(productId: string): Promise<void> {
    this.errorMessage.set(null);
    const currentQty = this.quantitiesByProductId()[productId] ?? 0;
    if (currentQty <= 0) {
      return;
    }

    this.quantitiesByProductId.update((prev) => {
      const clone = { ...prev };
      if (currentQty === 1) {
        delete clone[productId];
      } else {
        clone[productId] = currentQty - 1;
      }
      return clone;
    });

    await this.refreshServerQuote();
  }

  public async removeFromCart(productId: string): Promise<void> {
    this.errorMessage.set(null);
    this.quantitiesByProductId.update((prev) => {
      const clone = { ...prev };
      delete clone[productId];
      return clone;
    });

    await this.refreshServerQuote();
  }

  public async applyCoupon(rawCoupon?: string): Promise<void> {
    if (rawCoupon !== undefined) {
      this.couponInput.set(rawCoupon);
    }
    const cleanCode = sanitizeCouponCode(this.couponInput());
    this.appliedCouponCode.set(cleanCode);
    await this.refreshServerQuote();
  }

  public async clearCart(): Promise<void> {
    this.quantitiesByProductId.set({});
    this.couponInput.set('');
    this.appliedCouponCode.set(undefined);
    this.quoteBreakdown.set(null);
    this.errorMessage.set(null);
  }

  public async refreshServerQuote(): Promise<void> {
    const items = this.buildCartInputItems();
    if (items.length === 0) {
      this.quoteBreakdown.set(null);
      return;
    }

    try {
      const quote = await this.api.quoteCart({
        items,
        ...(this.appliedCouponCode() ? { couponCode: this.appliedCouponCode() } : {})
      });
      this.quoteBreakdown.set(quote);
    } catch (error) {
      this.errorMessage.set(
        error instanceof Error ? error.message : 'Error al cotizar carrito.'
      );
    }
  }

  public async confirmCheckout(): Promise<OrderConfirmationDto | null> {
    const items = this.buildCartInputItems();
    if (items.length === 0) {
      this.errorMessage.set('El carrito no puede estar vacío.');
      return null;
    }

    this.loading.set(true);
    this.errorMessage.set(null);
    this.infoMessage.set(null);

    try {
      const confirmation = await this.api.checkout({
        items,
        ...(this.appliedCouponCode() ? { couponCode: this.appliedCouponCode() } : {})
      });

      this.lastOrder.set(confirmation);
      this.quantitiesByProductId.set({});
      this.quoteBreakdown.set(null);
      this.infoMessage.set(`¡Orden ${confirmation.orderId} procesada con éxito!`);

      const [updatedProducts, updatedOrders] = await Promise.all([
        this.api.getProducts(),
        this.api.getOrders()
      ]);
      this.products.set(updatedProducts);
      this.recentOrders.set(updatedOrders);
      return confirmation;
    } catch (error) {
      this.errorMessage.set(
        error instanceof Error ? error.message : 'No fue posible procesar el checkout.'
      );
      return null;
    } finally {
      this.loading.set(false);
    }
  }

  public async saveAdminRules(newConfig: DiscountRulesConfigDto): Promise<void> {
    this.loading.set(true);
    this.errorMessage.set(null);
    this.infoMessage.set(null);
    try {
      const saved = await this.api.updateRulesConfig(newConfig);
      this.rulesConfig.set(saved);
      this.infoMessage.set('Reglas de descuento actualizadas en caliente en el motor.');
      await this.refreshServerQuote();
    } catch (error) {
      this.errorMessage.set(
        error instanceof Error ? error.message : 'Error al guardar configuración de reglas.'
      );
    } finally {
      this.loading.set(false);
    }
  }

  public async activateRulePreset(preset: 'OFFICIAL_KATA' | 'DEMO_CAP_35'): Promise<void> {
    this.loading.set(true);
    this.errorMessage.set(null);
    try {
      const updated = await this.api.applyPreset(preset);
      this.rulesConfig.set(updated);
      this.infoMessage.set(
        preset === 'DEMO_CAP_35'
          ? 'Preset DEMO (>35%) activado: ahora el carrito con WELCOME2026 superará el tope del 35%.'
          : 'Reglas oficiales de la Kata restauradas (10% Tech, >$100 -> 5%, WELCOME2026 -> 15%).'
      );
      await this.refreshServerQuote();
    } catch (error) {
      this.errorMessage.set(
        error instanceof Error ? error.message : 'Error al aplicar preset.'
      );
    } finally {
      this.loading.set(false);
    }
  }

  public async resetDemoEnvironment(): Promise<void> {
    this.loading.set(true);
    this.errorMessage.set(null);
    try {
      const { products, rules } = await this.api.resetDemo();
      this.products.set(products);
      this.rulesConfig.set(rules);
      await this.clearCart();
      this.infoMessage.set('Inventario y reglas de demostración restaurados al estado inicial.');
    } catch (error) {
      this.errorMessage.set(
        error instanceof Error ? error.message : 'Error al restaurar entorno demo.'
      );
    } finally {
      this.loading.set(false);
    }
  }

  private buildCartInputItems(): CartItemInputDto[] {
    return Object.entries(this.quantitiesByProductId())
      .filter(([, qty]) => qty > 0)
      .map(([productId, quantity]) => ({ productId, quantity }));
  }
}
