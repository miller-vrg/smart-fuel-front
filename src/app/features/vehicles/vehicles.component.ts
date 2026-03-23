import { Component, ChangeDetectionStrategy, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { BehaviorSubject, finalize } from 'rxjs';

import { VehicleService } from '@core/services/vehicle.service';
import { Vehicle } from '@core/interfaces/vehicle.interface';

@Component({
  selector: 'app-vehicles',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './vehicles.component.html',
  styleUrl: './vehicles.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class VehiclesComponent implements OnInit {
  private vehicleService = inject(VehicleService);

  vehicles$ = new BehaviorSubject<Vehicle[]>([]);
  isLoading$ = new BehaviorSubject<boolean>(false);

  showModal = false;
  editingVehicle: Partial<Vehicle> | null = null;

  // UI States using Signals for reliable OnPush updates
  isSaving = signal(false);
  showSuccess = signal(false);

  // Form fields
  form: Partial<Vehicle> = this.resetForm();
  inputUnit: 'liters' | 'gallons' = 'liters';
  private previousUnit: 'liters' | 'gallons' = 'liters';
  readonly GAL_TO_L = 3.78541;

  ngOnInit() {
    this.loadVehicles();

    // Refresh list when global data is refreshed
    this.vehicleService.dataRefreshed$.subscribe(() => {
      this.loadVehicles();
    });
  }

  loadVehicles() {
    this.isLoading$.next(true);
    this.vehicleService.loadInitialVehicle().pipe(
      finalize(() => this.isLoading$.next(false))
    ).subscribe(vehicles => {
      this.vehicles$.next(vehicles);
    });
  }

  onUnitChange() {
    // Only convert if the unit actually changed
    if (this.inputUnit === this.previousUnit) return;

    if (this.inputUnit === 'gallons') {
      // From Liters to Gallons
      if (this.form.fuelCapacityGallons !== undefined) this.form.fuelCapacityGallons = this.round(this.form.fuelCapacityGallons / this.GAL_TO_L, 4);
      if (this.form.currentFuelGallons !== undefined) this.form.currentFuelGallons = this.round(this.form.currentFuelGallons / this.GAL_TO_L, 4);
      if (this.form.avgKmPerGallon !== undefined) this.form.avgKmPerGallon = this.round(this.form.avgKmPerGallon * this.GAL_TO_L, 4);
    } else {
      // From Gallons to Liters
      if (this.form.fuelCapacityGallons !== undefined) this.form.fuelCapacityGallons = this.round(this.form.fuelCapacityGallons * this.GAL_TO_L, 4);
      if (this.form.currentFuelGallons !== undefined) this.form.currentFuelGallons = this.round(this.form.currentFuelGallons * this.GAL_TO_L, 4);
      if (this.form.avgKmPerGallon !== undefined) this.form.avgKmPerGallon = this.round(this.form.avgKmPerGallon / this.GAL_TO_L, 4);
    }

    this.previousUnit = this.inputUnit;
  }

  private round(val: number, decimals: number = 2): number {
    const factor = Math.pow(10, decimals);
    return Math.round(val * factor) / factor;
  }

  openAddModal() {
    this.editingVehicle = null;
    this.form = this.resetForm();
    this.inputUnit = 'liters';
    this.previousUnit = 'liters';
    this.isSaving.set(false);
    this.showSuccess.set(false);

    // resetForm returns gallons, so we convert initial defaults to liters if needed
    if (this.inputUnit === 'liters') {
      if (this.form.fuelCapacityGallons !== undefined) this.form.fuelCapacityGallons = this.round(this.form.fuelCapacityGallons * this.GAL_TO_L, 4);
      if (this.form.currentFuelGallons !== undefined) this.form.currentFuelGallons = this.round(this.form.currentFuelGallons * this.GAL_TO_L, 4);
      if (this.form.avgKmPerGallon !== undefined) this.form.avgKmPerGallon = this.round(this.form.avgKmPerGallon / this.GAL_TO_L, 4);
    }

    this.toggleModal(true);
  }

  openEditModal(vehicle: Vehicle) {
    this.editingVehicle = { ...vehicle };
    this.form = { ...vehicle };

    // Set unit from vehicle data or default to liters
    this.inputUnit = (vehicle.unit as 'liters' | 'gallons') || 'liters';
    this.previousUnit = this.inputUnit;

    this.isSaving.set(false);
    this.showSuccess.set(false);

    // Backend stores as Gallons. Convert to user's preferred unit for editing.
    if (this.inputUnit === 'liters') {
      if (this.form.fuelCapacityGallons !== undefined) this.form.fuelCapacityGallons = this.round(this.form.fuelCapacityGallons * this.GAL_TO_L, 4);
      if (this.form.currentFuelGallons !== undefined) this.form.currentFuelGallons = this.round(this.form.currentFuelGallons * this.GAL_TO_L, 4);
      if (this.form.avgKmPerGallon !== undefined) this.form.avgKmPerGallon = this.round(this.form.avgKmPerGallon / this.GAL_TO_L, 4);
    }

    this.toggleModal(true);
  }

  toggleModal(show: boolean) {
    this.showModal = show;
    if (show) this.vehicleService.registerModalOpen();
    else this.vehicleService.registerModalClose();
  }

  closeModal() {
    if (this.isSaving()) return;
    this.toggleModal(false);
  }

  saveVehicle() {
    if (this.isSaving()) return;
    this.isSaving.set(true);

    const dataToSave = { ...this.form };
    dataToSave.unit = this.inputUnit;

    // If input was in Liters, convert everything back to Gallons for DB consistency
    if (this.inputUnit === 'liters') {
      if (dataToSave.fuelCapacityGallons !== undefined) dataToSave.fuelCapacityGallons /= this.GAL_TO_L;
      if (dataToSave.currentFuelGallons !== undefined) dataToSave.currentFuelGallons /= this.GAL_TO_L;
      if (dataToSave.avgKmPerGallon !== undefined) dataToSave.avgKmPerGallon *= this.GAL_TO_L; // FIXED: Changed /= to *= for Liters -> Gallons (Km/L to Km/Gal)
    }

    // Strict rounding to 4 decimals before saving (Backend updated to scale: 4)
    if (dataToSave.fuelCapacityGallons !== undefined) dataToSave.fuelCapacityGallons = this.round(dataToSave.fuelCapacityGallons, 4);
    if (dataToSave.currentFuelGallons !== undefined) dataToSave.currentFuelGallons = this.round(dataToSave.currentFuelGallons, 4);
    if (dataToSave.avgKmPerGallon !== undefined) dataToSave.avgKmPerGallon = this.round(dataToSave.avgKmPerGallon, 4);

    // Remove ID and other read-only or extra fields from payload for PATCH/POST
    const {
      id,
      notifyGasStationKmBefore,
      notifyRestStopHours,
      maxSpeedLimit,
      activeTrip,
      createdAt,
      updatedAt,
      userId,
      ...cleanData
    } = dataToSave as any;

    const request = (this.editingVehicle && this.editingVehicle.id)
      ? this.vehicleService.updateVehicle(this.editingVehicle.id, cleanData)
      : this.vehicleService.createVehicle(cleanData);

    request.subscribe({
      next: () => {
        this.showSuccess.set(true);
        this.vehicleService.refreshData(); // Triggers loadVehicles and dashboard updates
        setTimeout(() => {
          this.closeModal();
          this.isSaving.set(false);
        }, 1500);
      },
      error: (err) => {
        console.error('Error saving vehicle:', err);
        this.isSaving.set(false);
      }
    });
  }

  deleteVehicle(id: string) {
    if (confirm('¿Estás seguro de eliminar este vehículo?')) {
      this.vehicleService.deleteVehicle(id).subscribe(() => {
        this.loadVehicles();
      });
    }
  }

  getDisplayCapacity(v: Vehicle): number {
    const val = v.unit === 'liters' ? v.fuelCapacityGallons * this.GAL_TO_L : v.fuelCapacityGallons;
    return this.round(val);
  }

  getDisplayPerformance(v: Vehicle): number {
    const val = v.unit === 'liters' ? v.avgKmPerGallon / this.GAL_TO_L : v.avgKmPerGallon;
    return this.round(val);
  }

  private resetForm(): Partial<Vehicle> {
    return {
      brand: '',
      model: '',
      year: new Date().getFullYear().toString(),
      licensePlate: '',
      fuelCapacityGallons: 12,
      avgKmPerGallon: 40,
      currentFuelGallons: 6,
      safetyBuffer: 0.15,
      isMain: false
    };
  }
}
