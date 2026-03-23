import { Component, Input } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { AppNotification } from '@core/interfaces/notification.interface';

@Component({
    selector: 'app-notification-card',
    standalone: true,
    imports: [CommonModule, DatePipe],
    templateUrl: './notification-card.component.html',
    styleUrls: ['./notification-card.component.scss']
})
export class NotificationCardComponent {
  @Input() notification!: AppNotification;

  get typeClass(): string {
    const map: Record<string, string> = {
      'traffic_alert': 'traffic',
      'smart_stop': 'smart-stop',
      'anomaly_alert': 'anomaly',
      'info': 'info'
    };
    return map[this.notification.type] || 'info';
  }

  get config() {
    switch (this.notification.type) {
      case 'traffic_alert':
        return {
          icon: 'traffic',
          containerClass: 'bg-secondary-container/30',
          iconBoxClass: 'bg-secondary-container text-secondary',
          titleColor: 'text-secondary'
        };
      case 'smart_stop':
        return {
          icon: 'local_gas_station',
          containerClass: 'bg-primary-container/20',
          iconBoxClass: 'bg-primary-container text-primary',
          titleColor: 'text-primary'
        };
      case 'anomaly_alert':
        return {
          icon: 'warning',
          containerClass: 'bg-[#fdeaea]', // Soft red
          iconBoxClass: 'bg-[#fa746f]/20 text-error',
          titleColor: 'text-error'
        };
      default:
        return {
          icon: 'info',
          containerClass: 'bg-surface-container/50',
          iconBoxClass: 'bg-surface-container text-on-surface-variant',
          titleColor: 'text-on-surface'
        };
    }
  }
}
