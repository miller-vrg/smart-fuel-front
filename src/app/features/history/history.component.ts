import { Component, ChangeDetectionStrategy, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';

import { combineLatest, Observable, EMPTY, of } from 'rxjs';
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
  costs$!: Observable<{ weekly: number, monthly: number }>;

  ngOnInit() {
    const activeVehicle$ = this.vehicleService.activeVehicle$;
    const refresh$ = this.vehicleService.dataRefreshed$;

    this.summary$ = combineLatest([activeVehicle$, refresh$]).pipe(
      switchMap(([v, _]) => v ? this.fuelService.getConsumptionSummary(v.id) : EMPTY)
    );

    this.logs$ = combineLatest([activeVehicle$, refresh$]).pipe(
      switchMap(([v, _]) => v ? this.fuelService.getHistory(v.id) : EMPTY)
    );

    this.costs$ = this.logs$.pipe(
      switchMap(logs => {
        const now = new Date();
        const startOfWeek = new Date(now.setDate(now.getDate() - now.getDay()));
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        
        const weekly = logs
          .filter(log => new Date(log.loggedAt) >= startOfWeek)
          .reduce((acc, log) => acc + (log.totalCost || 0), 0);
          
        const monthly = logs
          .filter(log => new Date(log.loggedAt) >= startOfMonth)
          .reduce((acc, log) => acc + (log.totalCost || 0), 0);
          
        return of({ weekly, monthly });
      })
    );
    
    this.vehicleService.loadInitialVehicle().subscribe();
  }
}
