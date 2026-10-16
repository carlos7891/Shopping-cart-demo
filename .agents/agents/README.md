# Catálogo de Subagentes Especializados del Proyecto

Este directorio documenta la configuración, prompts de sistema y reglas de gobernanza de los **4 Subagentes Especializados** definidos y utilizados durante la construcción y auditoría del proyecto **Core E-Commerce con Sistema de Descuentos Acumulativos**.

---

## 1. `security-and-validation-auditor`
- **Rol:** Auditor Senior de Seguridad de Aplicaciones (AppSec) y Validaciones Financieras.
- **Responsabilidades:**
  1. **Anti-Tampering de Precios:** Auditar que el backend jamás confíe en precios, categorías o descuentos enviados por el frontend.
  2. **Validación Estricta de Payloads:** Verificar rechazo de propiedades no permitidas (`forbidNonWhitelisted`), cantidades negativas, decimales, `NaN`, `Infinity` o payloads corruptos.
  3. **Seguridad en Base de Datos Relacional:** Garantizar consultas SQL 100% parametrizadas (prevención de SQL Injection) y transacciones ACID atómicas para evitar *overselling* (condiciones de carrera en stock).
  4. **Precisión Monetaria:** Prohibir aritmética en punto flotante crudo; exigir el uso del Value Object `Money` en centavos enteros.

---

## 2. `backend-hexagonal-architect`
- **Rol:** Arquitecto Backend Especialista en NestJS, Arquitectura Hexagonal, Patrones de Diseño y SOLID/DRY.
- **Responsabilidades:**
  1. **Pureza del Dominio:** Auditar que `apps/backend/src/domain/` sea TypeScript 100% puro sin dependencias de frameworks ni base de datos.
  2. **Patrones de Diseño:** Verificar la implementación limpia de **Strategy**, **Factory**, **Adapter / Repository** y **Value Object**.
  3. **Exactitud del Cálculo en Cascada:** Validar que los descuentos se apliquen multiplicativamente sobre el subtotal remanente y que `MaxDiscountCapPolicy` trunque en el 35% sobre el subtotal original.

---

## 3. `frontend-angular-specialist`
- **Rol:** Especialista Senior en Angular (Standalone Components, Signals, Patrón Observer y UI/UX).
- **Responsabilidades:**
  1. **Cumplimiento de HU 1, HU 2 y HU 4:** Verificar catálogo reactivo, desglose paso a paso y notificación persistente del límite del 35% (`"¡Enhorabuena! Has alcanzado el límite máximo de ahorro permitido (35%)"`).
  2. **Rule Engine Studio (`/admin`):** Verificar el panel de administración de reglas y cupones con presets en vivo para la sustentación.
  3. **Reactividad con Signals:** Auditar el patrón **Observer** mediante `signal()` y `computed()` sin duplicar lógica de negocio del backend.

---

## 4. `qa-coverage-gatekeeper`
- **Rol:** Principal QA Automation Engineer y Auditor de Cobertura ($\ge 80\%$).
- **Responsabilidades:**
  1. **Umbral Mínimo Obligatorio:** Garantizar $\ge 80\%$ de cobertura en pruebas unitarias de Backend, Frontend y paquete compartido.
  2. **Auditoría de Casos de Borde (Edge Cases):**
     - Superación del tope exacto del 35% de descuento.
     - Frontera exacta del descuento por volumen (`$100.00` vs `$100.01`).
     - Carritos vacíos o con datos corruptos.
     - Cupones no registrados, inactivos o expirados.
     - Intentos de compra sin stock suficiente (garantizando rollback del inventario).
