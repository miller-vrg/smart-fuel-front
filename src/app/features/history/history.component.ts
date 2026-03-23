import { Component, ChangeDetectionStrategy, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';

import { combineLatest, Observable, EMPTY } from 'rxjs';
import { switchMap } from 'rxjs/operators';

import { FuelService } from '@core/services/fuel.service';
import { VehicleService } from '@core/services/vehicle.service';
import { FuelLog } from '@core/interfaces/fuel.interface';

@Component({
    selector: 'app-history',
    standalone: true,
    imports: [CommonModule],
    templateUrl: './history.component.html',
    styleUrl: './history.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class HistoryComponent implements OnInit {
  fuelService = inject(FuelService);
  vehicleService = inject(VehicleService);

  summary$!: Observable<any>;
  logs$!: Observable<any[]>;

  readonly weeklyData = [
    { day: 'Mon', height: 60 },
    { day: 'Tue', height: 45 },
    { day: 'Wed', height: 85 },
    { day: 'Thu', height: 95, active: true },
    { day: 'Fri', height: 40 },
    { day: 'Sat', height: 30 },
    { day: 'Sun', height: 55 },
  ];

  ngOnInit() {
    this.summary$ = combineLatest([
      this.vehicleService.activeVehicle$,
      this.vehicleService.dataRefreshed$
    ]).pipe(
      switchMap(([v, _]: [any, any]) => v ? this.fuelService.getConsumptionSummary(v.id) : EMPTY)
    );

    this.logs$ = combineLatest([
      this.vehicleService.activeVehicle$,
      this.vehicleService.dataRefreshed$
    ]).pipe(
      switchMap(([v, _]: [any, any]) => v ? this.fuelService.getHistory(v.id) : EMPTY)
    );
    
    // Ensure vehicles are loaded if they haven't been
    this.vehicleService.loadInitialVehicle().subscribe();
  }
}
