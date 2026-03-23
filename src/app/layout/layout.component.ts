import { Component, ChangeDetectionStrategy, inject, computed } from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive, Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { NotificationsService } from '../core/services/notifications.service';
import { NotificationCardComponent } from '../shared/components/notification-card/notification-card.component';
import { MapComponent } from '../shared/components/map/map.component';
import { MapService } from '../core/services/map.service';
import { AuthService } from '../core/services/auth.service';

interface NavItem {
  path: string;
  icon: string;
  label: string;
}

@Component({
  selector: 'app-layout',
  standalone: true,
  imports: [CommonModule, RouterOutlet, RouterLink, RouterLinkActive, NotificationCardComponent, MapComponent],
  templateUrl: './layout.component.html',
  styleUrl: './layout.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LayoutComponent {
  private router = inject(Router);
  public notifService = inject(NotificationsService);
  private mapService = inject(MapService);
  public authService = inject(AuthService);
  public showMenu = false;

  readonly navItems: NavItem[] = [
    { path: '/dashboard', icon: 'dashboard',        label: 'Dashboard' },
    { path: '/navigate',  icon: 'explore',           label: 'Navigate'  },
    { path: '/history',   icon: 'local_gas_station', label: 'History'   },
    { path: '/vehicles',  icon: 'directions_car',      label: 'Mis Vehículos' },
    { path: '/settings',  icon: 'settings',          label: 'Settings'  },
  ];

  readonly unreadCount = computed(() =>
    this.notifService.notifications().filter(n => !n.isRead).length
  );

  goToNotifications() {
    this.router.navigate(['/notifications']);
  }

  dismissToast() {
    this.notifService.latestNotification.set(null);
  }

  toggleMenu() {
    this.showMenu = !this.showMenu;
  }

  closeMenu() {
    this.showMenu = false;
  }

  onGlobalMapClick(event: { lng: number; lat: number }) {
    this.mapService.mapClick.emit(event);
  }
}
