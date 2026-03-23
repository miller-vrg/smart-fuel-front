import { Component, inject, EventEmitter, Output, ChangeDetectionStrategy, signal, computed } from '@angular/core';
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
              <option *ngFor="let v of vehicles" [value]="v.id">
                {{ v.brand }} {{ v.model }} ({{ v.licensePlate }})
              </option>
            </select>
          </div>

          <div class="unit-toggle">
            <button type="button" [class.active]="unit() === 'liters'" (click)="setUnit('liters')">Litros (L)</button>
            <button type="button" [class.active]="unit() === 'gallons'" (click)="setUnit('gallons')">Galones (Gal)</button>
          </div>

          <div class="form-grid">
            <div class="form-group">
              <label>Precio por {{ unitLabel() }}</label>
              <input type="number" [(ngModel)]="pricePerUnit" name="price" placeholder="0" (input)="onInputChange()">
            </div>
            <div class="form-group">
              <label>Dinero Total</label>
              <input type="number" [(ngModel)]="totalMoney" name="money" placeholder="0" (input)="onInputChange()">
            </div>
          </div>

          <div class="form-group amount-highlight">
            <label>Cantidad Calculada ({{ unitLabel() }})</label>
            <div class="amount-display">
              <span class="value">{{ calculatedAmount() | number:'1.2-2' }}</span>
              <span class="symbol">{{ unit() === 'liters' ? 'L' : 'Gal' }}</span>
            </div>
            <p class="helper">Basado en el dinero y el precio ingresado</p>
          </div>

          <div class="info-banner" *ngIf="selectedVehicle()">
            <span class="material-symbols-outlined">info</span>
            <p>El tanque actual tiene {{ currentFuelInUnits() | number:'1.2-2' }} {{ unit() === 'liters' ? 'L' : 'gal' }}.</p>
          </div>

          <footer class="modal-footer">
            <button type="button" class="btn-secondary" (click)="close()">Cancelar</button>
            <button type="submit" class="btn-primary" [disabled]="!calculatedAmount() || !selectedVehicleId">
              Guardar Registro
            </button>
          </footer>
        </form>
      </div>
    </div>
  `,
  styles: [`
    .refill-modal-backdrop {
      position: fixed;
      inset: 0;
      background: rgba(0,0,0,0.6);
      z-index: 2000;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 16px;
      backdrop-filter: blur(8px);
    }
    .refill-modal-card {
      background: var(--surface);
      width: 100%;
      max-width: 440px;
      border-radius: 28px;
      padding: 32px;
      box-shadow: 0 20px 40px rgba(0,0,0,0.3);
      border: 1px solid rgba(255, 255, 255, 0.1);
    }
    header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 24px;
    }
    h2 { margin: 0; font-size: 1.4rem; font-weight: 700; color: var(--on-surface); letter-spacing: -0.02em; }
    .close-btn { 
      background: var(--surface-container-high); 
      border: none; 
      color: var(--on-surface-variant); 
      cursor: pointer; 
      width: 40px; 
      height: 40px; 
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.2s;
    }
    .close-btn:hover { background: var(--surface-container-highest); transform: scale(1.1); }
    
    .unit-toggle {
      display: flex;
      background: var(--surface-container-high);
      padding: 4px;
      border-radius: 14px;
      margin-bottom: 24px;
    }
    .unit-toggle button {
      flex: 1;
      padding: 10px;
      border-radius: 10px;
      font-size: 0.9rem;
      font-weight: 600;
      background: transparent;
      color: var(--on-surface-variant);
      transition: all 0.2s;
    }
    .unit-toggle button.active {
      background: var(--primary);
      color: var(--on-primary);
      box-shadow: 0 4px 12px rgba(var(--primary-rgb), 0.3);
    }

    .form-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 16px;
      margin-bottom: 20px;
    }

    .form-group { margin-bottom: 20px; display: flex; flex-direction: column; gap: 8px; }
    label { font-size: 0.85rem; color: var(--on-surface-variant); font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; }
    
    input, select {
      padding: 14px;
      border-radius: 16px;
      border: 1px solid var(--outline-variant);
      background: var(--surface-container-lowest);
      color: var(--on-surface);
      font-size: 1rem;
      font-weight: 500;
      transition: border-color 0.2s;
    }
    input:focus { border-color: var(--primary); outline: none; }

    .amount-highlight {
      background: var(--surface-container-high);
      padding: 20px;
      border-radius: 20px;
      align-items: center;
      text-align: center;
    }
    .amount-display {
      display: flex;
      align-items: baseline;
      gap: 8px;
    }
    .amount-display .value { font-size: 2.5rem; font-weight: 800; color: var(--primary); font-family: var(--font-headline); }
    .amount-display .symbol { font-size: 1.2rem; font-weight: 600; color: var(--on-surface-variant); }
    .helper { margin: 0; font-size: 0.75rem; color: var(--on-surface-variant); opacity: 0.7; }

    .info-banner {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 14px 18px;
      background: rgba(var(--primary-rgb), 0.08);
      color: var(--primary);
      border-radius: 16px;
      margin-bottom: 24px;
      border: 1px solid rgba(var(--primary-rgb), 0.1);
    }
    .info-banner p { margin: 0; font-size: 0.9rem; font-weight: 500; }

    .modal-footer {
      display: flex;
      gap: 12px;
      margin-top: 8px;
    }
    .modal-footer button { flex: 1; padding: 14px; border-radius: 18px; font-size: 1rem; transition: transform 0.1s; }
    .modal-footer button:active { transform: scale(0.98); }
    .btn-primary { background: var(--primary); color: var(--on-primary); box-shadow: 0 8px 20px rgba(var(--primary-rgb), 0.25); }
    .btn-secondary { background: var(--surface-container-high); color: var(--on-surface); }
    button:disabled { opacity: 0.4; cursor: not-allowed; }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class FuelRefillComponent {
  private vehicleService = inject(VehicleService);
  
  vehicles: Vehicle[] = [];
  selectedVehicleId: string = '';
  
  // Inputs
  pricePerUnit: number | null = null;
  totalMoney: number | null = null;
  
  // Units state
  unit = signal<'liters' | 'gallons'>('liters');
  
  @Output() closeEvent = new EventEmitter<void>();

  // Constants
  readonly GAL_TO_L = 3.78541;

  unitLabel = computed(() => this.unit() === 'liters' ? 'Litro' : 'Galón');
  
  calculatedAmount = computed(() => {
    if (!this.pricePerUnit || !this.totalMoney) return 0;
    return this.totalMoney / this.pricePerUnit;
  });

  constructor() {
    this.vehicleService.loadInitialVehicle().pipe(take(1)).subscribe(vs => {
      this.vehicles = vs;
      const main = vs.find(v => v.isMain);
      if (main) this.selectedVehicleId = main.id;
    });
  }

  selectedVehicle() {
    return this.vehicles.find(v => v.id === this.selectedVehicleId);
  }

  currentFuelInUnits() {
    const v = this.selectedVehicle();
    if (!v) return 0;
    return this.unit() === 'liters' 
      ? v.currentFuelGallons * this.GAL_TO_L 
      : v.currentFuelGallons;
  }

  setUnit(u: 'liters' | 'gallons') {
    this.unit.set(u);
  }

  onInputChange() {
    // This triggers angular change detection due to ngModel-signal interaction if needed
    // In this case, computed() handles it.
  }

  close() {
    this.closeEvent.emit();
  }

  save() {
    const amountInSelectedUnit = this.calculatedAmount();
    if (!this.selectedVehicleId || !amountInSelectedUnit) return;
    
    const v = this.selectedVehicle()!;
    
    // Convert to gallons for backend
    const addedGallons = this.unit() === 'liters' 
      ? amountInSelectedUnit / this.GAL_TO_L 
      : amountInSelectedUnit;

    const newFuel = (v.currentFuelGallons || 0) + addedGallons;
    
    this.vehicleService.updateVehicle(v.id, { currentFuelGallons: newFuel }).subscribe(() => {
        this.close();
        window.location.reload(); 
    });
  }
}
