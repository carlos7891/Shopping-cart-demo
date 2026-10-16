import { CommonModule } from '@angular/common';
import { Component, inject, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CartStoreService } from '../../state/cart-store.service';

@Component({
  selector: 'app-checkout-page',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="checkout-layout">
      <!-- Modal de Experiencia de Usuario para Avisos de Stock y Confirmación de Orden -->
      @if (store.errorMessage() || store.infoMessage()) {
        <div
          class="modal-backdrop"
          role="dialog"
          aria-modal="true"
          data-testid="notification-modal"
          (click)="store.dismissNotification()"
        >
          <div
            class="modal-card"
            [class.modal-error]="!!store.errorMessage()"
            [class.modal-success]="!!store.infoMessage()"
            (click)="$event.stopPropagation()"
          >
            <div class="modal-header">
              <div class="modal-title-group">
                <span class="modal-icon">{{ store.errorMessage() ? '⚠️' : '✅' }}</span>
                <h3>{{ store.errorMessage() ? 'Límite de Stock / Aviso' : 'Operación Exitosa' }}</h3>
              </div>
              <button
                type="button"
                class="modal-close-btn"
                aria-label="Cerrar notificación"
                (click)="store.dismissNotification()"
              >
                ✕
              </button>
            </div>
            <p class="modal-body">
              {{ store.errorMessage() ?? store.infoMessage() }}
            </p>
            <div class="modal-footer">
              <button
                type="button"
                class="btn btn-primary"
                (click)="store.dismissNotification()"
              >
                Entendido
              </button>
            </div>
          </div>
        </div>
      }

      <!-- Notificación Reactiva Persistente del Límite del 35% (HU 4) -->
      @if (store.isMaxDiscountCapReached()) {
        <div class="cap-alert-banner" role="alert" data-testid="max-discount-cap-alert">
          <div class="cap-alert-icon">🎉</div>
          <div class="cap-alert-content">
            <strong>{{ store.maxDiscountCapBannerText() }}</strong>
            <span>
              Tus descuentos combinados alcanzaron el
              <b>{{ store.quoteBreakdown()?.uncappedDiscountPercentage }}%</b>
              (\${{ (store.quoteBreakdown()!.uncappedTotalDiscountCents / 100).toFixed(2) }} USD),
              aplicándose el tope máximo permitido del
              <b>{{ store.quoteBreakdown()?.maxCapPercentage }}%</b>.
            </span>
          </div>
        </div>
      }

      <div class="grid-2-cols">
        <!-- Columna Izquierda: Catálogo de Productos (HU 1) -->
        <section class="panel catalog-panel">
          <div class="panel-header">
            <div>
              <h2>Catálogo de Productos</h2>
              <p class="subtitle">
                Productos en la categoría
                <b>{{ store.rulesConfig().categoryRule.targetCategory }}</b> cuentan con
                <b>{{ store.rulesConfig().categoryRule.discountPercentage }}%</b> de descuento directo.
              </p>
            </div>
          </div>

          <div class="product-grid">
            @for (product of store.products(); track product.id) {
              <article class="product-card" [class.tech-card]="product.category === 'Tecnología'">
                <!-- Mini-Carrusel de Imágenes del Producto -->
                <div class="product-carousel">
                  <img
                    class="product-image"
                    [src]="getCurrentImage(product.id)"
                    [alt]="product.name"
                    loading="lazy"
                  />

                  @if (getProductImages(product.id).length > 1) {
                    <button
                      type="button"
                      class="carousel-btn prev"
                      aria-label="Imagen anterior"
                      (click)="prevImage(product.id)"
                    >
                      ‹
                    </button>
                    <button
                      type="button"
                      class="carousel-btn next"
                      aria-label="Siguiente imagen"
                      (click)="nextImage(product.id)"
                    >
                      ›
                    </button>
                    <div class="carousel-dots">
                      @for (img of getProductImages(product.id); track img; let idx = $index) {
                        <button
                          type="button"
                          class="dot"
                          [class.active]="getActiveSlideIndex(product.id) === idx"
                          [attr.aria-label]="'Ver imagen ' + (idx + 1)"
                          (click)="selectImage(product.id, idx)"
                        ></button>
                      }
                    </div>
                  }
                </div>

                <div class="product-top">
                  <span class="badge" [class.badge-tech]="product.category === 'Tecnología'">
                    {{ product.category }}
                  </span>
                  <span class="stock-tag" [class.low-stock]="product.stock <= 2">
                    Disponibles: {{ product.stock }}
                  </span>
                </div>
                <h3>{{ product.name }}</h3>
                <p class="product-desc">{{ product.description }}</p>
                <div class="product-footer">
                  <span class="price">\${{ product.priceUsd.toFixed(2) }} <small>USD</small></span>
                  <div class="qty-controls">
                    <button
                      class="btn-icon"
                      (click)="store.decrementFromCart(product.id)"
                      [disabled]="store.getProductQuantity(product.id) === 0"
                    >
                      −
                    </button>
                    <span class="qty-num">{{ store.getProductQuantity(product.id) }}</span>
                    <button
                      class="btn-icon btn-primary"
                      (click)="store.addToCart(product.id)"
                      [disabled]="product.stock === 0"
                    >
                      +
                    </button>
                  </div>
                </div>
              </article>
            }
          </div>
        </section>

        <!-- Columna Derecha: Carrito Reactivo y Desglose en Cascada (HU 1, HU 2, HU 3) -->
        <aside class="panel summary-panel">
          <div class="summary-header-row">
            <h2>Tu Carrito de Compras</h2>
            @if (store.cartLines().length > 0) {
              <button
                type="button"
                class="btn btn-outline btn-sm"
                data-testid="clear-cart-btn"
                (click)="store.clearCart()"
              >
                🗑️ Vaciar carrito
              </button>
            }
          </div>

          @if (store.cartLines().length === 0) {
            <div class="empty-cart-box">
              <p>Tu carrito está vacío. Selecciona productos del catálogo para comenzar tu compra.</p>
            </div>
          } @else {
            <ul class="cart-list">
              @for (line of store.cartLines(); track line.product.id) {
                <li class="cart-item">
                  <div class="cart-item-left">
                    <img
                      class="cart-thumb"
                      [src]="getCurrentImage(line.product.id)"
                      [alt]="line.product.name"
                    />
                    <div>
                      <strong>{{ line.product.name }}</strong>
                      <small class="block-meta">
                        {{ line.quantity }} x \${{ line.product.priceUsd.toFixed(2) }} ({{ line.product.category }})
                      </small>
                    </div>
                  </div>
                  <div class="cart-item-right">
                    <span>\${{ line.lineSubtotalUsd.toFixed(2) }}</span>
                    <button
                      class="btn-remove"
                      title="Eliminar producto"
                      (click)="store.removeFromCart(line.product.id)"
                    >
                      ✕
                    </button>
                  </div>
                </li>
              }
            </ul>

            <!-- Aplicación Dinámica de Cupón (HU 2) -->
            <div class="coupon-box">
              <label for="couponInput">Código de Cupón Promocional</label>
              <div class="coupon-row">
                <input
                  id="couponInput"
                  type="text"
                  placeholder="Ej: WELCOME2026"
                  [ngModel]="store.couponInput()"
                  (ngModelChange)="store.couponInput.set($event)"
                />
                <button class="btn btn-primary" (click)="store.applyCoupon()">Aplicar</button>
              </div>
              <div class="quick-coupons">
                <span>Cupones disponibles:</span>
                <button class="chip" (click)="store.applyCoupon('WELCOME2026')">WELCOME2026 (15%)</button>
                <button class="chip chip-vip" (click)="store.applyCoupon('VIP50')">VIP50 (30%)</button>
                <button class="chip chip-muted" (click)="store.applyCoupon('EXPIRED2024')">EXPIRED2024</button>
              </div>
              @if (store.quoteBreakdown(); as qCoupon) {
                @if (qCoupon.couponStatus !== 'NONE') {
                  <small
                    class="step-reason"
                    [style.color]="qCoupon.couponStatus === 'APPLIED' ? '#10b981' : '#fca5a5'"
                  >
                    Estado cupón ({{ qCoupon.couponCode }}): <strong>{{ qCoupon.couponStatus }}</strong>
                  </small>
                }
              }
            </div>

            <!-- Desglose Matemático Secuencial en Cascada (HU 2) -->
            @if (store.quoteBreakdown(); as q) {
              <div class="breakdown-box">
                <div class="breakdown-line">
                  <span>Subtotal Original ({{ store.totalItemsCount() }} ítems)</span>
                  <strong>\${{ q.originalSubtotalUsd.toFixed(2) }} USD</strong>
                </div>

                @for (step of q.steps; track step.ruleId) {
                  <div class="breakdown-step" [class.step-applied]="step.applied">
                    <div class="step-header">
                      <span>{{ step.label }}</span>
                      <span class="discount-val">
                        {{ step.applied ? '-$' + (step.discountAmountCents / 100).toFixed(2) : '$0.00' }}
                      </span>
                    </div>
                    <small class="step-reason">{{ step.reason }}</small>
                    @if (step.applied) {
                      <small class="step-sub">
                        Subtotal tras descuento: \${{ (step.subtotalAfterRuleCents / 100).toFixed(2) }} USD
                      </small>
                    }
                  </div>
                }

                <div class="breakdown-divider"></div>

                <div class="breakdown-line">
                  <span>Porcentaje de Descuento Efectivo</span>
                  <span class="badge-pct">{{ q.effectiveDiscountPercentage }}% (Máx: {{ q.maxCapPercentage }}%)</span>
                </div>

                <div class="breakdown-line savings-line">
                  <span>Ahorro Total</span>
                  <strong>-\${{ q.totalDiscountUsd.toFixed(2) }} USD</strong>
                </div>

                <div class="breakdown-line total-line">
                  <span>Valor Final a Pagar</span>
                  <strong>\${{ q.finalTotalUsd.toFixed(2) }} USD</strong>
                </div>

                <button
                  class="btn btn-checkout"
                  [disabled]="store.loading()"
                  (click)="store.confirmCheckout()"
                >
                  {{ store.loading() ? 'Procesando Compra...' : 'Confirmar y Pagar Orden' }}
                </button>
              </div>
            }
          }

          <!-- Historial de Órdenes Recientes (HU 3) -->
          @if (store.recentOrders().length > 0) {
            <div class="orders-history">
              <h3>Mis Compras Recientes ({{ store.recentOrders().length }})</h3>
              @for (ord of store.recentOrders().slice(0, 3); track ord.orderId) {
                <div class="order-pill">
                  <div>
                    <strong>{{ ord.orderId }}</strong>
                    <small>{{ ord.createdAt | date:'shortTime' }} · Ahorro: {{ ord.breakdown.effectiveDiscountPercentage }}%</small>
                  </div>
                  <span class="order-total">\${{ ord.breakdown.finalTotalUsd.toFixed(2) }} USD</span>
                </div>
              }
            </div>
          }
        </aside>
      </div>
    </div>
  `
})
export class CheckoutPageComponent implements OnInit {
  public readonly store = inject(CartStoreService);
  public readonly activeSlideByProduct: Record<string, number> = {};

  private readonly productGallery: Readonly<Record<string, readonly string[]>> = {
    'prod-tech-laptop': [
      'assets/laptop.webp',
      'assets/laptop2.webp',
      'assets/laptop3.webp'
    ],
    'prod-tech-monitor': ['assets/monitor1.webp'],
    'prod-tech-keyboard': [
      'assets/teclado1.webp',
      'assets/teclado2.webp',
      'assets/teclado3.webp'
    ],
    'prod-home-chair': [
      'assets/silla1.webp',
      'assets/silla2.webp',
      'assets/silla3.webp'
    ],
    'prod-acc-backpack': ['assets/Morral-1.webp', 'assets/Morral-2.webp'],
    'prod-book-arch': ['assets/libro.webp']
  };

  public ngOnInit(): void {
    void this.store.initializeStore();
  }

  public getProductImages(productId: string): readonly string[] {
    return this.productGallery[productId] ?? ['assets/monitor1.webp'];
  }

  public getActiveSlideIndex(productId: string): number {
    return this.activeSlideByProduct[productId] ?? 0;
  }

  public getCurrentImage(productId: string): string {
    const images = this.getProductImages(productId);
    const index = this.getActiveSlideIndex(productId);
    return images[index] ?? images[0];
  }

  public nextImage(productId: string): void {
    const images = this.getProductImages(productId);
    const current = this.getActiveSlideIndex(productId);
    this.activeSlideByProduct[productId] = (current + 1) % images.length;
  }

  public prevImage(productId: string): void {
    const images = this.getProductImages(productId);
    const current = this.getActiveSlideIndex(productId);
    this.activeSlideByProduct[productId] = (current - 1 + images.length) % images.length;
  }

  public selectImage(productId: string, index: number): void {
    this.activeSlideByProduct[productId] = index;
  }
}
