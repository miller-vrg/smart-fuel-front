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
          const storedId = localStorage.getItem('selectedVehicleId');
          const saved = vehicles.find(v => v.id === storedId);
          const main = vehicles.find(v => v.isMain);
          
          const selected = saved || main || vehicles[0];
          this.activeVehicleSubject.next(selected);
        }
      })
    );
  }

  setActiveVehicle(vehicle: Vehicle) {
    localStorage.setItem('selectedVehicleId', vehicle.id);
    this.activeVehicleSubject.next(vehicle);
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

  refill(id: string, addedGallons: number, currentFuelGallons: number): Observable<Vehicle> {
    const newFuel = Math.round((currentFuelGallons + addedGallons) * 100) / 100;
    return this.updateVehicle(id, { currentFuelGallons: newFuel });
  }
}
