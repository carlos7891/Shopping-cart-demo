import { CommonModule } from '@angular/common';
import { Component, inject, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CouponRuleConfigDto, DiscountRulesConfigDto, ProductCategory } from '@shopping-cart/shared';
import { CartStoreService } from '../../state/cart-store.service';

@Component({
  selector: 'app-admin-rules-page',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="admin-container">
      <div class="panel">
        <div class="panel-header">
          <div>
            <h2>⚙️ Rule Engine Studio (/admin)</h2>
            <p class="subtitle">
              Panel de administración en tiempo real para parametrizar las reglas secuenciales en cascada y demostrar el tope infranqueable del 35%.
            </p>
          </div>
          <div class="preset-actions">
            <button class="btn btn-outline" (click)="resetFullDemo()">
              🔄 Restaurar Stock y Reglas Iniciales
            </button>
            <button class="btn btn-outline" (click)="applyPreset('OFFICIAL_KATA')">
              Reglas Oficiales Kata (27.33% máx)
            </button>
            <button class="btn btn-accent" (click)="applyPreset('DEMO_CAP_35')">
              Activar Preset Demo Tope &gt;35% (25% / 10% / 15%)
            </button>
          </div>
        </div>

        @if (store.errorMessage() || store.infoMessage()) {
          <div
            class="modal-backdrop"
            role="dialog"
            aria-modal="true"
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
                  <h3>{{ store.errorMessage() ? 'Error de Configuración' : 'Configuración Aplicada' }}</h3>
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
              <p class="modal-body">{{ store.errorMessage() ?? store.infoMessage() }}</p>
              <div class="modal-footer">
                <button type="button" class="btn btn-primary" (click)="store.dismissNotification()">
                  Cerrar
                </button>
              </div>
            </div>
          </div>
        }

        <div class="admin-grid">
          <!-- Regla 1: Categoría -->
          <div class="rule-card">
            <h3>1. Regla de Categoría (Precedencia 1)</h3>
            <label class="checkbox-row">
              <input type="checkbox" [(ngModel)]="categoryEnabled" />
              <span>Habilitar Descuento de Categoría</span>
            </label>
            <label>
              Categoría Objetivo
              <select [(ngModel)]="targetCategory">
                <option value="Tecnología">Tecnología</option>
                <option value="Hogar">Hogar</option>
                <option value="Accesorios">Accesorios</option>
                <option value="Libros">Libros</option>
              </select>
            </label>
            <label>
              Porcentaje de Descuento (%)
              <input type="number" min="0" max="90" [(ngModel)]="categoryPercentage" />
            </label>
          </div>

          <!-- Regla 2: Volumen -->
          <div class="rule-card">
            <h3>2. Regla por Volumen en Cascada (Precedencia 2)</h3>
            <label class="checkbox-row">
              <input type="checkbox" [(ngModel)]="volumeEnabled" />
              <span>Habilitar Descuento por Volumen</span>
            </label>
            <label>
              Umbral Mínimo post-categoría (USD)
              <input type="number" min="0" [(ngModel)]="volumeThresholdUsd" />
            </label>
            <label>
              Porcentaje de Descuento (%)
              <input type="number" min="0" max="90" [(ngModel)]="volumePercentage" />
            </label>
          </div>

          <!-- Regla 4: Tope Absoluto -->
          <div class="rule-card">
            <h3>4. Límite de Descuento Absoluto (Cap Policy)</h3>
            <p class="subtitle">
              Trunca cualquier combinación acumulada que supere este porcentaje sobre el subtotal original.
            </p>
            <label>
              Tope Máximo Permitido (%)
              <input type="number" min="1" max="90" [(ngModel)]="maxCapPercentage" />
            </label>
          </div>
        </div>

        <!-- Regla 3: Cupones -->
        <div class="coupons-section">
          <h3>3. Catálogo de Cupones Promocionales (Precedencia 3)</h3>
          <table class="coupons-table">
            <thead>
              <tr>
                <th>Código</th>
                <th>% Descuento</th>
                <th>Activo</th>
                <th>Expira (ISO)</th>
                <th>Descripción</th>
              </tr>
            </thead>
            <tbody>
              @for (c of editableCoupons; track c.code) {
                <tr>
                  <td><strong>{{ c.code }}</strong></td>
                  <td>
                    <input type="number" min="1" max="90" [(ngModel)]="c.discountPercentage" />
                  </td>
                  <td>
                    <input type="checkbox" [(ngModel)]="c.active" />
                  </td>
                  <td>
                    <input type="text" [(ngModel)]="c.expiresAt" />
                  </td>
                  <td>{{ c.description }}</td>
                </tr>
              }
            </tbody>
          </table>
        </div>

        <div class="admin-footer">
          <button class="btn btn-primary" (click)="saveChanges()">
            Guardar Reglas en Motor Backend
          </button>
        </div>
      </div>
    </div>
  `
})
export class AdminRulesPageComponent implements OnInit {
  public readonly store = inject(CartStoreService);

  public categoryEnabled = true;
  public targetCategory: ProductCategory = 'Tecnología';
  public categoryPercentage = 10;

  public volumeEnabled = true;
  public volumeThresholdUsd = 100;
  public volumePercentage = 5;

  public maxCapPercentage = 35;
  public editableCoupons: Array<{
    code: string;
    discountPercentage: number;
    active: boolean;
    expiresAt: string;
    description: string;
  }> = [];

  public async ngOnInit(): Promise<void> {
    await this.store.initializeStore();
    this.syncFormFromStore();
  }

  public syncFormFromStore(): void {
    const cfg = this.store.rulesConfig();
    this.categoryEnabled = cfg.categoryRule.enabled;
    this.targetCategory = cfg.categoryRule.targetCategory;
    this.categoryPercentage = cfg.categoryRule.discountPercentage;

    this.volumeEnabled = cfg.volumeRule.enabled;
    this.volumeThresholdUsd = Number((cfg.volumeRule.thresholdCents / 100).toFixed(2));
    this.volumePercentage = cfg.volumeRule.discountPercentage;

    this.maxCapPercentage = cfg.maxCapPercentage;
    this.editableCoupons = cfg.coupons.map((c: CouponRuleConfigDto) => ({ ...c }));
  }

  public async applyPreset(preset: 'OFFICIAL_KATA' | 'DEMO_CAP_35'): Promise<void> {
    await this.store.activateRulePreset(preset);
    this.syncFormFromStore();
  }

  public async resetFullDemo(): Promise<void> {
    await this.store.resetDemoEnvironment();
    this.syncFormFromStore();
  }

  public async saveChanges(): Promise<void> {
    const payload: DiscountRulesConfigDto = {
      categoryRule: {
        enabled: this.categoryEnabled,
        targetCategory: this.targetCategory,
        discountPercentage: Number(this.categoryPercentage)
      },
      volumeRule: {
        enabled: this.volumeEnabled,
        thresholdCents: Math.round(Number(this.volumeThresholdUsd) * 100),
        discountPercentage: Number(this.volumePercentage)
      },
      maxCapPercentage: Number(this.maxCapPercentage),
      coupons: this.editableCoupons.map((c) => ({
        code: c.code,
        discountPercentage: Number(c.discountPercentage),
        active: Boolean(c.active),
        expiresAt: c.expiresAt,
        description: c.description
      }))
    };

    await this.store.saveAdminRules(payload);
    this.syncFormFromStore();
  }
}
