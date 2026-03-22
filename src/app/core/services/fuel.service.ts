import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from '@core/services/api.service';
import { FuelRange, FuelLog, ConsumptionSummary } from '@core/interfaces/fuel.interface';

@Injectable({
  providedIn: 'root'
})
export class FuelService {
  private api = inject(ApiService);

  getRange(vehicleId: string): Observable<FuelRange> {
    return this.api.get<FuelRange>(`/fuel/range/${vehicleId}`);
  }

  getHistory(vehicleId: string, limit: number = 20): Observable<FuelLog[]> {
    return this.api.get<FuelLog[]>(`/fuel/history/${vehicleId}`, { limit });
  }

  getConsumptionSummary(vehicleId: string): Observable<ConsumptionSummary> {
    return this.api.get<ConsumptionSummary>(`/fuel/consumption/${vehicleId}`);
  }
}
