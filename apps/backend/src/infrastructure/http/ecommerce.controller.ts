import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  NotFoundException,
  Param,
  Post,
  Put
} from '@nestjs/common';
import {
  CartQuoteBreakdownDto,
  DiscountRulesConfigDto,
  OrderConfirmationDto,
  ProductDto
} from '@shopping-cart/shared';
import { EcommerceApplicationService } from '../../application/ecommerce-application.service';

@Controller('api')
export class EcommerceController {
  constructor(
    @Inject(EcommerceApplicationService)
    private readonly appService: EcommerceApplicationService
  ) {}

  @Get('products')
  public getProducts(): ProductDto[] {
    return this.appService.listProducts();
  }

  @Post('cart/quote')
  @HttpCode(HttpStatus.OK)
  public quoteCart(@Body() body: unknown): CartQuoteBreakdownDto {
    return this.appService.quoteCart(body);
  }

  @Post('checkout')
  @HttpCode(HttpStatus.CREATED)
  public checkout(@Body() body: unknown): OrderConfirmationDto {
    return this.appService.processCheckout(body);
  }

  @Get('orders')
  public listOrders(): OrderConfirmationDto[] {
    return this.appService.listOrders();
  }

  @Get('orders/:id')
  public getOrder(@Param('id') id: string): OrderConfirmationDto {
    const order = this.appService.getOrderById(id);
    if (!order) {
      throw new NotFoundException(`La orden "${id}" no existe.`);
    }
    return order;
  }

  @Get('admin/rules')
  public getRules(): DiscountRulesConfigDto {
    return this.appService.getRulesConfig();
  }

  @Put('admin/rules')
  public updateRules(@Body() body: unknown): DiscountRulesConfigDto {
    return this.appService.updateRulesConfig(body);
  }

  @Post('admin/rules/preset')
  @HttpCode(HttpStatus.OK)
  public applyPreset(
    @Body() body: { preset?: 'OFFICIAL_KATA' | 'DEMO_CAP_35' }
  ): DiscountRulesConfigDto {
    const preset = body?.preset === 'DEMO_CAP_35' ? 'DEMO_CAP_35' : 'OFFICIAL_KATA';
    return this.appService.applyPresetRules(preset);
  }

  @Post('admin/reset-demo')
  @HttpCode(HttpStatus.OK)
  public resetDemo(): { products: ProductDto[]; rules: DiscountRulesConfigDto } {
    return this.appService.resetDemoState();
  }
}
