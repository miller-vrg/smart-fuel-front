import { inject, Injectable, signal } from '@angular/core';
import { io, Socket } from 'socket.io-client';

import { VehicleService } from '@core/services/vehicle.service';
import { AlertPayload, AlertEventType, GenericAlertData } from '@core/interfaces/alert-payload.interface';

import { AppNotification } from '@core/interfaces/notification.interface';
import { environment } from '@env/environment';

@Injectable({
  providedIn: 'root'
})
export class NotificationsService {
  private socket!: Socket;
  private vehicleService = inject(VehicleService);
  private readonly ENV = environment;
  
  /** Signal to store the global notification history */
  readonly notifications = signal<AppNotification[]>([]);
  
  /** Transient signal to trigger a popup overlay */
  readonly latestNotification = signal<AppNotification | null>(null);

  /** Map of event type → default title */
  private readonly defaultTitles: Record<AlertEventType, string> = {
    anomaly_alert: 'Anomaly Alert',
    smart_stop: 'Smart Stop Suggestion',
    traffic_alert: 'Traffic Update',
    speedcam_alert: 'Speed Camera Ahead',
    refuel_prompt: 'Refuel Prompt',
    low_range_alert: 'Low Range Warning',
    notification: 'System Notification',
  };

  constructor() {
    this.initSocket();
    
    // Subscribe when vehicle changes
    this.vehicleService.activeVehicle$.subscribe(vehicle => {
      if (vehicle) {
        this.subscribeVehicle(vehicle.id);
      }
    });
  }

  private initSocket(): void {
    this.socket = io(`${this.ENV.wsUrl}/alerts`, {
      withCredentials: true,
      transports: ['websocket', 'polling']
    });

    this.socket.on('connect', () => {
      console.log('WebSocket Connected to /alerts namespace');
    });

    // Register listeners for each typed event
    const events: AlertEventType[] = [
      'notification',
      'anomaly_alert',
      'smart_stop',
      'traffic_alert',
      'speedcam_alert',
      'refuel_prompt',
      'low_range_alert',
    ];

    events.forEach(event => {
      this.socket.on(event, (payload: AlertPayload) => this.handleIncoming(payload));
    });
  }

  private subscribeVehicle(vehicleId: string): void {
    if (this.socket.connected) {
      this.socket.emit('subscribe_vehicle', { vehicleId });
    } else {
      this.socket.once('connect', () => {
        this.socket.emit('subscribe_vehicle', { vehicleId });
      });
    }
  }

  private handleIncoming(payload: AlertPayload): void {
    console.log('Received Notification:', payload);
    
    // Safely extract title/message — all data shapes include `message`
    const data = payload.data;
    const title = 'title' in data ? (data as GenericAlertData).title : undefined;
    const message = 'message' in data ? data.message as string : 'New alert received';

    const newNotif: AppNotification = {
      id: Math.random().toString(36).substring(7),
      type: this.mapEventToCardType(payload.type),
      timestamp: payload.timestamp,
      title: title ?? this.defaultTitles[payload.type] ?? 'Alert',
      message,
      isRead: false,
    };

    // Update state
    this.notifications.update(list => [newNotif, ...list]);
    this.latestNotification.set(newNotif);
    
    // Auto-clear transient popup after 5 seconds
    setTimeout(() => {
      if (this.latestNotification()?.id === newNotif.id) {
        this.latestNotification.set(null);
      }
    }, 5000);
  }

  /** Map backend event types to the card component's `type` input */
  private mapEventToCardType(eventType: AlertEventType): AppNotification['type'] {
    const map: Record<AlertEventType, AppNotification['type']> = {
      traffic_alert: 'traffic_alert',
      smart_stop: 'smart_stop',
      anomaly_alert: 'anomaly_alert',
      low_range_alert: 'anomaly_alert',
      speedcam_alert: 'traffic_alert',
      refuel_prompt: 'info',
      notification: 'info',
    };
    return map[eventType] ?? 'info';
  }

  markAllAsRead(): void {
    this.notifications.update(list => list.map(n => ({ ...n, isRead: true })));
  }
}
