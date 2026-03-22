// ─── Tipos de evento WebSocket (mirror del backend) ────────────
export type AlertEventType =
  | 'anomaly_alert'
  | 'low_range_alert'
  | 'traffic_alert'
  | 'speedcam_alert'
  | 'refuel_prompt'
  | 'smart_stop'
  | 'notification';

export type AlertSeverity = 'info' | 'warning' | 'critical' | 'success';

// ─── Payload genérico tipado que llega del servidor ────────────
export interface AlertPayload {
  type: AlertEventType;
  vehicleId: string;
  timestamp: string;
  severity: AlertSeverity;
  data: GenericAlertData | SpeedCamAlertData | LowRangeAlertData | RefuelPromptData | AnomalyAlertData;
}

// ─── Data específica por tipo ──────────────────────────────────

export interface GenericAlertData {
  title?: string;
  message: string;
}

export interface SpeedCamAlertData {
  lat: number;
  lon: number;
  kmAhead: number;
}

export interface LowRangeAlertData {
  safeRangeKm: number;
  status: string;
  message: string;
}

export interface RefuelPromptData {
  stoppedMinutes: number;
  message: string;
}

export interface AnomalyAlertData {
  vehicleId: string;
  hasAnomaly: boolean;
  currentKmPerGallon: number;
  historicAvgKmPerGallon: number;
  deviationPercent: number;
  direction: 'HIGH_CONSUMPTION' | 'LOW_CONSUMPTION' | 'NORMAL';
  message: string;
}
