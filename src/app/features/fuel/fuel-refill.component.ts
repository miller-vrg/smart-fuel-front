import { Component, inject, Signal, EventEmitter, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { VehicleService } from '@core/services/vehicle.service';
import { Vehicle } from '@core/interfaces/vehicle.interface';
import { take } from 'rxjs';

@Component({
  selector: 'app-fuel-refill',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="refill-modal-backdrop" (click)="close()">
      <div class="refill-modal-card" (click)="$event.stopPropagation()">
        <header>
          <h2>Registrar Ingreso de Combustible</h2>
          <button class="close-btn" (click)="close()">
            <span class="material-symbols-outlined">close</span>
          </button>
        </header>

        <form (ngSubmit)="save()">
          <div class="form-group">
            <label>Vehículo</label>
            <select [(ngModel)]="selectedVehicleId" name="vehicleId" required>
              <option *ngFor="let v of vehicles" [value]="v.id">{{ v.brand }} {{ v.model }} ({{ v.licensePlate }})</option>
            </select>
          </div>

          <div class="form-row">
            <div class="form-group">
              <label>Galones Agregados</label>
              <input type="number" step="0.01" [(ngModel)]="amount" name="amount" required placeholder="0.00">
            </div>
            <div class="form-group">
              <label>Precio Total (Opcional)</label>
              <input type="number" [(ngModel)]="price" name="price" placeholder="0">
            </div>
          </div>

          <div class="info-banner" *ngIf="selectedVehicle">
            <span class="material-symbols-outlined">info</span>
            <p>El tanque actual tiene {{ selectedVehicle.currentFuelGallons | number:'1.2-2' }} gal.</p>
          </div>

          <footer class="modal-footer">
            <button type="button" class="btn-secondary" (click)="close()">Cancelar</button>
            <button type="submit" class="btn-primary" [disabled]="!amount || !selectedVehicleId">Guardar Registro</button>
          </footer>
        </form>
      </div>
    </div>
  `,
  styles: [`
    .refill-modal-backdrop {
      position: fixed;
      inset: 0;
      background: rgba(0,0,0,0.5);
      z-index: 2000;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 16px;
      backdrop-filter: blur(4px);
    }
    .refill-modal-card {
      background: var(--surface);
      width: 100%;
      max-width: 400px;
      border-radius: 24px;
      padding: 24px;
      box-shadow: 0 10px 25px rgba(0,0,0,0.2);
    }
    header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 20px;
    }
    h2 { margin: 0; font-size: 1.25rem; color: var(--on-surface); }
    .close-btn { background: none; border: none; color: var(--on-surface-variant); cursor: pointer; }
    
    .form-group { margin-bottom: 16px; display: flex; flex-direction: column; gap: 8px; }
    .form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
    label { font-size: 0.85rem; color: var(--on-surface-variant); font-weight: 500; }
    
    input, select {
      padding: 12px;
      border-radius: 12px;
      border: 1px solid var(--outline-variant);
      background: var(--surface-container-lowest);
      color: var(--on-surface);
      font-size: 1rem;
    }

    .info-banner {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 12px;
      background: var(--primary-container);
      color: var(--on-primary-container);
      border-radius: 12px;
      margin-bottom: 20px;
    }
    .info-banner p { margin: 0; font-size: 0.9rem; }

    .modal-footer {
      display: flex;
      gap: 12px;
      justify-content: flex-end;
    }
    button {
      padding: 10px 20px;
      border-radius: 100px;
      border: none;
      font-weight: 600;
      cursor: pointer;
    }
    .btn-primary { background: var(--primary); color: var(--on-primary); }
    .btn-secondary { background: var(--surface-container-high); color: var(--on-surface); }
    button:disabled { opacity: 0.5; cursor: not-allowed; }
  `]
})
export class FuelRefillComponent {
  private vehicleService = inject(VehicleService);
  
  vehicles: Vehicle[] = [];
  selectedVehicleId: string = '';
  amount: number | null = null;
  price: number | null = null;

  @Output() closeEvent = new EventEmitter<void>();

  constructor() {
    this.vehicleService.loadInitialVehicle().pipe(take(1)).subscribe(vs => {
      this.vehicles = vs;
      const main = vs.find(v => v.isMain);
      if (main) this.selectedVehicleId = main.id;
    });
  }

  get selectedVehicle() {
    return this.vehicles.find(v => v.id === this.selectedVehicleId);
  }

  close() {
    this.closeEvent.emit();
  }

  save() {
    if (!this.selectedVehicleId || !this.amount) return;
    
    const v = this.selectedVehicle!;
    const newFuel = (v.currentFuelGallons || 0) + this.amount;
    
    // Update the vehicle's current fuel level
    this.vehicleService.updateVehicle(v.id, { currentFuelGallons: newFuel }).subscribe(() => {
        // Here we could ideally create a fuel_record in the backend too
        // For now, updating the vehicle is the core requirement
        this.close();
        window.location.reload(); // Quick way to refresh dashboard
    });
  }
}
