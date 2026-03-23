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

        <form (ngSubmit)="save()" *ngIf="!showSuccess()">
          <div class="form-group">
            <label>Vehículo</label>
            <select [(ngModel)]="selectedVehicleId" name="vehicleId" required>
              <option *ngFor="let v of vehicles" [value]="v.id">
                {{ v.brand }} {{ v.model }} ({{ v.licensePlate }})
              </option>
            </select>
          </div>

          <div class="form-group">
            <label>Unidad de Medida</label>
            <select [ngModel]="unit()" (ngModelChange)="setUnit($event)" name="unit">
              <option value="gallons">Galones (Gal)</option>
              <option value="liters">Litros (L)</option>
            </select>
          </div>

          <div class="form-column">
            <div class="form-group">
              <label>Precio por {{ unitLabel() }}</label>
              <input type="number" [ngModel]="pricePerUnitSig()" (ngModelChange)="pricePerUnitSig.set($event)" name="price" placeholder="0">
            </div>
            <div class="form-group">
              <label>Dinero Total</label>
              <input type="number" [ngModel]="totalMoneySig()" (ngModelChange)="totalMoneySig.set($event)" name="money" placeholder="0">
            </div>
            <div class="form-group">
              <label>Odómetro Actual (Opcional)</label>
              <input type="number" [ngModel]="odometerSig()" (ngModelChange)="odometerSig.set($event)" name="odometer" placeholder="Km">
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
            <button type="button" class="btn-secondary" (click)="close()" [disabled]="isSaving()">Cancelar</button>
            <button type="submit" class="btn-primary" [disabled]="!calculatedAmount() || !selectedVehicleId || isSaving()">
              {{ isSaving() ? 'Guardando...' : 'Guardar Registro' }}
            </button>
          </footer>
        </form>

        <div class="success-message" *ngIf="showSuccess()">
          <span class="material-symbols-outlined check-icon">check_circle</span>
          <h3>¡Registro Guardado!</h3>
          <p>El historial de combustible ha sido actualizado.</p>
        </div>
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
      max-width: 400px;
      border-radius: 24px;
      padding: 24px;
      box-shadow: 0 20px 40px rgba(0,0,0,0.3);
      border: 1px solid rgba(255, 255, 255, 0.1);
    }
    header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 16px;
    }
    h2 { margin: 0; font-size: 1.15rem; font-weight: 700; color: var(--on-surface); letter-spacing: -0.01em; }
    .close-btn { 
      background: var(--surface-container-high); 
      border: none; 
      color: var(--on-surface-variant); 
      cursor: pointer; 
      width: 32px; 
      height: 32px; 
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
      padding: 3px;
      border-radius: 12px;
      margin-bottom: 16px;
    }
    .unit-toggle button {
      flex: 1;
      padding: 8px;
      border-radius: 9px;
      font-size: 0.85rem;
      font-weight: 600;
      background: transparent;
      color: var(--on-surface-variant);
      transition: all 0.2s;
    }
    .unit-toggle button.active {
      background: var(--primary);
      color: var(--on-primary);
    }

    .form-column {
      display: flex;
      flex-direction: column;
      gap: 12px;
      margin-bottom: 16px;
    }

    .form-group { margin-bottom: 12px; display: flex; flex-direction: column; gap: 4px; }
    label { font-size: 0.8rem; color: var(--on-surface-variant); font-weight: 600; text-transform: uppercase; letter-spacing: 0.03em; }
    
    input, select {
      padding: 10px 12px;
      border-radius: 12px;
      border: 1px solid var(--outline-variant);
      background: var(--surface-container-lowest);
      color: var(--on-surface);
      font-size: 0.95rem;
      font-weight: 500;
      transition: border-color 0.2s;
    }
    input:focus { border-color: var(--primary); outline: none; }

    .amount-highlight {
      background: var(--surface-container-high);
      padding: 12px 16px;
      border-radius: 16px;
      align-items: center;
      text-align: center;
      margin-bottom: 16px;
    }
    .amount-display {
      display: flex;
      align-items: baseline;
      gap: 6px;
    }
    .amount-display .value { font-size: 1.75rem; font-weight: 800; color: var(--primary); font-family: var(--font-headline); }
    .amount-display .symbol { font-size: 1rem; font-weight: 600; color: var(--on-surface-variant); }
    .helper { margin: 0; font-size: 0.7rem; color: var(--on-surface-variant); opacity: 0.7; }

    .info-banner {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 10px 14px;
      background: rgba(var(--primary-rgb), 0.08);
      color: var(--primary);
      border-radius: 12px;
      margin-bottom: 16px;
      border: 1px solid rgba(var(--primary-rgb), 0.1);
    }
    .info-banner p { margin: 0; font-size: 0.85rem; font-weight: 500; }

    .modal-footer {
      display: flex;
      gap: 10px;
      margin-top: 4px;
    }
    .modal-footer button { flex: 1; padding: 10px; border-radius: 14px; font-size: 0.95rem; transition: transform 0.1s; }
    .modal-footer button:active { transform: scale(0.98); }
    .btn-primary { background: var(--primary); color: var(--on-primary); box-shadow: 0 8px 20px rgba(var(--primary-rgb), 0.25); }
    .btn-secondary { background: var(--surface-container-high); color: var(--on-surface); }
    button:disabled { opacity: 0.4; cursor: not-allowed; }

    .success-message {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 40px 0;
      text-align: center;
      animation: zoom-in 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
    }
    .check-icon { font-size: 64px; color: var(--primary); margin-bottom: 16px; font-variation-settings: 'FILL' 1; }
    .success-message h3 { margin: 0; font-size: 1.5rem; color: var(--on-surface); }
    .success-message p { margin: 8px 0 0; color: var(--on-surface-variant); }

    @keyframes zoom-in {
      from { transform: scale(0.8); opacity: 0; }
      to { transform: scale(1); opacity: 1; }
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class FuelRefillComponent {
  private vehicleService = inject(VehicleService);
  
  vehicles: Vehicle[] = [];
  selectedVehicleId: string = '';
  
  // Reactive signals for the form
  pricePerUnitSig = signal<number | null>(null);
  totalMoneySig = signal<number | null>(null);
  odometerSig = signal<number | null>(null);
  
  // UI States
  isSaving = signal(false);
  showSuccess = signal(false);

  // Units state
  unit = signal<'liters' | 'gallons'>('gallons');
  
  @Output() closeEvent = new EventEmitter<void>();

  // Constants
  readonly GAL_TO_L = 3.78541;

  unitLabel = computed(() => this.unit() === 'liters' ? 'Litro' : 'Galón');
  
  calculatedAmount = computed(() => {
    const price = this.pricePerUnitSig();
    const money = this.totalMoneySig();
    if (!price || !money || price <= 0) return 0;
    return money / price;
  });

  constructor() {
    this.vehicleService.loadInitialVehicle().pipe(take(1)).subscribe(vs => {
      this.vehicles = vs;
      // Default to the globally selected vehicle
      const activeId = this.vehicleService.getActiveVehicleId();
      if (activeId) {
        this.selectedVehicleId = activeId;
      } else {
        const main = vs.find(v => v.isMain);
        if (main) this.selectedVehicleId = main.id;
      }
    });
  }

  selectedVehicle() {
    return this.vehicles.find(v => v.id === this.selectedVehicleId);
  }

  currentFuelInUnits() {
    const v = this.selectedVehicle();
    if (!v) return 0;
    const val = this.unit() === 'liters' 
      ? v.currentFuelGallons * this.GAL_TO_L 
      : v.currentFuelGallons;
    return Math.round(val * 100) / 100;
  }

  setUnit(u: 'liters' | 'gallons') {
    this.unit.set(u);
  }

  close() {
    if (this.isSaving()) return;
    this.closeEvent.emit();
  }

  save() {
    const amountInSelectedUnit = this.calculatedAmount();
    if (!this.selectedVehicleId || !amountInSelectedUnit || this.isSaving()) return;
    
    this.isSaving.set(true);
    const v = this.selectedVehicle()!;
    
    // Convert to gallons for backend
    const gallonsAdded = this.unit() === 'liters' 
      ? amountInSelectedUnit / this.GAL_TO_L 
      : amountInSelectedUnit;

    const pricePerGallon = this.unit() === 'liters'
      ? (this.pricePerUnitSig() || 0) * this.GAL_TO_L
      : (this.pricePerUnitSig() || 0);

    const dto = {
      vehicleId: v.id,
      gallonsAdded: Math.round(gallonsAdded * 100) / 100,
      pricePerGallon: Math.round(pricePerGallon * 100) / 100,
      odometer: this.odometerSig(),
      stationName: 'Registro Manual',
      notes: `Registro de tanqueo via App (${this.unit()})`
    };

    this.vehicleService.addFuelLog(dto).subscribe({
      next: () => {
        this.showSuccess.set(true);
        this.vehicleService.refreshData(); // Global refresh
        // Close after 1.5s
        setTimeout(() => {
          this.closeEvent.emit();
        }, 1500);
      },
      error: (err) => {
        console.error('Error saving fuel log:', err);
        this.isSaving.set(false);
      }
    });
  }
}
