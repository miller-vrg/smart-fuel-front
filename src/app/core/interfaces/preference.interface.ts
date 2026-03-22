export interface PreferenceItem {
  brandName: string;
  priority: number;
  onlyHighway?: boolean;
}

export interface Preference {
  vehicleId: string;
  preferences: PreferenceItem[];
  excludedBrands?: string[];
  notifyGasStationKmBefore?: number;
  notifyRestStopHours?: number | null;
  maxSpeedLimit?: number;
}
