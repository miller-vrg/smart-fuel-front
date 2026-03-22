import { Injectable, inject } from '@angular/core';
import { BehaviorSubject, Observable, tap } from 'rxjs';

import { ApiService } from '@core/services/api.service';
import { Vehicle } from '@core/interfaces/vehicle.interface';

@Injectable({
  providedIn: 'root'
})
export class VehicleService {
  private api = inject(ApiService);
  
  private activeVehicleSubject = new BehaviorSubject<Vehicle | null>(null);
  activeVehicle$ = this.activeVehicleSubject.asObservable();

  loadInitialVehicle(): Observable<Vehicle[]> {
    return this.api.get<Vehicle[]>('/vehicles').pipe(
      tap(vehicles => {
        if (vehicles && vehicles.length > 0) {
          this.activeVehicleSubject.next(vehicles[0]);
        }
      })
    );
  }

  getActiveVehicleId(): string | null {
    return this.activeVehicleSubject.value?.id || null;
  }

  saveActiveTrip(id: string, trip: any): Observable<Vehicle> {
    return this.api.patch<Vehicle>(`/vehicles/${id}/active-trip`, trip);
  }

  createVehicle(dto: Partial<Vehicle>): Observable<Vehicle> {
    return this.api.post<Vehicle>('/vehicles', dto);
  }

  updateVehicle(id: string, dto: Partial<Vehicle>): Observable<Vehicle> {
    return this.api.patch<Vehicle>(`/vehicles/${id}`, dto);
  }

  deleteVehicle(id: string): Observable<void> {
    return this.api.delete<void>(`/vehicles/${id}`);
  }

  getVehicleById(id: string): Observable<Vehicle> {
    return this.api.get<Vehicle>(`/vehicles/${id}`);
  }
}
