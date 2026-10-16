import { CommonModule } from '@angular/common';
import { Component, inject, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CouponRuleConfigDto, DiscountRulesConfigDto, ProductCategory } from '@shopping-cart/shared';
import { CartStoreService } from '../../state/cart-store.service';

@Component({
  selector: 'app-admin-rules-page',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './admin-rules-page.component.html',
  styleUrl: './admin-rules-page.component.css'
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
