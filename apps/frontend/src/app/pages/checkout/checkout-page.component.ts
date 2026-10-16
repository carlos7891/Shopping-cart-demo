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
      <!-- Notificación Reactiva Persistente del Límite del 35% (HU 4) -->
      @if (store.isMaxDiscountCapReached()) {
        <div class="cap-alert-banner" role="alert" data-testid="max-discount-cap-alert">
          <div class="cap-alert-icon">🛡️</div>
          <div class="cap-alert-content">
            <strong>{{ store.maxDiscountCapBannerText() }}</strong>
            <span>
              El cálculo bruto en cascada era del
              <b>{{ store.quoteBreakdown()?.uncappedDiscountPercentage }}%</b>
              (\${{ (store.quoteBreakdown()!.uncappedTotalDiscountCents / 100).toFixed(2) }} USD),
              y el motor protegió el margen truncándolo exactamente al
              <b>{{ store.quoteBreakdown()?.maxCapPercentage }}%</b>.
            </span>
          </div>
        </div>
      }

      @if (store.errorMessage()) {
        <div class="feedback-banner error" role="alert">
          ⚠️ {{ store.errorMessage() }}
        </div>
      }

      @if (store.infoMessage()) {
        <div class="feedback-banner success">
          ✅ {{ store.infoMessage() }}
        </div>
      }

      <div class="grid-2-cols">
        <!-- Columna Izquierda: Catálogo de Productos (HU 1) -->
        <section class="panel catalog-panel">
          <div class="panel-header">
            <div>
              <h2>Catálogo de Productos</h2>
              <p class="subtitle">
                Agrega productos en tiempo real. Categoría
                <b>{{ store.rulesConfig().categoryRule.targetCategory }}</b> otorga
                <b>{{ store.rulesConfig().categoryRule.discountPercentage }}%</b> inicial.
              </p>
            </div>
            <button class="btn btn-outline" (click)="store.resetDemoEnvironment()">
              Restaurar Stock/Reglas
            </button>
          </div>

          <div class="product-grid">
            @for (product of store.products(); track product.id) {
              <article class="product-card" [class.tech-card]="product.category === 'Tecnología'">
                <div class="product-top">
                  <span class="badge" [class.badge-tech]="product.category === 'Tecnología'">
                    {{ product.category }}
                  </span>
                  <span class="stock-tag" [class.low-stock]="product.stock <= 2">
                    Stock: {{ product.stock }}
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
          <h2>Resumen de Checkout en Cascada</h2>

          @if (store.cartLines().length === 0) {
            <div class="empty-cart-box">
              <p>Tu carrito está vacío. Agrega productos del catálogo para calcular descuentos en cascada.</p>
            </div>
          } @else {
            <ul class="cart-list">
              @for (line of store.cartLines(); track line.product.id) {
                <li class="cart-item">
                  <div>
                    <strong>{{ line.product.name }}</strong>
                    <small class="block-meta">
                      {{ line.quantity }} x \${{ line.product.priceUsd.toFixed(2) }} ({{ line.product.category }})
                    </small>
                  </div>
                  <div class="cart-item-right">
                    <span>\${{ line.lineSubtotalUsd.toFixed(2) }}</span>
                    <button class="btn-remove" (click)="store.removeFromCart(line.product.id)">✕</button>
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
                  placeholder="Ej: WELCOME2026 o VIP50"
                  [ngModel]="store.couponInput()"
                  (ngModelChange)="store.couponInput.set($event)"
                />
                <button class="btn btn-primary" (click)="store.applyCoupon()">Aplicar</button>
              </div>
              <div class="quick-coupons">
                <span>Probar rápido:</span>
                <button class="chip" (click)="store.applyCoupon('WELCOME2026')">WELCOME2026 (15%)</button>
                <button class="chip chip-vip" (click)="store.applyCoupon('VIP50')">VIP50 (30% - Tope 35%)</button>
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
                        Subtotal remanente tras regla: \${{ (step.subtotalAfterRuleCents / 100).toFixed(2) }} USD
                      </small>
                    }
                  </div>
                }

                <div class="breakdown-divider"></div>

                <div class="breakdown-line">
                  <span>Porcentaje de Descuento Efectivo</span>
                  <span class="badge-pct">{{ q.effectiveDiscountPercentage }}% (Tope máx: {{ q.maxCapPercentage }}%)</span>
                </div>

                <div class="breakdown-line savings-line">
                  <span>Ahorro Consolidado Total</span>
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
                  {{ store.loading() ? 'Procesando Transacción ACID...' : 'Confirmar y Pagar Orden' }}
                </button>
              </div>
            }
          }

          <!-- Historial de Órdenes Persistidas en SQLite (HU 3) -->
          @if (store.recentOrders().length > 0) {
            <div class="orders-history">
              <h3>Órdenes Persistidas en SQLite ({{ store.recentOrders().length }})</h3>
              @for (ord of store.recentOrders().slice(0, 3); track ord.orderId) {
                <div class="order-pill">
                  <div>
                    <strong>{{ ord.orderId }}</strong>
                    <small>{{ ord.createdAt | date:'shortTime' }} · Desc: {{ ord.breakdown.effectiveDiscountPercentage }}%</small>
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

  public ngOnInit(): void {
    void this.store.initializeStore();
  }
}
