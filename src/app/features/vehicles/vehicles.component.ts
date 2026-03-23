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
  
  // Form fields
  form: Partial<Vehicle> = this.resetForm();
  inputUnit: 'liters' | 'gallons' = 'liters';
  readonly GAL_TO_L = 3.78541;

  ngOnInit() {
    this.loadVehicles();
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
    if (this.form.fuelCapacityGallons) this.form.fuelCapacityGallons *= this.GAL_TO_L;
    if (this.form.currentFuelGallons) this.form.currentFuelGallons *= this.GAL_TO_L;
    if (this.form.avgKmPerGallon) this.form.avgKmPerGallon /= this.GAL_TO_L;
    this.showModal = true;
  }

  openEditModal(vehicle: Vehicle) {
    this.editingVehicle = { ...vehicle };
    this.form = { ...vehicle };
    this.inputUnit = 'liters'; 
    if (this.form.fuelCapacityGallons) this.form.fuelCapacityGallons *= this.GAL_TO_L;
    if (this.form.currentFuelGallons) this.form.currentFuelGallons *= this.GAL_TO_L;
    if (this.form.avgKmPerGallon) this.form.avgKmPerGallon /= this.GAL_TO_L;
    
    this.showModal = true;
  }

  closeModal() {
    this.showModal = false;
  }

  saveVehicle() {
    const dataToSave = { ...this.form };
    
    if (this.inputUnit === 'liters') {
      if (dataToSave.fuelCapacityGallons) dataToSave.fuelCapacityGallons /= this.GAL_TO_L;
      if (dataToSave.currentFuelGallons) dataToSave.currentFuelGallons /= this.GAL_TO_L;
      if (dataToSave.avgKmPerGallon) dataToSave.avgKmPerGallon *= this.GAL_TO_L;
    }

    if (this.editingVehicle && this.editingVehicle.id) {
      this.vehicleService.updateVehicle(this.editingVehicle.id, dataToSave).subscribe(() => {
        this.closeModal();
        window.location.reload(); 
      });
    } else {
      this.vehicleService.createVehicle(dataToSave).subscribe(() => {
        this.closeModal();
        window.location.reload();
      });
    }
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
