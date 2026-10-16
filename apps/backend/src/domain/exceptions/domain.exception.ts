import { BusinessErrorCode } from '@shopping-cart/shared';

/**
 * Excepción tipada de la capa de Dominio (sin acoplamiento a HTTP/NestJS).
 */
export class DomainException extends Error {
  public readonly errorCode: BusinessErrorCode;
  public readonly details: readonly string[];

  constructor(errorCode: BusinessErrorCode, message: string, details: readonly string[] = []) {
    super(message);
    this.name = 'DomainException';
    this.errorCode = errorCode;
    this.details = details;
  }
}
