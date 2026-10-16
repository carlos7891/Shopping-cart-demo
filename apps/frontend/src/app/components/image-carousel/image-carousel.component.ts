import { CommonModule } from '@angular/common';
import { Component, computed, Input, signal } from '@angular/core';

/**
 * Componente Reutilizable de Carrusel de Imágenes (Principios DRY y Single Responsibility).
 * Si recibe 1 sola imagen, la renderiza estáticamente.
 * Si recibe > 1 imágenes, habilita controles de navegación circular e indicadores (dots).
 */
@Component({
  selector: 'app-image-carousel',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './image-carousel.component.html',
  styleUrl: './image-carousel.component.css'
})
export class ImageCarouselComponent {
  public readonly imagesSignal = signal<readonly string[]>([]);
  public readonly activeIndex = signal<number>(0);

  @Input({ required: true })
  public set images(value: readonly string[]) {
    const safeList = value && value.length > 0 ? value : ['assets/monitor1.webp'];
    this.imagesSignal.set(safeList);
    this.activeIndex.set(0);
  }

  @Input()
  public alt = 'Imagen de producto';

  public readonly hasMultipleImages = computed<boolean>(
    () => this.imagesSignal().length > 1
  );

  public readonly currentImage = computed<string>(() => {
    const list = this.imagesSignal();
    const idx = this.activeIndex();
    return list[idx] ?? list[0] ?? 'assets/monitor1.webp';
  });

  public nextSlide(event?: Event): void {
    event?.stopPropagation();
    const total = this.imagesSignal().length;
    if (total <= 1) {
      return;
    }
    this.activeIndex.update((current) => (current + 1) % total);
  }

  public prevSlide(event?: Event): void {
    event?.stopPropagation();
    const total = this.imagesSignal().length;
    if (total <= 1) {
      return;
    }
    this.activeIndex.update((current) => (current - 1 + total) % total);
  }

  public selectSlide(index: number, event?: Event): void {
    event?.stopPropagation();
    const total = this.imagesSignal().length;
    if (index >= 0 && index < total) {
      this.activeIndex.set(index);
    }
  }
}
