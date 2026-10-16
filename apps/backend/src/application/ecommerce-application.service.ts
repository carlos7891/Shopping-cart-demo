import { Inject, Injectable } from '@nestjs/common';
import {
  CartQuoteBreakdownDto,
  CartRequestDto,
  DEFAULT_KATA_RULES_CONFIG,
  DEMO_HIGH_DISCOUNT_RULES_CONFIG,
  DiscountRulesConfigDto,
  OrderConfirmationDto,
  ProductDto,
  validateCartRequest,
  validateDiscountRulesConfig
} from '@shopping-cart/shared';
import { CumulativeDiscountEngine } from '../domain/discounts/cumulative-discount.engine';
import { CartLineDomainItem, ProductEntity } from '../domain/entities/cart-domain.models';
import { DomainException } from '../domain/exceptions/domain.exception';
import {
  ORDER_REPOSITORY_PORT,
  OrderRepositoryPort,
  PRODUCT_REPOSITORY_PORT,
  ProductRepositoryPort,
  RULE_CONFIG_REPOSITORY_PORT,
  RuleConfigRepositoryPort
} from './ports/repositories.ports';

@Injectable()
export class EcommerceApplicationService {
  private readonly discountEngine = new CumulativeDiscountEngine();

  constructor(
    @Inject(PRODUCT_REPOSITORY_PORT)
    private readonly productRepo: ProductRepositoryPort,
    @Inject(ORDER_REPOSITORY_PORT)
    private readonly orderRepo: OrderRepositoryPort,
    @Inject(RULE_CONFIG_REPOSITORY_PORT)
    private readonly ruleConfigRepo: RuleConfigRepositoryPort
  ) {}

  public listProducts(): ProductDto[] {
    return this.productRepo.findAll().map((p) => this.mapProductToDto(p));
  }

  public resetDemoState(): { products: ProductDto[]; rules: DiscountRulesConfigDto } {
    const products = this.productRepo.resetCatalogSeed().map((p) => this.mapProductToDto(p));
    const rules = this.ruleConfigRepo.saveRulesConfig(DEFAULT_KATA_RULES_CONFIG);
    return { products, rules };
  }

  public quoteCart(rawPayload: unknown, evaluationTime?: Date): CartQuoteBreakdownDto {
    const validation = validateCartRequest(rawPayload);
    if (!validation.valid || !validation.data) {
      const isEmptyError = validation.errors.some((e) => e.includes('vacío'));
      throw new DomainException(
        isEmptyError ? 'EMPTY_CART' : 'INVALID_CART_PAYLOAD',
        validation.errors[0] ?? 'Payload de carrito inválido.',
        validation.errors
      );
    }

    const domainLines = this.resolveAndValidateCartLines(validation.data, false);
    const rulesConfig = this.ruleConfigRepo.getRulesConfig();

    return this.discountEngine.calculate({
      items: domainLines,
      couponCode: validation.data.couponCode,
      rulesConfig,
      evaluationTime
    });
  }

  public processCheckout(rawPayload: unknown, evaluationTime?: Date): OrderConfirmationDto {
    const validation = validateCartRequest(rawPayload);
    if (!validation.valid || !validation.data) {
      const isEmptyError = validation.errors.some((e) => e.includes('vacío'));
      throw new DomainException(
        isEmptyError ? 'EMPTY_CART' : 'INVALID_CART_PAYLOAD',
        validation.errors[0] ?? 'Payload de carrito inválido.',
        validation.errors
      );
    }

    const domainLines = this.resolveAndValidateCartLines(validation.data, true);
    const rulesConfig = this.ruleConfigRepo.getRulesConfig();

    const breakdown = this.discountEngine.calculate({
      items: domainLines,
      couponCode: validation.data.couponCode,
      rulesConfig,
      evaluationTime
    });

    return this.orderRepo.createOrderWithStockDeduction(breakdown);
  }

  public listOrders(): OrderConfirmationDto[] {
    return this.orderRepo.findAllOrders();
  }

  public getOrderById(orderId: string): OrderConfirmationDto | null {
    return this.orderRepo.findOrderById(orderId);
  }

  public getRulesConfig(): DiscountRulesConfigDto {
    return this.ruleConfigRepo.getRulesConfig();
  }

  public updateRulesConfig(rawPayload: unknown): DiscountRulesConfigDto {
    const validation = validateDiscountRulesConfig(rawPayload);
    if (!validation.valid || !validation.data) {
      throw new DomainException(
        'INVALID_RULE_CONFIG',
        validation.errors[0] ?? 'Configuración de reglas inválida.',
        validation.errors
      );
    }
    return this.ruleConfigRepo.saveRulesConfig(validation.data);
  }

  public applyPresetRules(preset: 'OFFICIAL_KATA' | 'DEMO_CAP_35'): DiscountRulesConfigDto {
    const targetConfig =
      preset === 'DEMO_CAP_35' ? DEMO_HIGH_DISCOUNT_RULES_CONFIG : DEFAULT_KATA_RULES_CONFIG;
    return this.ruleConfigRepo.saveRulesConfig(targetConfig);
  }

  private resolveAndValidateCartLines(
    request: CartRequestDto,
    enforceStockLimit: boolean
  ): CartLineDomainItem[] {
    const lines: CartLineDomainItem[] = [];

    for (const item of request.items) {
      const product = this.productRepo.findById(item.productId);
      if (!product) {
        throw new DomainException(
          'PRODUCT_NOT_FOUND',
          `El producto con ID "${item.productId}" no existe en el catálogo.`
        );
      }

      if (enforceStockLimit && item.quantity > product.stock) {
        throw new DomainException(
          'INSUFFICIENT_STOCK',
          `Stock insuficiente para "${product.name}". Solicitado: ${item.quantity}, Disponible: ${product.stock}.`
        );
      }

      lines.push({
        product,
        quantity: item.quantity,
        lineSubtotal: product.price.multiplyByQuantity(item.quantity)
      });
    }

    return lines;
  }

  private mapProductToDto(product: ProductEntity): ProductDto {
    return {
      id: product.id,
      name: product.name,
      description: product.description,
      priceCents: product.price.cents,
      priceUsd: product.price.usd,
      category: product.category,
      stock: product.stock
    };
  }
}
