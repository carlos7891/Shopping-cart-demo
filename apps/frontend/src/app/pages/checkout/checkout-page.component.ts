import { CommonModule } from '@angular/common';
import { Component, inject, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ImageCarouselComponent } from '../../components/image-carousel/image-carousel.component';
import { CartStoreService } from '../../state/cart-store.service';

@Component({
  selector: 'app-checkout-page',
  standalone: true,
  imports: [CommonModule, FormsModule, ImageCarouselComponent],
  templateUrl: './checkout-page.component.html',
  styleUrl: './checkout-page.component.css'
})
export class CheckoutPageComponent implements OnInit {
  public readonly store = inject(CartStoreService);

  private readonly productGallery: Readonly<Record<string, readonly string[]>> = {
    'prod-tech-laptop': [
      'assets/laptop.webp',
      'assets/laptop2.webp',
      'assets/laptop3.webp'
    ],
    'prod-tech-monitor': ['assets/monitor1.webp'],
    'prod-tech-keyboard': [
      'assets/teclado1.webp',
      'assets/teclado2.webp',
      'assets/teclado3.webp'
    ],
    'prod-home-chair': [
      'assets/silla1.webp',
      'assets/silla2.webp',
      'assets/silla3.webp'
    ],
    'prod-acc-backpack': ['assets/Morral-1.webp', 'assets/Morral-2.webp'],
    'prod-book-arch': ['assets/libro.webp']
  };

  public ngOnInit(): void {
    void this.store.initializeStore();
  }

  public getProductImages(productId: string): readonly string[] {
    return this.productGallery[productId] ?? ['assets/monitor1.webp'];
  }

  public getPrimaryImage(productId: string): string {
    return this.getProductImages(productId)[0];
  }
}
