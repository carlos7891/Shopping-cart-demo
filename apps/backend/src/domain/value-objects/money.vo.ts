/**
 * Value Object inmutable para operaciones monetarias seguras en centavos enteros.
 * Previene errores de punto flotante IEEE 754 (ej. 0.1 + 0.2 !== 0.3).
 */
export class Money {
  private readonly amountCents: number;

  private constructor(cents: number) {
    if (!Number.isInteger(cents) || !Number.isFinite(cents)) {
      throw new Error(`Money requiere un número entero finito de centavos. Recibido: ${cents}`);
    }
    if (cents < 0) {
      throw new Error(`Money no admite montos negativos en el dominio de checkout. Recibido: ${cents}`);
    }
    this.amountCents = cents;
  }

  public static zero(): Money {
    return new Money(0);
  }

  public static fromCents(cents: number): Money {
    return new Money(cents);
  }

  public static fromUsd(usd: number): Money {
    if (!Number.isFinite(usd) || usd < 0) {
      throw new Error(`Monto en USD inválido: ${usd}`);
    }
    return new Money(Math.round(usd * 100));
  }

  public get cents(): number {
    return this.amountCents;
  }

  public get usd(): number {
    return Number((this.amountCents / 100).toFixed(2));
  }

  public add(other: Money): Money {
    return new Money(this.amountCents + other.amountCents);
  }

  public subtract(other: Money): Money {
    const result = this.amountCents - other.amountCents;
    return new Money(Math.max(0, result));
  }

  public multiplyByQuantity(quantity: number): Money {
    if (!Number.isInteger(quantity) || quantity <= 0) {
      throw new Error(`La cantidad debe ser un entero positivo. Recibido: ${quantity}`);
    }
    return new Money(this.amountCents * quantity);
  }

  /**
   * Calcula el descuento aplicando un porcentaje (0..100) con redondeo comercial Half-Up al centavo más cercano.
   */
  public allocatePercentage(percentage: number): Money {
    if (!Number.isFinite(percentage) || percentage < 0 || percentage > 100) {
      throw new Error(`Porcentaje fuera de rango [0..100]: ${percentage}`);
    }
    const rawCents = (this.amountCents * percentage) / 100;
    return new Money(Math.round(rawCents));
  }

  public isGreaterThan(other: Money): boolean {
    return this.amountCents > other.amountCents;
  }

  public equals(other: Money): boolean {
    return this.amountCents === other.amountCents;
  }
}
