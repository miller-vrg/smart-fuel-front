export interface AppNotification {
  id?: string;
  type: 'traffic_alert' | 'route_calc' | 'smart_stop' | 'anomaly_alert' | 'info';
  timestamp: string;
  title: string;
  message: string;
  isRead?: boolean;
}
