import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { CartStoreService } from './state/cart-store.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, RouterOutlet, RouterLink, RouterLinkActive],
  template: `
    <div class="app-shell">
      <header class="topbar">
        <div class="brand">
          <span class="logo-dot"></span>
          <div>
            <h1>Core E-Commerce Store</h1>
            <small>Tienda Oficial · Descuentos Acumulativos en Línea</small>
          </div>
        </div>
        <nav class="nav-links">
          <a routerLink="/checkout" routerLinkActive="active-link">
            🛒 Tienda &amp; Checkout ({{ store.totalItemsCount() }})
          </a>
          <a routerLink="/admin" routerLinkActive="active-link">
            ⚙️ Rule Engine Studio (/admin)
          </a>
        </nav>
      </header>

      <main class="main-content">
        <router-outlet></router-outlet>
      </main>
    </div>
  `
})
export class AppComponent {
  public readonly store = inject(CartStoreService);
}
