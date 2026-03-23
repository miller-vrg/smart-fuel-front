import { Component, ChangeDetectionStrategy, inject, OnInit, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { switchMap, catchError, first } from 'rxjs/operators';
import { combineLatest, Observable, of } from 'rxjs';

import { VehicleService } from '@core/services/vehicle.service';
import { FuelService } from '@core/services/fuel.service';
import { Vehicle } from '@core/interfaces/vehicle.interface';
import { AuthService } from '@core/services/auth.service';
import { FuelRefillComponent } from '../fuel/fuel-refill.component';

@Component({
    selector: 'app-dashboard',
    standalone: true,
    imports: [CommonModule, FormsModule, FuelRefillComponent],
    templateUrl: './dashboard.component.html',
    styleUrl: './dashboard.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class DashboardComponent implements OnInit {
  vehicleService = inject(VehicleService);
  fuelService = inject(FuelService);
  authService = inject(AuthService);

  showRefillModal = false;
  showFuelDetail = false;

  readonly userName = computed(() => this.authService.currentUser()?.name || 'User');
  
  allVehicles$!: Observable<Vehicle[]>;
  range$!: Observable<any>;
  vehicle$!: Observable<Vehicle | null>;

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
    this.allVehicles$ = this.vehicleService.loadInitialVehicle();
    this.vehicle$ = this.vehicleService.activeVehicle$;
    
    // Refresh range when vehicle changes OR when data is refreshed globally
    this.range$ = combineLatest([
      this.vehicle$, 
      this.vehicleService.dataRefreshed$
    ]).pipe(
      switchMap(([v, _]) => {
        if (!v || !v.id) return of({ safeRangeKm: 0, fuelLevelPercent: 0, status: 'UNKNOWN' });
        return this.fuelService.getRange(v.id);
      }),
      catchError(err => {
        console.error('Failed to load range data', err);
        return of({ safeRangeKm: 0, fuelLevelPercent: 0, status: 'WARNING' });
      })
    );
  }

  toggleRefillModal(show: boolean) {
    this.showRefillModal = show;
    if (show) this.vehicleService.registerModalOpen();
    else this.vehicleService.registerModalClose();
  }

  changeVehicle(id: string) {
    this.allVehicles$.pipe(first()).subscribe(vehicles => {
      const v = vehicles.find(x => x.id === id);
      if (v) this.vehicleService.setActiveVehicle(v);
    });
  }
}
