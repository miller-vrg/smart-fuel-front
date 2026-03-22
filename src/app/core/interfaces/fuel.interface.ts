export interface FuelRange {
  safeRangeKm: number;
  fuelLevelPercent: number;
  status: 'SAFE' | 'WARNING' | 'CRITICAL';
}

export interface FuelLog {
  id: string;
  date: string;
  brand: string;
  cost: number;
  gallons: number;
  odometer: number;
}

export interface ConsumptionSummary {
  avgConsumption: number;
  anomalies: any[];
}
