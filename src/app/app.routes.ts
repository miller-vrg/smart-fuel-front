import { Routes } from '@angular/router';
import { LayoutComponent } from './layout/layout.component';
import { authGuard } from './core/guards/auth.guard';

export const routes: Routes = [
  {
    path: 'auth',
    children: [
      {
        path: 'login',
        loadComponent: () =>
          import('./features/auth/login.component').then((m) => m.LoginComponent),
      },
      { path: '', redirectTo: 'login', pathMatch: 'full' }
    ],
  },
  {
    path: '',
    component: LayoutComponent,
    canActivate: [authGuard],
    canActivateChild: [authGuard],
    children: [
      {
        path: 'dashboard',
        loadComponent: () =>
          import('./features/dashboard/dashboard.component').then(
            (m) => m.DashboardComponent
          ),
      },
      {
        path: 'navigate',
        loadComponent: () =>
          import('./features/navigate/navigate.component').then(
            (m) => m.NavigateComponent
          ),
      },
      {
        path: 'history',
        loadComponent: () =>
          import('./features/history/history.component').then(
            (m) => m.HistoryComponent
          ),
      },
      {
        path: 'settings',
        loadComponent: () =>
          import('./features/preferences/preferences.component').then(
            (m) => m.PreferencesComponent
          ),
      },
      {
        path: 'notifications',
        loadComponent: () =>
          import('./features/notifications/notifications.component').then(
            (m) => m.NotificationsComponent
          ),
      },
      {
        path: 'vehicles',
        loadComponent: () =>
          import('./features/vehicles/vehicles.component').then(
            (m) => m.VehiclesComponent
          ),
      },
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
    ],
  },
  { path: '**', redirectTo: 'dashboard' },
];
