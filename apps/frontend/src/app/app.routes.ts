import { Routes } from '@angular/router';
import { AdminRulesPageComponent } from './pages/admin/admin-rules-page.component';
import { CheckoutPageComponent } from './pages/checkout/checkout-page.component';

export const APP_ROUTES: Routes = [
  { path: '', redirectTo: 'checkout', pathMatch: 'full' },
  { path: 'checkout', component: CheckoutPageComponent },
  { path: 'admin', component: AdminRulesPageComponent },
  { path: '**', redirectTo: 'checkout' }
];
