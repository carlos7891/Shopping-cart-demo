import { Injectable } from '@angular/core';
import {
  ApiErrorResponseDto,
  CartQuoteBreakdownDto,
  CartRequestDto,
  DiscountRulesConfigDto,
  OrderConfirmationDto,
  ProductDto
} from '@shopping-cart/shared';

@Injectable({ providedIn: 'root' })
export class EcommerceApiService {
  private readonly baseUrl = 'http://localhost:3000/api';

  public async getProducts(): Promise<ProductDto[]> {
    return this.request<ProductDto[]>('/products', { method: 'GET' });
  }

  public async quoteCart(payload: CartRequestDto): Promise<CartQuoteBreakdownDto> {
    return this.request<CartQuoteBreakdownDto>('/cart/quote', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  }

  public async checkout(payload: CartRequestDto): Promise<OrderConfirmationDto> {
    return this.request<OrderConfirmationDto>('/checkout', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  }

  public async getOrders(): Promise<OrderConfirmationDto[]> {
    return this.request<OrderConfirmationDto[]>('/orders', { method: 'GET' });
  }

  public async getRulesConfig(): Promise<DiscountRulesConfigDto> {
    return this.request<DiscountRulesConfigDto>('/admin/rules', { method: 'GET' });
  }

  public async updateRulesConfig(
    config: DiscountRulesConfigDto
  ): Promise<DiscountRulesConfigDto> {
    return this.request<DiscountRulesConfigDto>('/admin/rules', {
      method: 'PUT',
      body: JSON.stringify(config)
    });
  }

  public async applyPreset(
    preset: 'OFFICIAL_KATA' | 'DEMO_CAP_35'
  ): Promise<DiscountRulesConfigDto> {
    return this.request<DiscountRulesConfigDto>('/admin/rules/preset', {
      method: 'POST',
      body: JSON.stringify({ preset })
    });
  }

  public async resetDemo(): Promise<{
    products: ProductDto[];
    rules: DiscountRulesConfigDto;
  }> {
    return this.request<{ products: ProductDto[]; rules: DiscountRulesConfigDto }>(
      '/admin/reset-demo',
      { method: 'POST' }
    );
  }

  private async request<T>(endpoint: string, init: RequestInit): Promise<T> {
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        ...(init.headers ?? {})
      }
    });

    const data = (await response.json()) as T | ApiErrorResponseDto;
    if (!response.ok) {
      const apiErr = data as ApiErrorResponseDto;
      throw new Error(apiErr.message || `Error HTTP ${response.status}`);
    }
    return data as T;
  }
}
