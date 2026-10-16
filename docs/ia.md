# Gobernanza, Auditoría y Co-Creación con Inteligencia Artificial (`docs/ia.md`)

Este documento detalla la estrategia de **Gobernanza de IA Generativa** aplicada durante el diseño, construcción y auditoría del proyecto **Core E-Commerce con Sistema de Descuentos Acumulativos**. El desarrollador actuó como **Arquitecto y Auditor Humano (Human-in-the-Loop)** apoyándose en **Skills automatizados**, **4 Subagentes Especializados** y un flujo estricto de revisión mediante **Pull Requests**.

---

## 1. Skills / Prompts Estructurados Creados por el Candidato

Los Skills fueron codificados dentro del repositorio en `.agents/skills/` para estandarizar la generación de pruebas de frontera y la verificación de seguridad/arquitectura antes de cada entrega:

### 1.1. Skill 1: Generador de Matrices de Casos de Borde en Cascada (`.agents/skills/cascade-discount-test-matrix/SKILL.md`)
- **Objetivo:** Automatizar la generación de casos de prueba parametrizados aplicando *Boundary Value Analysis (BVA)* sobre reglas de descuento secuenciales en cascada y aritmética en centavos enteros.
- **Estructura del Prompt / Reglas del Skill:**
  1. Exige evaluar la diferencia matemática entre descuento aditivo ($10\% + 5\% + 15\% = 30\%$) y descuento multiplicativo en cascada ($1 - 0.90 \times 0.95 \times 0.85 = 27.325\% \approx 27.33\%$).
  2. Fuerza la generación de los escenarios `BVA-01` a `BVA-08`: carrito vacío, frontera exacta de volumen en $\$100.00\text{ USD}$ (`10000` ¢, no aplica) vs. $\$100.01\text{ USD}$ (`10001` ¢, sí aplica), caída de subtotal bajo $\$100.00$ tras aplicar el descuento de categoría, tope exacto del $35.00\%$, superación del tope ($>35\%$) con truncamiento y emisión del mensaje de la **HU 4**, cupones inválidos/expirados/inactivos y fallo por stock insuficiente.

### 1.2. Skill 2: Checklist de Seguridad AppSec, SOLID y Pureza Hexagonal (`.agents/skills/security-solid-checklist/SKILL.md`)
- **Objetivo:** Auditar automáticamente cada módulo antes de abrir un Pull Request verificando:
  - **Anti-Price Tampering (OWASP API3):** El cliente solo puede enviar `{ productId, quantity }` y `couponCode`.
  - **Pureza Hexagonal:** Cero imports de `@nestjs/*`, `express` o `sql.js` dentro de `apps/backend/src/domain/`.
  - **Tipado Estricto:** Prohibición absoluta de `any` y obligatoriedad de `Money` Value Object en centavos enteros.

---

## 2. Ecosistema de Subagentes Especializados Configurados

Se definieron e invocaron en tiempo de ejecución **4 Subagentes con roles, prompts de sistema y restricciones específicas** (documentados también en `.agents/agents/README.md`). Ningún Pull Request fue fusionado a `main` sin el dictamen aprobatorio de estos subagentes:

| Subagente | Rol Asignado | Reglas de Auditoría y Intervención en PRs |
| :--- | :--- | :--- |
| **`security-and-validation-auditor`** | Auditor Senior AppSec y Validaciones Financieras | Auditó **PR #1** y **PR #3**. Verificó listas blancas en `validateCartRequest`, bloqueo de inyección SQL en cupones (`COUPON_REGEX`), sentencias SQL 100% parametrizadas (`?`), transacciones ACID (`BEGIN TRANSACTION ... COMMIT/ROLLBACK`) y recomendó añadir `getRowsModified() === 1` tras el `UPDATE` de stock. |
| **`backend-hexagonal-architect`** | Arquitecto Backend NestJS, DDD Táctico y SOLID | Auditó **PR #2** y **PR #3**. Verificó que `domain/` tuviera 0 dependencias de infraestructura, validó los patrones **Strategy**, **Factory**, **Value Object**, **Policy** y **Adapter**, y comprobó la segregación e inversión de dependencias en los 3 puertos (`PRODUCT_REPOSITORY_PORT`, `ORDER_REPOSITORY_PORT`, `RULE_CONFIG_REPOSITORY_PORT`). |
| **`frontend-angular-specialist`** | Especialista Angular 18+ (Signals, Observer & UI/UX) | Auditó **PR #4**. Verificó el patrón **Observer** reactivo con `signal()` y `computed()`, cumplimiento de **HU 1, HU 2, HU 4**, cero warnings en `ng build` (`strictTemplates: true`) y propuso mostrar un indicador visual explícito con `couponStatus` junto a los chips de cupón. |
| **`qa-coverage-gatekeeper`** | Auditor de Calidad, Edge Cases y Cobertura ($\ge 80\%$) | Auditó **PR #1, PR #2, PR #3 y PR #4**. Verificó que Vitest tuviera `thresholds: 80` activos y auditó las métricas alcanzadas: `95.08%` en `shared`, `96.57%` en `backend` (con `99.54%` en `domain`) y `96.26%` en `frontend`. |

---

## 3. Bitácora de Co-Creación y Auditoría Humana

### 3.1. Distribución de Esfuerzo (IA vs. Criterio e Implementación del Desarrollador)
- **Código base, scaffolding, boilerplate de DTOs y plantillas de pruebas (~65% asistido por IA):** Generación acelerada de estructuras de archivos, estilos CSS responsivos, configuración de workspaces y esqueletos de suites de pruebas bajo la dirección de los Skills.
- **Diseño arquitectónico, reglas críticas de negocio, invariantes matemáticas y auditoría de PRs (~35% definido, corregido y gobernado por el Desarrollador):**
  - Definición de la matemática exacta en cascada en centavos enteros y detección de la imposibilidad matemática de superar el 35% con valores fijos ($27.33\%$ máx), diseñando la solución del panel `/admin` ("Rule Engine Studio").
  - Diseño de la transacción ACID en SQLite y validación de casos de frontera.
  - Revisión y aprobación manual de los 5 Pull Requests en GitHub.

### 3.2. Registro de Sugerencias de la IA Rechazadas / Corregidas por Criterio de Ingeniería (Mínimo 2 exigidas — Se documentan 4 casos reales)

#### Corrección Técnica #1: Error de Redondeo IEEE-754 con `Number.toFixed(2)` en el Porcentaje Efectivo de Cascada (`27.325% -> 27.32%` en lugar de `27.33%`)
- **Contexto:** Al calcular un producto de `Tecnología` de $\$200.00\text{ USD}$ (`20000` ¢) con las 3 reglas en cascada ($10\% \rightarrow 5\% \rightarrow 15\%$), el descuento total es de `5465` centavos ($\$54.65\text{ USD}$), que equivale exactamente al $27.325\%$ de $\$200.00$.
- **Sugerencia inicial de la IA:** En la primera versión de `MaxDiscountCapPolicy`, la IA sugirió calcular el porcentaje efectivo con `Number(((effectiveTotalDiscount.cents / originalSubtotal.cents) * 100).toFixed(2))`.
- **Fallo detectado en las pruebas:** En el motor V8 de Node.js, el literal `27.325` se representa en binario IEEE-754 como `27.32499999999999928946...`, por lo que `.toFixed(2)` redondeó hacia abajo devolviendo **`27.32%`** en vez del redondeo financiero *Half-Up* correcto (**`27.33%`**).
- **Corrección aplicada (`apps/backend/src/domain/discounts/max-discount-cap.policy.ts`):** Se rechazó el uso de `.toFixed(2)` para cálculos intermedios y se reemplazó por aritmética escalada a puntos base enteros:
  ```typescript
  Math.round((effectiveTotalDiscount.cents / originalSubtotal.cents) * 10000) / 100
  ```
  Esto garantizó que $5465 / 20000$ produzca determinísticamente **`27.33%`**.

#### Corrección Técnica #2: Imposibilidad de Alcanzar el Tope del 35% con Porcentajes Fijos vs. Parametrización Dinámica (`/admin`)
- **Sugerencia común / ingenua:** Codificar los porcentajes ($10\%$, $5\%$, $15\%$) como constantes estáticas privadas dentro de cada clase de estrategia y asumir que al combinarlos se alcanzaría el límite del 35% de la **HU 4**.
- **Auditoría de Ingeniería:** Incluso si los descuentos se sumaran erróneamente ($10\% + 5\% + 15\% = 30\%$), tampoco llegarían al $35\%$; y en cascada real el máximo es **$27.33\%$**. Dejar valores estáticos habría impedido demostrar la **HU 4** en vivo durante los 7 minutos de sustentación.
- **Corrección aplicada:** Se diseñó `DiscountRuleFactory` para recibir un contrato dinámico `DiscountRulesConfigDto` persistido en SQLite y administrable en vivo desde la ruta `/admin` (**Rule Engine Studio**), además de incluir el cupón `VIP50` (30%) y el preset `DEMO_CAP_35` para demostrar en 1 clic el truncamiento exacto al 35%.

#### Corrección Técnica #3: Aislamiento Transaccional ACID y Verificación de Filas Afectadas contra Sobreventa (*Overselling*)
- **Sugerencia inicial:** Validar el stock en memoria en el servicio de aplicación, y luego ejecutar un bucle de `UPDATE products SET stock = stock - ?` seguido de `INSERT INTO orders` sin verificar si la fila fue efectivamente modificada dentro de una transacción.
- **Riesgo detectado (con apoyo de `security-and-validation-auditor`):** Si el segundo o tercer ítem del carrito fallaba por falta de stock a mitad del bucle, los primeros ítems quedaban con su inventario descontado sin haberse creado la orden.
- **Corrección aplicada (`apps/backend/src/infrastructure/persistence/sqlite-persistence.adapter.ts`):** Se envolvió todo el proceso en una transacción explícita `BEGIN TRANSACTION ... COMMIT / ROLLBACK`, se añadió la restricción `CHECK (stock >= 0)` en el esquema SQL, la cláusula `WHERE id = ? AND stock >= ?` en el `UPDATE` y la validación defensiva `if (this.db.getRowsModified() !== 1) throw new DomainException('INSUFFICIENT_STOCK', ...)`. Se escribió un test de integración específico que comprueba que el stock del primer producto permanece intacto cuando falla el segundo.

#### Corrección Técnica #4: Eliminación de Warnings del Compilador AOT de Angular (`NG8102`) y Visibilidad del Estado del Cupón
- **Sugerencia inicial de la IA:** En la plantilla de `CheckoutPageComponent`, se utilizó `(store.quantitiesByProductId()[product.id] ?? 0)` y no se mostraba el estado explícito cuando un cupón era rechazado por expiración (`EXPIRED`).
- **Auditoría (`ng build` + `frontend-angular-specialist`):** El compilador estricto de Angular (`strictTemplates: true`) emitió advertencias `NG8102` sobre el operador `??`, y el subagente especialista señaló que el usuario necesitaba ver el estado `APPLIED | EXPIRED | INVALID_CODE` junto al selector de cupones.
- **Corrección aplicada:** Se encapsuló la lectura segura en `store.getProductQuantity(product.id)` logrando un build de producción con **0 warnings**, y se añadió el indicador reactivo de `couponStatus` en la tarjeta de cupones.
