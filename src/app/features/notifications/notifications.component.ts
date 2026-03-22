import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Location } from '@angular/common';

import { NotificationsService } from '@core/services/notifications.service';
import { AppNotification } from '@core/interfaces/notification.interface';

import { NotificationCardComponent } from '@shared/components/notification-card/notification-card.component';

@Component({
  selector: 'app-notifications',
  standalone: true,
  imports: [CommonModule, NotificationCardComponent],
  templateUrl: './notifications.component.html',
  styleUrls: ['./notifications.component.scss']
})
export class NotificationsComponent {
  private location = inject(Location);
  public notifService = inject(NotificationsService);

  // Grouping notifications locally or directly iterating the signal
  get todayNotifications() {
    return this.notifService.notifications();
  }

  goBack() {
    this.location.back();
  }
}
