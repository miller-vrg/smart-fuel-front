export interface AppNotification {
  id?: string;
  type: 'traffic_alert' | 'smart_stop' | 'anomaly_alert' | 'info';
  timestamp: string;
  title: string;
  message: string;
  isRead?: boolean;
}
