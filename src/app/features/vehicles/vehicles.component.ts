import { Component, ChangeDetectionStrategy, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { BehaviorSubject, finalize } from 'rxjs';

import { VehicleService } from '@core/services/vehicle.service';
import { Vehicle } from '@core/interfaces/vehicle.interface';

@Component({
    selector: 'app-vehicles',
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

  openAddModal() {
    this.editingVehicle = null;
    this.form = this.resetForm();
    this.showModal = true;
  }

  openEditModal(vehicle: Vehicle) {
    this.editingVehicle = vehicle;
    this.form = { ...vehicle };
    this.showModal = true;
  }

  closeModal() {
    this.showModal = false;
  }

  saveVehicle() {
    if (this.editingVehicle && this.editingVehicle.id) {
      this.vehicleService.updateVehicle(this.editingVehicle.id, this.form).subscribe(() => {
        this.loadVehicles();
        this.closeModal();
      });
    } else {
      this.vehicleService.createVehicle(this.form).subscribe(() => {
        this.loadVehicles();
        this.closeModal();
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
