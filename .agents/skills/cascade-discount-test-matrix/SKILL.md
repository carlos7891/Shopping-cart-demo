---
name: cascade-discount-test-matrix
description: Genera matrices exhaustivas de pruebas unitarias parametrizadas y casos de frontera (Boundary Value Analysis) para motores de descuentos acumulativos en cascada con tope máximo (35%).
---

# Skill: Cascade Discount Test Matrix Generator

## Propósito
Automatizar el diseño y generación de pruebas unitarias de alta precisión para el motor de descuentos en cascada (`CumulativeDiscountEngine`), garantizando el cumplimiento del **80%+ de cobertura** y la validación matemática en **centavos enteros**.

## Reglas de Dominio que este Skill Verifica
1. **Precedencia Estricta en Cascada (Multiplicativa, NO Aditiva):**
   - **Regla 1 (Categoría):** `categoryDiscountCents = round(techSubtotalCents * categoryRate)`
   - **Subtotal 1:** `subtotalAfterCategoryCents = originalSubtotalCents - categoryDiscountCents`
   - **Regla 2 (Volumen):** Si `subtotalAfterCategoryCents > volumeThresholdCents` (estricto `>`), `volumeDiscountCents = round(subtotalAfterCategoryCents * volumeRate)`
   - **Subtotal 2:** `subtotalAfterVolumeCents = subtotalAfterCategoryCents - volumeDiscountCents`
   - **Regla 3 (Cupón):** Si el cupón es válido, activo y no expirado, `couponDiscountCents = round(subtotalAfterVolumeCents * couponRate)`
   - **Regla 4 (Tope Infranqueable 35%):** `maxAllowedDiscountCents = round(originalSubtotalCents * maxCapRate)`. Si `rawTotalDiscountCents > maxAllowedDiscountCents`, se trunca exactamente a `maxAllowedDiscountCents` y se activa `capReached = true`.

## Plantilla de Matriz de Casos de Borde Obligatorios (Boundary Value Analysis)

Al generar o auditar pruebas del motor, SIEMPRE se deben incluir estos escenarios parametrizados:

| ID Caso | Escenario | Entrada Clave | Resultado Esperado |
| :--- | :--- | :--- | :--- |
| `BVA-01` | Carrito vacío | `items = []` | Error tipado `EMPTY_CART` o subtotal 0 |
| `BVA-02` | Sin Tecnología, bajo umbral | Subtotal `$100.00` (`10000` ¢) exacto | `volumeDiscount = 0` (debe superar `$100.00`) |
| `BVA-03` | Frontera exacta de volumen | Subtotal post-categoría `$100.01` (`10001` ¢) | `volumeDiscount` aplicado (5%) |
| `BVA-04` | Cascada completa oficial | Tech `$200.00` + `WELCOME2026` | Paso 1: `-$20.00` (`$180.00`) -> Paso 2: `-$9.00` (`$171.00`) -> Paso 3: `-$25.65` (`$145.35`). Total desc: `$54.65` (`27.33%`), `capReached = false` |
| `BVA-05` | Tope exacto 35.00% | Reglas configuradas dan exactamente `35.00%` | No trunca monto pero reporta `effectiveDiscountPercentage = 35` |
| `BVA-06` | Superación del tope (>35%) | Reglas/Cupón acumulan `>35%` (ej. `42%`) | Trunca descuento exactamente a `35%` del subtotal original, `capReached = true` |
| `BVA-07` | Cupón no registrado / expirado | `INVALID99` / `EXPIRED2024` | `couponDiscount = 0`, `couponStatus = 'INVALID' | 'EXPIRED'` |
| `BVA-08` | Stock insuficiente | `quantity > product.stock` | Rechaza checkout con `INSUFFICIENT_STOCK` y mantiene stock intacto |
