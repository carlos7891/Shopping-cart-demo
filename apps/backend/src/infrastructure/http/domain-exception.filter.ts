import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus
} from '@nestjs/common';
import { ApiErrorResponseDto, BusinessErrorCode } from '@shopping-cart/shared';
import { Response } from 'express';
import { DomainException } from '../../domain/exceptions/domain.exception';

/**
 * Filtro global que mapea DomainException a códigos HTTP semánticos
 * sin filtrar stack traces internos al cliente (OWASP API8:2023 Security Misconfiguration).
 */
@Catch()
export class DomainExceptionFilter implements ExceptionFilter {
  public catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    if (exception instanceof DomainException) {
      const status = this.mapErrorCodeToHttpStatus(exception.errorCode);
      const body: ApiErrorResponseDto = {
        statusCode: status,
        errorCode: exception.errorCode,
        message: exception.message,
        ...(exception.details.length > 0 ? { details: exception.details } : {})
      };
      response.status(status).json(body);
      return;
    }

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      response.status(status).json({
        statusCode: status,
        errorCode: 'INVALID_CART_PAYLOAD',
        message: exception.message
      });
      return;
    }

    response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      errorCode: 'INVALID_CART_PAYLOAD',
      message: 'Error interno al procesar la solicitud.'
    });
  }

  private mapErrorCodeToHttpStatus(code: BusinessErrorCode): number {
    switch (code) {
      case 'EMPTY_CART':
        return HttpStatus.UNPROCESSABLE_ENTITY; // 422
      case 'INVALID_CART_PAYLOAD':
      case 'INVALID_RULE_CONFIG':
        return HttpStatus.BAD_REQUEST; // 400
      case 'PRODUCT_NOT_FOUND':
        return HttpStatus.NOT_FOUND; // 404
      case 'INSUFFICIENT_STOCK':
        return HttpStatus.CONFLICT; // 409
      default:
        return HttpStatus.BAD_REQUEST;
    }
  }
}
