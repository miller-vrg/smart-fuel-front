import { Component, ChangeDetectionStrategy, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';

import { switchMap } from 'rxjs/operators';
import { Observable, EMPTY } from 'rxjs';

import { FuelService } from '@core/services/fuel.service';
import { VehicleService } from '@core/services/vehicle.service';
import { FuelLog } from '@core/interfaces/fuel.interface';

@Component({
    selector: 'app-history',
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
    const vehicle$ = this.vehicleService.loadInitialVehicle();
    this.summary$ = vehicle$.pipe(
      switchMap(v => (v && v.length > 0) ? this.fuelService.getConsumptionSummary(v[0].id) : EMPTY)
    );
    this.logs$ = vehicle$.pipe(
      switchMap(v => (v && v.length > 0) ? this.fuelService.getHistory(v[0].id) : EMPTY)
    );
  }
}
