import {
  CartQuoteBreakdownDto,
  DiscountRulesConfigDto,
  OrderConfirmationDto
} from '@shopping-cart/shared';
import { ProductEntity } from '../../domain/entities/cart-domain.models';

export const PRODUCT_REPOSITORY_PORT = Symbol('PRODUCT_REPOSITORY_PORT');
export const ORDER_REPOSITORY_PORT = Symbol('ORDER_REPOSITORY_PORT');
export const RULE_CONFIG_REPOSITORY_PORT = Symbol('RULE_CONFIG_REPOSITORY_PORT');

/**
 * Puerto de Repositorio de Productos (SOLID - Interface Segregation & Dependency Inversion).
 */
export interface ProductRepositoryPort {
  findAll(): ProductEntity[];
  findById(id: string): ProductEntity | null;
  resetCatalogSeed(): ProductEntity[];
}

/**
 * Puerto de Repositorio Transaccional de Órdenes (ACID).
 * Decrementa el stock y persiste la orden de manera atómica.
 */
export interface OrderRepositoryPort {
  createOrderWithStockDeduction(breakdown: CartQuoteBreakdownDto): OrderConfirmationDto;
  findAllOrders(): OrderConfirmationDto[];
  findOrderById(orderId: string): OrderConfirmationDto | null;
}

/**
 * Puerto de Configuración Dinámica de Reglas y Cupones (usado por el motor y el panel /admin).
 */
export interface RuleConfigRepositoryPort {
  getRulesConfig(): DiscountRulesConfigDto;
  saveRulesConfig(config: DiscountRulesConfigDto): DiscountRulesConfigDto;
}
