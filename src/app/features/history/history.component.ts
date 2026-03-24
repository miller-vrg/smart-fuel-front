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
  costs$!: Observable<{
    weekly: number,
    monthly: number,
    dailyChart: { day: string, value: number, height: number, active: boolean }[]
  }>;

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

        // Start of current week (Sunday)
        const startOfWeek = new Date(now);
        startOfWeek.setDate(now.getDate() - now.getDay());
        startOfWeek.setHours(0, 0, 0, 0);

        // Start of current month
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

        // Filter and Sum
        const weekly = logs
          .filter(log => new Date(log.date) >= startOfWeek)
          .reduce((acc, log) => acc + (log.cost || 0), 0);

        const monthly = logs
          .filter(log => new Date(log.date) >= startOfMonth)
          .reduce((acc, log) => acc + (log.cost || 0), 0);

        // Prepare Daily Chart Data (Current Week)
        const days = ['Dom', 'Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab'];
        const dailyValues = new Array(7).fill(0);

        logs.forEach(log => {
          const logDate = new Date(log.date);
          if (logDate >= startOfWeek) {
            dailyValues[logDate.getDay()] += (log.cost || 0);
          }
        });

        const maxVal = Math.max(...dailyValues, 10); // Avoid division by zero
        const dailyChart = days.map((day, i) => ({
          day,
          value: dailyValues[i],
          height: (dailyValues[i] / maxVal) * 100,
          active: i === now.getDay()
        }));

        return of({ weekly, monthly, dailyChart });
      })
    );

    this.vehicleService.loadInitialVehicle().subscribe();
  }
}
