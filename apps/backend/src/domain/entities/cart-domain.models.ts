import { ProductCategory } from '@shopping-cart/shared';
import { Money } from '../value-objects/money.vo';

export interface ProductEntity {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly price: Money;
  readonly category: ProductCategory;
  readonly stock: number;
}

export interface CartLineDomainItem {
  readonly product: ProductEntity;
  readonly quantity: number;
  readonly lineSubtotal: Money;
}
