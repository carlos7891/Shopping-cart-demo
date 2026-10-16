---
name: security-solid-checklist
description: Checklist automatizado de seguridad bancaria (AppSec OWASP API), principios SOLID, DRY y pureza de Arquitectura Hexagonal antes de cada commit.
---

# Skill: Security, SOLID & Hexagonal Architecture Checklist

## Propósito
Garantizar que cada módulo del monorepo (`packages/shared`, `apps/backend`, `apps/frontend`) cumpla con los estándares de ingeniería financiera antes de hacer commit/push.

## 1. Verificación de Principios SOLID y DRY
- **[S] Single Responsibility:** Cada estrategia de descuento (`CategoryDiscountStrategy`, `VolumeDiscountStrategy`, `CouponDiscountStrategy`) calcula únicamente su paso en el pipeline.
- **[O] Open/Closed:** `CumulativeDiscountEngine` itera sobre una colección de `DiscountStrategy[]` inyectada por `DiscountRuleFactory`; agregar una nueva regla no modifica el motor.
- **[L] Liskov Substitution:** Todas las estrategias implementan el mismo contrato determinista `DiscountStrategy`.
- **[I] Interface Segregation:** Puertos separados (`ProductRepositoryPort`, `OrderRepositoryPort`, `RuleConfigRepositoryPort`).
- **[D] Dependency Inversion:** Los casos de uso dependen de abstracciones (Puertos), nunca de SQLite o Express directamente.
- **[DRY] Don't Repeat Yourself:** DTOs, tipos de respuesta y constantes viven en `@shopping-cart/shared`.

## 2. Verificación de Seguridad (AppSec & FinTech Guardrails)
- **Anti-Price Tampering:** El payload de `/api/cart/quote` y `/api/checkout` solo acepta `{ productId, quantity }` y `couponCode`. El precio unitario y la categoría se consultan siempre del servidor.
- **Validación de Entradas:** Uso de validadores estrictos (rechazo de campos desconocidos, cantidades enteras positivas `1 <= qty <= 999`, sanitización `trim().toUpperCase()` en cupones).
- **Integridad Relacional ACID:** Las órdenes se procesan dentro de una transacción atómica; si un ítem no tiene stock suficiente, ningún producto del carrito ve afectado su inventario.
- **Cero Punto Flotante Crudo:** Todos los cálculos internos operan con centavos enteros (`Money` Value Object).
- **Tipado Estricto:** Prohibido el uso de `any` en todo el monorepo.
