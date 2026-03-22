import { Component, ChangeDetectionStrategy, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';

import { switchMap, catchError, map } from 'rxjs/operators';
import { Observable, EMPTY, of } from 'rxjs';

import { VehicleService } from '@core/services/vehicle.service';
import { FuelService } from '@core/services/fuel.service';
import { Vehicle } from '@/app/core/interfaces/vehicle.interface';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DashboardComponent implements OnInit {
  vehicleService = inject(VehicleService);
  fuelService = inject(FuelService);

  readonly userName = 'Julian';
  
  // Use signals or Observables for data binding
  range$!: Observable<any>;
  vehicle$!: Observable<Vehicle>;

  readonly efficiencyData = [
    { day: 'Mon', height: 40 },
    { day: 'Tue', height: 55 },
    { day: 'Wed', height: 45 },
    { day: 'Thu', height: 70 },
    { day: 'Fri', height: 65 },
    { day: 'Sat', height: 85 },
    { day: 'Sun', height: 95 },
  ];

  ngOnInit() {
    this.vehicle$ = this.vehicleService.loadInitialVehicle().pipe(
        map((v: Vehicle[]) => v[0])
    );
    this.range$ = this.vehicle$.pipe(
      switchMap(v => {
        if (!v || !v.id) return EMPTY;
        return this.fuelService.getRange(v.id);
      }),
      catchError(err => {
        console.error('Failed to load range data', err);
        return of({ safeRangeKm: 0, fuelLevelPercent: 0, status: 'WARNING' });
      })
    );
  }
}
