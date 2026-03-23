import { Component, ChangeDetectionStrategy, inject, OnInit } from '@angular/core';
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
  
  // UI States
  isSaving = false;
  showSuccess = false;

  // Form fields
  form: Partial<Vehicle> = this.resetForm();
  inputUnit: 'liters' | 'gallons' = 'liters';
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
    // Convert current form values when unit changes
    if (this.inputUnit === 'gallons') {
      // From Liters to Gallons
      if (this.form.fuelCapacityGallons) this.form.fuelCapacityGallons /= this.GAL_TO_L;
      if (this.form.currentFuelGallons) this.form.currentFuelGallons /= this.GAL_TO_L;
      if (this.form.avgKmPerGallon) this.form.avgKmPerGallon *= this.GAL_TO_L;
    } else {
      // From Gallons to Liters
      if (this.form.fuelCapacityGallons) this.form.fuelCapacityGallons *= this.GAL_TO_L;
      if (this.form.currentFuelGallons) this.form.currentFuelGallons *= this.GAL_TO_L;
      if (this.form.avgKmPerGallon) this.form.avgKmPerGallon /= this.GAL_TO_L;
    }
  }

  openAddModal() {
    this.editingVehicle = null;
    this.form = this.resetForm();
    this.inputUnit = 'liters';
    this.isSaving = false;
    this.showSuccess = false;
    if (this.form.fuelCapacityGallons) this.form.fuelCapacityGallons *= this.GAL_TO_L;
    if (this.form.currentFuelGallons) this.form.currentFuelGallons *= this.GAL_TO_L;
    if (this.form.avgKmPerGallon) this.form.avgKmPerGallon /= this.GAL_TO_L;
    this.showModal = true;
  }

  openEditModal(vehicle: Vehicle) {
    this.editingVehicle = { ...vehicle };
    this.form = { ...vehicle };
    this.inputUnit = 'liters'; 
    this.isSaving = false;
    this.showSuccess = false;
    if (this.form.fuelCapacityGallons) this.form.fuelCapacityGallons *= this.GAL_TO_L;
    if (this.form.currentFuelGallons) this.form.currentFuelGallons *= this.GAL_TO_L;
    if (this.form.avgKmPerGallon) this.form.avgKmPerGallon /= this.GAL_TO_L;
    
    this.showModal = true;
  }

  closeModal() {
    if (this.isSaving) return;
    this.showModal = false;
  }

  saveVehicle() {
    if (this.isSaving) return;
    this.isSaving = true;

    const dataToSave = { ...this.form };
    
    if (this.inputUnit === 'liters') {
      if (dataToSave.fuelCapacityGallons) dataToSave.fuelCapacityGallons /= this.GAL_TO_L;
      if (dataToSave.currentFuelGallons) dataToSave.currentFuelGallons /= this.GAL_TO_L;
      if (dataToSave.avgKmPerGallon) dataToSave.avgKmPerGallon *= this.GAL_TO_L;
    }

    // Rounding to 2 decimals
    if (dataToSave.fuelCapacityGallons) dataToSave.fuelCapacityGallons = Math.round(dataToSave.fuelCapacityGallons * 100) / 100;
    if (dataToSave.currentFuelGallons) dataToSave.currentFuelGallons = Math.round(dataToSave.currentFuelGallons * 100) / 100;
    if (dataToSave.avgKmPerGallon) dataToSave.avgKmPerGallon = Math.round(dataToSave.avgKmPerGallon * 100) / 100;

    // Remove ID from payload for PATCH
    const { id, ...cleanData } = dataToSave as any;

    const request = (this.editingVehicle && this.editingVehicle.id)
      ? this.vehicleService.updateVehicle(this.editingVehicle.id, cleanData)
      : this.vehicleService.createVehicle(cleanData);

    request.subscribe({
      next: () => {
        this.showSuccess = true;
        this.vehicleService.refreshData(); // Triggers loadVehicles and dashboard updates
        setTimeout(() => {
          this.closeModal();
          this.isSaving = false;
        }, 1500);
      },
      error: () => {
        this.isSaving = false;
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
