import { ProductCategory } from '@shopping-cart/shared';

export interface SeedProductRecord {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly priceCents: number;
  readonly category: ProductCategory;
  readonly stock: number;
}

export const INITIAL_PRODUCTS_SEED: readonly SeedProductRecord[] = [
  {
    id: 'prod-tech-laptop',
    name: 'Laptop Pro Developer 16"',
    description: 'Workstation de alto rendimiento (Categoría Tecnología - aplica 10% inicial)',
    priceCents: 120000, // $1,200.00 USD
    category: 'Tecnología',
    stock: 5
  },
  {
    id: 'prod-tech-monitor',
    name: 'Monitor UltraWide 34" 4K',
    description: 'Panel IPS calibrado para ingeniería y diseño (Categoría Tecnología)',
    priceCents: 20000, // $200.00 USD
    category: 'Tecnología',
    stock: 8
  },
  {
    id: 'prod-tech-keyboard',
    name: 'Teclado Mecánico Wireless RGB',
    description: 'Switches táctiles silenciosos (Categoría Tecnología)',
    priceCents: 8500, // $85.00 USD
    category: 'Tecnología',
    stock: 12
  },
  {
    id: 'prod-home-chair',
    name: 'Silla Ergonómica Ejecutiva',
    description: 'Soporte lumbar adaptable para largas sesiones (Categoría Hogar)',
    priceCents: 25000, // $250.00 USD
    category: 'Hogar',
    stock: 6
  },
  {
    id: 'prod-acc-backpack',
    name: 'Mochila Anti-Robo Impermeable',
    description: 'Compartimento acolchado para laptop de 16" (Categoría Accesorios)',
    priceCents: 6000, // $60.00 USD
    category: 'Accesorios',
    stock: 10
  },
  {
    id: 'prod-book-arch',
    name: 'Libro: Clean Hexagonal Architecture',
    description: 'Patrones de diseño, SOLID y DDD táctico (Categoría Libros)',
    priceCents: 4500, // $45.00 USD
    category: 'Libros',
    stock: 15
  }
];
