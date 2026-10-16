# Core E-Commerce con Sistema de Descuentos Acumulativos en Cascada

Aplicación Full Stack modular (**Angular 18+ Signals** + **NestJS Hexagonal** + **SQLite Transaccional ACID**) que implementa un motor de descuentos acumulativos en cascada con precedencia estricta, límite absoluto infranqueable del **35%**, panel de administración en vivo (`/admin`) y gobernanza asistida por Inteligencia Artificial.

---

## 📁 Estructura del Monorepo

```text
Shopping-cart-demo/
├── apps/
│   ├── backend/               # API NestJS con Arquitectura Hexagonal + SQLite ACID
│   │   └── src/
│   │       ├── domain/        # Motor puro: Money VO, Strategy, Factory y Cap Policy (35%)
│   │       ├── application/   # Casos de uso y Puertos (ISP / DIP)
│   │       └── infrastructure/# Adaptador SQLite ACID, Controladores REST y Exception Filter
│   └── frontend/              # Aplicación Web Angular 18+ (Standalone + Signals)
│       └── src/app/
│           ├── state/         # CartStoreService (Patrón Observer reactivo con Signals)
│           ├── pages/checkout/# Tienda, Carrito, Desglose en cascada y Alerta 35% (HU 1-4)
│           └── pages/admin/   # Rule Engine Studio (/admin) con presets en vivo
├── packages/
│   └── shared/                # Contratos DTO estrictos y validadores Anti-Tampering (DRY)
├── docs/
│   ├── arquitectura.md        # Defensa de arquitectura, SOLID/DRY, Patrones y SQL vs NoSQL
│   └── ia.md                  # Gobernanza de IA: Skills, 4 Subagentes y Bitácora de Co-creación
├── .agents/                   # Definición de Skills y Subagentes Auditores del proyecto
└── README.md                  # Guía de instalación, ejecución y pruebas unitarias (>=80%)
```

---

## 🚀 Requisitos Previos e Instalación Rápida

- **Node.js:** `>= 20.0.0`
- **npm:** `>= 10.0.0`

1. Clonar el repositorio e instalar todas las dependencias del monorepo desde la raíz:

```bash
npm install
```

2. Compilar el paquete compartido y los proyectos:

```bash
npm run build
```

---

## 🖥️ Ejecución del Proyecto (Backend + Frontend)

Abre dos terminales en la raíz del repositorio:

### Terminal 1 — Levantar Backend API (Puerto `3000`)
```bash
npm run start:backend
```
> La API estará disponible en `http://localhost:3000/api` e inicializará automáticamente la base de datos relacional SQLite en `apps/backend/data/ecommerce.sqlite` con el catálogo y reglas semilla.

### Terminal 2 — Levantar Frontend Angular (Puerto `4200`)
```bash
npm run start:frontend
```
> Abre en tu navegador:
> - **Tienda y Checkout:** `http://localhost:4200/checkout`
> - **Rule Engine Studio (Panel Admin):** `http://localhost:4200/admin`

---

## 🧪 Ejecución de Pruebas Unitarias y Verificación de Cobertura ($\ge 80\%$)

Todos los módulos tienen configurado un umbral mínimo bloqueante del **80%** en Vitest (`statements`, `branches`, `functions`, `lines`).

Para ejecutar **todas las pruebas y reportes de cobertura del monorepo** con un solo comando:

```bash
npm run test:coverage
```

También puedes ejecutar cada workspace de forma individual:

```bash
# 1. Paquete compartido (@shopping-cart/shared) -> ~95.08% cobertura
npm run test:shared

# 2. Backend NestJS + Dominio + SQLite ACID (@shopping-cart/backend) -> ~96.57% cobertura
npm run test:backend

# 3. Frontend Angular Signals (@shopping-cart/frontend) -> ~96.26% cobertura
npm run test:frontend
```

---

## 🧮 Reglas de Negocio en Cascada y Cómo Demostrar el Tope del 35% (HU 4)

El motor calcula los descuentos de manera **secuencial multiplicativa en cascada** (operando en centavos enteros mediante el Value Object `Money`):

1. **Descuento de Categoría (Precedencia 1):** `10%` sobre productos de la categoría `"Tecnología"`.
2. **Descuento por Volumen (Precedencia 2):** Si el subtotal remanente tras la Regla 1 supera estrictamente los `$100.00 USD`, aplica un `5%` adicional sobre todo el carrito.
3. **Descuento por Cupón (Precedencia 3):** Con el cupón `"WELCOME2026"` aplica un `15%` adicional sobre el subtotal obtenido tras la Regla 2.
4. **Límite de Descuento Absoluto (Precedencia 4 - Tope 35%):** Ningún descuento acumulado puede superar el **35%** del subtotal original. Si lo supera, se trunca exactamente en el **35%** y el frontend muestra la alerta persistente de la **HU 4**:
   > *"¡Enhorabuena! Has alcanzado el límite máximo de ahorro permitido (35%)"*

### Nota Matemática para la Demo en Vivo
Con los porcentajes base ($10\% \rightarrow 5\% \rightarrow 15\%$), el descuento máximo teórico en cascada es $1 - (0.90 \times 0.95 \times 0.85) = \mathbf{27.33\%}$. Para activar y demostrar en vivo el límite del **35%** tienes dos opciones inmediatas en la interfaz:
1. En `/checkout`, hacer clic en el chip rápido **`VIP50 (30% - Tope 35%)`**, o
2. Ir a **`/admin` (Rule Engine Studio)** y presionar el botón **`Activar Preset Demo Tope >35%`**, que eleva los porcentajes para que incluso con `"WELCOME2026"` se supere y trunque exactamente en el **35%**.

---

## 📚 Documentación Obligatoria

- [**Defensa de Arquitectura (`docs/arquitectura.md`)**](./docs/arquitectura.md): Justificación del stack Angular + NestJS Hexagonal, comparativa Base de Datos Relacional (SQLite ACID) vs. NoSQL, principios SOLID/DRY y patrones de diseño (**Strategy**, **Factory**, **Adapter**, **Observer**).
- [**Gobernanza de IA (`docs/ia.md`)**](./docs/ia.md): Detalle de los **2 Skills**, los **4 Subagentes Especializados** y la **Bitácora de Co-Creación** con las correcciones técnicas aplicadas a la IA.
