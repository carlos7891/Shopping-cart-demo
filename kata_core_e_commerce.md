# PRUEBA TÉCNICA FULL STACK: "Core E-Commerce con Sistema de Descuentos Acumulativos"

**Duración:** 20 minutos de sustentación en vivo.  
**Modalidad:** Repositorio público GitHub + Exposición en vivo de la solución.  
**Contexto:** El candidato deberá diseñar y construir un producto mínimo viable (MVP) de una sección de pago (checkout) en un e-commerce que cuente con un backend para calcular y persistir transacciones y un frontend para que el usuario interactúe con el carrito de compras. El principal reto reside en implementar un motor de descuentos acumulativos con consistencia, modularidad y una rigurosa gobernanza asistida por Inteligencia Artificial.

---

## 1. Objetivo

Construir una aplicación Full Stack modular (Frontend + Backend) funcional que permita gestionar un carrito de compras y aplicar un motor de descuentos acumulativos de manera confiable. Esta prueba evalúa el criterio de ingeniería del desarrollador sobre la cantidad de código: la elección y fundamentación de la arquitectura, patrones de diseño aplicados para el desacoplamiento, robustez del tipado, modularidad de los componentes y calidad en la estrategia de pruebas con un umbral mínimo exigente de cobertura (80%). Adicionalmente, se audita activamente la capacidad del candidato para gobernar e interactuar conscientemente con herramientas de Inteligencia Artificial Generativa.

---

## 2. El Problema (Caso de Negocio)

### "Core E-Commerce Checkout with Cumulative Discounts"

El área de negocios requiere una pasarela o módulo de checkout que incentive compras combinadas mediante un esquema de descuentos acumulativos. Sin embargo, para proteger el margen de ganancia de la tienda, la acumulación de descuentos posee reglas de prioridad secuenciales y un límite absoluto infranqueable.

### Reglas de Negocio para Descuentos Acumulativos

El backend debe calcular los descuentos del subtotal original de manera secuencial (multiplicativa en cascada, no simplemente sumados) aplicando el siguiente orden de precedencia:

1. **Descuento de Categoría:** Si la orden contiene al menos un producto de la categoría "Tecnología", se aplica un 10% de descuento sobre el precio de esos productos específicos de la categoría.
2. **Descuento por Volumen:** Si el subtotal de la compra (después de aplicar el Descuento de Categoría) supera los \$100 USD, se aplica un 5% de descuento adicional sobre todo el carrito.
3. **Descuento por Cupón:** Si el usuario ingresa el código de cupón promocional activo `"WELCOME2026"`, se le aplicará un 15% de descuento adicional sobre el total obtenido tras la regla 2.
4. **Límite de Descuento Absoluto:** Bajo ninguna circunstancia el descuento total consolidado puede superar el 35% del valor total original de los productos agregados. Si el cálculo matemático de descuentos acumulados resulta en un porcentaje de descuento mayor al 35%, el motor debe truncar el descuento total exactamente en el 35% y calcular el monto final a pagar sobre ese límite.

### Historias de Usuario Mínimas

* **[HU 1 - Gestión del Carrito (Frontend)]:** Como cliente de la tienda, quiero ver la lista de productos pre-configurados (con id, nombre, precio unitario, categoría y stock inicial) y agregarlos o removerlos de un carrito en tiempo real, de manera que el subtotal original se actualice de inmediato en la pantalla.
* **[HU 2 - Aplicación Dinámica de Cupón y Visualización de Desglose (Frontend)]:** Como cliente, quiero ingresar el código de un cupón y presionar "Aplicar" para ver en pantalla el desglose detallado de los descuentos calculados (Descuento de Categoría, Descuento por Volumen y Descuento por Cupón), el porcentaje de descuento efectivo aplicado, el ahorro total y el valor final a pagar.
* **[HU 3 - Procesamiento Consistente de la Orden (Backend)]:** Como API REST de la aplicación, quiero recibir una petición de checkout con los elementos del carrito y el código del cupón, validar la existencia del stock en memoria, re-calcular con precisión el motor de descuentos acumulativos aplicando las precedencias y el tope del 35%, decrementar el stock de los productos comprados, persistir la orden (en memoria, SQLite o JSON) y retornar la confirmación con los totales desglosados exactos.
* **[HU 4 - Alerta de Descuento Límite Alcanzado (UI Reactiva)]:** Como cliente, si la combinación de mis productos y el cupón superan el límite del 35% de descuento, quiero que el frontend me muestre una notificación visual persistente y distintiva indicando: *"¡Enhorabuena! Has alcanzado el límite máximo de ahorro permitido (35%)"*.

---

## 3. Estructura de Entrega

El proyecto se estructurará como un Monorepo dentro de un único repositorio público de GitHub:

```text
examen-ecommerce/
├── apps/
│   ├── backend/               # API / Servidor (Node.js/Express/NestJS, Python, Java o similar)
│   └── frontend/              # Aplicación Web (React o Angular)
├── packages/                  # [OPCIONAL] Lógica o contratos de tipado y validación compartidos
├── docs/
│   ├── arquitectura.md        # Justificación de arquitectura, decisiones y patrones aplicados
│   └── ia.md                  # Documentación obligatoria de la co-creación y gobernanza con IA
└── README.md                  # Guía de instalación rápida y comandos para pruebas unitarias
```

### Resumen de Evaluación por Componente

| Componente | Descripción | Pruebas Unitarias | Uso de IA (Skills/Agents) | ¿Se evalúa? |
| :--- | :--- | :--- | :--- | :--- |
| **apps/backend/** | API backend que valida stock, aplica lógica de negocio de descuentos y persiste órdenes. | Obligatorias (mín. 80%) | Obligatorio | Sí |
| **apps/frontend/** | Interfaz reactiva modular de carrito de compras, checkout con desglose y notificación visual. | Obligatorias (mín. 80%) | Obligatorio | Sí |
| **packages/** | Carpeta o submódulo opcional de recursos compartidos (ej: DTOs, validadores, utilidades de cálculo). | Obligatorias (si existe) | Opcional | Opcional |

---

## 4. Requisitos Técnicos Obligatorios

### 4.1. Arquitectura y Criterio de Diseño (Flexible)

* No se impone una estructura rígida de frameworks. El candidato es libre de elegir el stack que considere más adecuado (ej: Express.js / NestJS / FastAPI / SpringBoot / Quarkus + React / Angular).
* El candidato debe estructurar el código de forma modular y con clara separación de responsabilidades.
* **Obligatoriedad de `docs/arquitectura.md`:** Debe responder de manera justificada:
  * ¿Por qué seleccionó ese stack tecnológico y diseño de carpetas para el problema?
  * ¿Qué trade-offs de arquitectura asumió (ej. simplicidad vs. extensibilidad, rendimiento de cálculo vs. velocidad de entrega)?
  * ¿Cómo aisló las reglas matemáticas del motor de descuentos de los detalles de persistencia y controladores de la API?
  * Describir e implementar explícitamente en el código al menos dos patrones de diseño (ej. Strategy para el cálculo de los diferentes tipos de descuento, Factory para instanciar las reglas, Observer para el carrito de compras, o Adapter).

### 4.2. Tipado Estricto y Comunicación

* Tipado estricto de extremo a extremo sin admitir declaraciones genéricas como `any` sin su respectiva justificación técnica.
* Comunicación mediante llamadas REST (o GraphQL / WebSockets si decide agregar valor adicional) con contratos limpios para el envío y respuesta del carrito.

### 4.3. Pruebas Unitarias y Cobertura

* Cobertura de pruebas unitarias obligatoria de al menos el 80% en las capas lógicas esenciales del Frontend (manejo de estado del carrito, validación visual de alertas) y del Backend (motor de descuentos acumulados, validaciones de stock).
* Es imperativo escribir pruebas para los casos de borde (edge cases):
  * Límite exacto del 35% de descuento superado.
  * Carritos vacíos o con datos corruptos.
  * Cupones de descuento no registrados o expirados.
  * Intentos de compra de productos sin stock suficiente.

---

## 5. Gobernanza de IA (`docs/ia.md` - Obligatorio)

Está permitido y es evaluable el uso de copilotos y asistentes (Cursor, Copilot, ChatGPT, Claude, etc.). Se medirá el rol del candidato como auditor del código entregado. El archivo `docs/ia.md` debe contener:

1. **Skills/Prompts Automatizados:** Descripción detallada de al menos 1 prompt estructurado o skill creado por el candidato para automatizar tareas (ej. generación automatizada de mocks de pruebas unitarias para el backend).
2. **Agents / Sub-agentes:** Explicación de al menos un agente con rol y reglas específicas configurado en su entorno (ej. un auditor de código seguro o validador de cobertura de pruebas).
3. **Bitácora de Co-creación:**
   * Detalle de qué porcentaje del código fue sugerido por IA y qué lógica crítica fue implementada manualmente por el desarrollador.
   * Mínimo dos ejemplos concretos de sugerencias de la IA que el candidato rechazó o corrigió debido a criterios técnicos de ingeniería (ej. algoritmos ineficientes en cascada de descuentos, tipados incorrectos o pruebas unitarias mal planteadas).

---

## 6. Dinámica de Sustentación (20 Minutos)

El tiempo es estricto y se dividirá en:

* **7 minutos - Demostración en vivo (Demo):** Interacción funcional con la interfaz, adición de productos, superación de stock, aplicación del cupón `"WELCOME2026"` para desencadenar el cálculo secuencial, visibilidad en tiempo real del límite máximo de descuento (35%) y confirmación de la persistencia de la orden desde el backend.
* **7 minutos - Defensa de la Arquitectura:** Exposición de los patrones de diseño aplicados, justificación de las decisiones documentadas en `docs/arquitectura.md`, explicación de la estrategia y modularidad del código para aislar las reglas de descuento, y verificación en consola del cumplimiento del 80% de cobertura de pruebas.
* **6 minutos - Auditoría de IA y Preguntas Técnicas:** Defensa del contenido de `docs/ia.md`, demostración de los prompts/agentes utilizados y justificación de por qué se corrigieron las sugerencias erróneas de la IA frente a la mesa evaluadora.

---

## 7. Checklist de Entrega

- [ ] Repositorio en GitHub público con un historial de commits descriptivo e incremental.
- [ ] Backend operativo que valide stock y aplique de forma estricta las reglas de descuentos secuenciales y el límite del 35%.
- [ ] Frontend interactivo y responsivo que consuma los endpoints del backend, maneje reactivamente el carrito y muestre la alerta visual del 35%.
- [ ] Archivo `docs/arquitectura.md` con las justificaciones de diseño detallado, trade-offs y patrones descritos.
- [ ] Archivo `docs/ia.md` completo con los prompts/agentes y las dos correcciones realizadas a la IA.
- [ ] Cobertura mínima del 80% en pruebas unitarias/integración de front y back con comandos de ejecución claros.
- [ ] `README.md` principal con instrucciones completas de instalación, configuración, variables de entorno y comandos para correr el proyecto y pruebas.