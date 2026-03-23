import { Component, ChangeDetectionStrategy, inject, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { BehaviorSubject, switchMap, EMPTY, take } from 'rxjs';

import { PreferencesService } from '@core/services/preferences.service';
import { VehicleService } from '@core/services/vehicle.service';
import { AuthService } from '@core/services/auth.service';
import { Preference } from '@core/interfaces/preference.interface';

import { ToggleSetting, FuelPriority } from './preferences.interfaces';

@Component({
    selector: 'app-preferences',
    standalone: true,
    imports: [CommonModule, FormsModule],
    templateUrl: './preferences.component.html',
    styleUrl: './preferences.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class PreferencesComponent implements OnInit {
  prefService = inject(PreferencesService);
  vehicleService = inject(VehicleService);
  authService = inject(AuthService);
  private cdr = inject(ChangeDetectorRef);

  pref$ = new BehaviorSubject<Preference | null>(null);
  
  displayName = '';
  userEmail = '';

  toggleSettings: ToggleSetting[] = [
    {
      id: 'autoPark',
      icon: 'local_parking',
      label: 'Auto-Park Assist',
      sublabel: 'Intelligent spot finding',
      iconContainerClass: 'toggle-card__icon-box--tertiary',
      enabled: true,
    },
    {
      id: 'predictiveClimate',
      icon: 'thermostat',
      label: 'Predictive Climate',
      sublabel: 'Adjusts via route weather',
      iconContainerClass: 'toggle-card__icon-box--secondary',
      enabled: false,
    },
  ];

  fuelPriorities: FuelPriority[] = [
    { brand: 'Terpel', name: 'Terpel',  description: 'Preferred fueling partner', starred: true },
    { brand: 'Primax', name: 'Primax',  description: 'Secondary choice',          starred: false },
    { brand: 'Texaco', name: 'Texaco',  description: 'Backup option',             starred: false },
  ];

  newBrandName = '';
  
  // Navigation Defaults
  notifyGasStationKmBefore: number = 20;
  notifyRestStopHours: number | null = null;
  maxSpeedLimit: number = 100;

  ngOnInit() {
    const user = this.authService.currentUser();
    if (user) {
      this.displayName = user.name;
      this.userEmail = user.email;
    }

    this.vehicleService.loadInitialVehicle().pipe(
      switchMap(v => (v && v.length > 0) ? this.prefService.getByVehicle(v[0].id) : EMPTY)
    ).subscribe(pref => {
      if (pref) {
        this.pref$.next(pref);
        
        // Load global settings
        this.notifyGasStationKmBefore = pref.notifyGasStationKmBefore ?? 20;
        this.notifyRestStopHours = pref.notifyRestStopHours ?? null;
        this.maxSpeedLimit = pref.maxSpeedLimit ?? 100;
        
        const loaded: FuelPriority[] = [];
        const seen = new Set<string>();
        
        pref.preferences?.forEach(p => {
          loaded.push({ brand: p.brandName, name: p.brandName, description: 'Preferred fueling partner', starred: true });
          seen.add(p.brandName);
        });

        pref.excludedBrands?.forEach(b => {
          if (!seen.has(b)) {
            loaded.push({ brand: b, name: b, description: 'Backup option', starred: false });
            seen.add(b);
          }
        });

        if (loaded.length > 0) {
          this.fuelPriorities = loaded;
        }

        this.cdr.markForCheck();
      }
    });
  }

  toggleSetting(index: number): void {
    this.toggleSettings[index].enabled = !this.toggleSettings[index].enabled;
  }

  toggleStar(item: FuelPriority): void {
    item.starred = !item.starred;
  }

  addBrand() {
    if (this.newBrandName.trim()) {
      const name = this.newBrandName.trim();
      this.fuelPriorities.push({
        brand: name,
        name: name,
        description: 'Custom brand',
        starred: true
      });
      this.newBrandName = '';
    }
  }

  removeBrand(index: number) {
    this.fuelPriorities.splice(index, 1);
  }

  toggleEdit(item: FuelPriority) {
    if (item.isEditing) {
      item.brand = item.name; // Keep internal brand ID synced with edited name
    }
    item.isEditing = !item.isEditing;
  }

  saveConfig(): void {
    const activeBrands = this.fuelPriorities.filter(fp => fp.starred);
    const vehicleId = this.pref$.value?.vehicleId || this.vehicleService.getActiveVehicleId();

    if (!vehicleId) {
      alert('Debes tener un vehículo seleccionado para guardar preferencias.');
      return;
    }
    
    const newPreferences = activeBrands.map((fp, i) => ({
      brandName: fp.brand,
      priority: i + 1,
      onlyHighway: false
    }));

    const updatedPref: Preference = { 
      vehicleId: vehicleId,
      preferences: newPreferences,
      excludedBrands: this.fuelPriorities.filter(fp => !fp.starred).map(fp => fp.brand),
      notifyGasStationKmBefore: this.notifyGasStationKmBefore,
      notifyRestStopHours: this.notifyRestStopHours,
      maxSpeedLimit: this.maxSpeedLimit
    };
    
    this.prefService.updatePreferences(updatedPref).subscribe({
      next: (res) => {
        this.pref$.next(res);
        // Update local profile name if changed
        if (this.displayName.trim()) {
           this.authService.updateLocalProfile(this.displayName.trim());
        }
        this.cdr.markForCheck();
        alert('Preferencias guardadas exitosamente!');
      },
      error: (err) => {
        console.error(err);
        alert('Error al guardar preferencias.');
      }
    });
  }
}
