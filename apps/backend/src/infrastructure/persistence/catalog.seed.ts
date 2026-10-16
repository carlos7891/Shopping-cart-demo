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
    name: 'Laptop Pro 16" M3 Max',
    description: 'Portátil de alto rendimiento con pantalla Retina XDR y 32GB RAM',
    priceCents: 120000, // $1,200.00 USD
    category: 'Tecnología',
    stock: 5
  },
  {
    id: 'prod-tech-monitor',
    name: 'Monitor UltraWide 34" 4K',
    description: 'Monitor curvo IPS HDR10 con conexión USB-C y 144Hz',
    priceCents: 20000, // $200.00 USD
    category: 'Tecnología',
    stock: 8
  },
  {
    id: 'prod-tech-keyboard',
    name: 'Teclado Mecánico Wireless RGB',
    description: 'Teclado inalámbrico compacto con switches táctiles silenciosos',
    priceCents: 8500, // $85.00 USD
    category: 'Tecnología',
    stock: 12
  },
  {
    id: 'prod-home-chair',
    name: 'Silla Ergonómica Ejecutiva',
    description: 'Silla de oficina con soporte lumbar adaptable y malla transpirable',
    priceCents: 25000, // $250.00 USD
    category: 'Hogar',
    stock: 6
  },
  {
    id: 'prod-acc-backpack',
    name: 'Mochila Impermeable Travel Pro',
    description: 'Compartimento acolchado para portátil de hasta 16 pulgadas',
    priceCents: 6000, // $60.00 USD
    category: 'Accesorios',
    stock: 10
  },
  {
    id: 'prod-book-arch',
    name: 'Libro: Hábitos Productivos',
    description: 'Edición de tapa dura sobre gestión del tiempo y enfoque',
    priceCents: 4500, // $45.00 USD
    category: 'Libros',
    stock: 15
  }
];
