import {
  Component,
  ChangeDetectionStrategy,
  OnInit,
  OnDestroy,
  ChangeDetectorRef,
  inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { take } from 'rxjs';

import { MapService } from '@core/services/map.service';
import { PreferencesService } from '@core/services/preferences.service';
import { VehicleService } from '@core/services/vehicle.service';
import { Preference } from '@core/interfaces/preference.interface';
import { Vehicle } from '@core/interfaces/vehicle.interface';

import { environment } from '@env/environment';
import { UserPosition } from './navigate.interfaces';

@Component({
    selector: 'app-navigate',
    imports: [CommonModule, FormsModule],
    templateUrl: './navigate.component.html',
    styleUrl: './navigate.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class NavigateComponent implements OnInit, OnDestroy {
  private cdr = inject(ChangeDetectorRef);
  private prefService = inject(PreferencesService);
  private vehicleService = inject(VehicleService);
  private mapService = inject(MapService);
  
  private watchId: number | null = null;
  private userPreferences: Preference | null = null;
  activeVehicle: Vehicle | null = null;

  userPosition: UserPosition | null = null;
  destination: UserPosition | null = null;
  destinationName: string = 'Destino seleccionado';

  isNavigating = false;
  locationReady = false;
  geoError: string | null = null;

  maneuver = { icon: 'turn_right', distance: 'Calculando...', street: 'Ruta hacia destino' };
  eta = 0;
  arrivalTime = '--:--';
  routeDistance = '0 km';
  currentSpeed = 0;
  
  showManeuver = false;
  isArrivalBarCondensed = false;
  isAutonomyCritical = false;
  private maneuverTimeout: any;
  private arrivalBarTimeout: any;

  // Search properties
  searchQuery = '';
  searchResults: any[] = [];
  isSearching = false;
  protected Math = Math;

  formatDuration(seconds: number): string {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.ceil((seconds % 3600) / 60);
    if (hours > 0) {
      return `${hours} h ${minutes} min`;
    }
    return `${minutes} min`;
  }

  // Vehicle Selection
  availableVehicles: Vehicle[] = [];
  showVehicleSelector = false;
  
  possibleRoutes: any[] = [];
  selectedRouteIndex = 0;
  showRouteList = false;
  
  showAddVehicleModal = false;
  showSpeedAlert = false;
  newVehicleForm: Partial<Vehicle> = {
    brand: '',
    model: '',
    licensePlate: '',
    year: new Date().getFullYear().toString(),
    fuelCapacityGallons: undefined,
    avgKmPerGallon: undefined,
    currentFuelGallons: undefined,
    safetyBuffer: 0.15
  };

  // Store exact polyline array to plot markers ON the route
  detailedRouteCoords: number[][] = [];
  
  // Real-time tracking & Navigation Logic
  private lastPosition: UserPosition | null = null;
  private totalKmTraveled: number = 0;
  private lastKmUpdate: number = 0; // for periodic backend updates
  private currentRouteSteps: any[] = [];
  private nextStepIndex: number = 0;
  private lastRecalculationTime = 0;
  
  maneuverIcon = 'navigation';
  maneuverDistance = '';
  maneuverStreet = '';

  // Custom Trip Alert Modal
  showTripAlertModal = false;
  tripAlertData: { title: string; message: string; detail: string } | null = null;

  ngOnInit(): void {
    this.startWatchingPosition();
    this.loadPreferences();

    // Listen for global map clicks
    this.mapService.mapClick.subscribe(event => {
       this.onMapClick(event);
    });
  }

  ngOnDestroy(): void {
    this.stopWatchingPosition();
  }

  private loadPreferences() {
    this.vehicleService.loadInitialVehicle().pipe(take(1)).subscribe(vs => {
      if (vs && vs.length > 0) {
        this.availableVehicles = vs;
        
        // Auto-seleccionar el vehículo principal si existe
        const mainV = vs.find(v => v.isMain);
        if (mainV && !this.activeVehicle) {
          this.activeVehicle = mainV;
        }

        // Solo cargar preferencias si hay un vehículo activo
        if (this.activeVehicle) {
          this.prefService.getByVehicle(this.activeVehicle.id).pipe(take(1)).subscribe(pref => {
            this.userPreferences = pref;
          });
        }
      }
    });
  }

  // ─── Geolocation ─────────────────────────────

  private startWatchingPosition(): void {
    if (!navigator.geolocation) {
      this.geoError = 'Geolocation no soportada';
      this.cdr.markForCheck();
      return;
    }

    this.watchId = navigator.geolocation.watchPosition(
      (pos) => {
        this.userPosition = {
          lng: pos.coords.longitude,
          lat: pos.coords.latitude,
          accuracy: pos.coords.accuracy,
          heading: pos.coords.heading ?? undefined,
        };
        this.currentSpeed = Math.round((pos.coords.speed ?? 0) * 3.6); // m/s to km/h
        
        const isFirstLocation = !this.locationReady;
        this.locationReady = true;
        this.geoError = null;

        this.mapService.setUserLocation(this.userPosition.lng, this.userPosition.lat, this.userPosition.heading);

        // Real-time Navigation & Fuel Tracking Logic
        if (this.isNavigating && this.activeVehicle) {
          this.processNavigationUpdate(this.userPosition);
        }

        if (isFirstLocation) {
          this.mapService.flyTo(this.userPosition.lng, this.userPosition.lat, 15);
          
          const savedStr = localStorage.getItem('smartFuel_activeTrip');
          if (savedStr) {
            try {
              const state = JSON.parse(savedStr);
              this.destination = state.destination;
              this.destinationName = state.destinationName;
              this.mapService.setDestinationMarker(this.destination!.lng, this.destination!.lat);
              
              setTimeout(() => {
                const vehicle = this.availableVehicles.find(v => v.id === state.vehicleId) || this.activeVehicle;
                if (state.destination && state.destination.lng) {
                   this.destination = state.destination;
                   this.destinationName = state.destinationName || 'Destino';
                   
                   this.mapService.setDestinationMarker(this.destination?.lng as number, this.destination?.lat as number);
                   
                   if (this.userPosition && this.destination) {
                      this.calculateRoute(this.userPosition, this.destination).then(() => {
                         if (state.selectedRouteIndex !== undefined) {
                            this.selectRouteIndex(state.selectedRouteIndex);
                         }
                         if (state.isNavigating) {
                            this.isNavigating = true;
                            this.showRouteList = false;
                            this.updateManeuver({ icon: 'navigation', distance: 'En ruta', street: this.destinationName });
                         } else {
                            this.showRouteList = true;
                         }
                         if (vehicle) this.confirmVehicle(vehicle);
                         this.cdr.markForCheck();
                      });
                   }
                }
              }, 500);
            } catch (e) {
              console.error('Error restaurando viaje', e);
            }
          }
        }
        
        this.lastPosition = this.userPosition;
        this.cdr.markForCheck();
      },
      (err) => {
        this.geoError = err.message;
        this.cdr.markForCheck();
      },
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 }
    );
  }

  private stopWatchingPosition(): void {
    if (this.watchId !== null) {
      navigator.geolocation.clearWatch(this.watchId);
      this.watchId = null;
    }
  }

  private processNavigationUpdate(currentPos: UserPosition): void {
    if (!this.activeVehicle || !this.destination) return;

    // Update current speed (m/s to km/h)
    this.currentSpeed = Math.round((currentPos.speed || 0) * 3.6);

    // 1. Calculate delta distance & Fuel consumption
    if (this.lastPosition) {
      const deltaKm = this.calculateDistance(this.lastPosition, currentPos);
      if (deltaKm > 0) {
        this.totalKmTraveled += deltaKm;
        
        // Decrement fuel: Gal = Km / (Km/Gal)
        const gallonsConsumed = deltaKm / (this.activeVehicle.avgKmPerGallon || 30);
        this.activeVehicle.currentFuelGallons = Math.max(0, this.activeVehicle.currentFuelGallons - gallonsConsumed);
        
        // Update vehicle total KM if tracked (optional, we use totalKmTraveled for autonomy)
        // Periodic sync with backend (every 1 KM)
        if (this.totalKmTraveled - this.lastKmUpdate >= 1) {
           this.lastKmUpdate = this.totalKmTraveled;
           this.vehicleService.updateVehicle(this.activeVehicle.id, { 
             currentFuelGallons: this.activeVehicle.currentFuelGallons 
           }).subscribe();
        }
      }
    }

    // 2. Maneuver Logic (Turn-by-turn)
    if (this.currentRouteSteps.length > 0 && this.nextStepIndex < this.currentRouteSteps.length) {
      const step = this.currentRouteSteps[this.nextStepIndex];
      const stepCoord = { lng: step.maneuver.location[0], lat: step.maneuver.location[1] };
      const distToStep = this.calculateDistance(currentPos, stepCoord) * 1000; // in meters

      // Update instructions
      const icon = this.getManeuverIcon(step.maneuver.type, step.maneuver.modifier);
      const distText = distToStep > 1000 
        ? `${(distToStep / 1000).toFixed(1)} km` 
        : `${Math.round(distToStep)} m`;
      
      this.updateManeuver({
        icon,
        distance: distText,
        street: step.name || step.maneuver.instruction
      });

      // Advance step if within 30m
      if (distToStep < 30) {
        this.nextStepIndex++;
      }
    }

    // 3. Off-route detection (Simplified: distance to next step coordinate OR distance to current segment)
    // If not first step, and we are far from the path
    const now = Date.now();
    if (now - this.lastRecalculationTime > 10000) { // Max once every 10s
       // Check distance to closest segment in detailedRouteCoords
       let minLineDist = Infinity;
       for (let i = 0; i < this.detailedRouteCoords.length - 1; i++) {
          const d = this.distanceToSegment(currentPos, this.detailedRouteCoords[i] as any, this.detailedRouteCoords[i + 1] as any);
          if (d < minLineDist) minLineDist = d;
       }

       if (minLineDist > 0.1) { // 100 meters off-route
          this.lastRecalculationTime = now;
          this.calculateRoute(currentPos, this.destination).then(() => {
             this.executeTripLogic(); // restart logic with new steps
          });
       }
    }

    this.monitorSpeed();
    this.evaluateTripRules();
    this.lastPosition = currentPos;
  }

  private updateManeuver(data: any): void {
    this.maneuver = data;
    this.maneuverIcon = data.icon;
    this.maneuverDistance = data.distance;
    this.maneuverStreet = data.street;
    this.showManeuver = true;
    this.cdr.markForCheck();

    if (this.maneuverTimeout) clearTimeout(this.maneuverTimeout);
    this.maneuverTimeout = setTimeout(() => {
      this.showManeuver = false;
      this.cdr.markForCheck();
    }, 5000);
  }

  private calculateDistance(p1: { lat: number; lng: number }, p2: { lat: number; lng: number }): number {
    const R = 6371; // km
    const dLat = (p2.lat - p1.lat) * Math.PI / 180;
    const dLon = (p2.lng - p1.lng) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(p1.lat * Math.PI / 180) * Math.cos(p2.lat * Math.PI / 180) *
              Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  private distanceToSegment(p: UserPosition, a: [number, number], b: [number, number]): number {
    const x = p.lng, y = p.lat;
    const x1 = a[0], y1 = a[1];
    const x2 = b[0], y2 = b[1];

    const A = x - x1, B = y - y1, C = x2 - x1, D = y2 - y1;
    const dot = A * C + B * D;
    const lenSq = C * C + D * D;
    let param = -1;
    if (lenSq !== 0) param = dot / lenSq;

    let xx, yy;
    if (param < 0) {
      xx = x1; yy = y1;
    } else if (param > 1) {
      xx = x2; yy = y2;
    } else {
      xx = x1 + param * C;
      yy = y1 + param * D;
    }

    const dx = x - xx, dy = y - yy;
    // result in degrees (~111km per degree), convert to km roughly
    return Math.sqrt(dx * dx + dy * dy) * 111.32;
  }




  // ─── Search (Nominatim) ──────────────────────

  async searchDestination(): Promise<void> {
    if (!this.searchQuery.trim() || this.isNavigating) return;
    
    this.isSearching = true;
    this.cdr.markForCheck();
    
    try {
      const resp = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(this.searchQuery)}&format=json&limit=5&addressdetails=1`);
      this.searchResults = await resp.json();
    } catch (e) {
      console.error('Error in search', e);
    } finally {
      this.isSearching = false;
      this.cdr.markForCheck();
    }
  }

  async selectSearchResult(result: any): Promise<void> {
    if (this.isNavigating) return;

    this.searchResults = [];
    this.searchQuery = result.display_name;
    this.destinationName = result.name || result.display_name.split(',')[0];
    const lat = parseFloat(result.lat);
    const lng = parseFloat(result.lon);
    
    await this.onMapClick({ lng, lat }, true);
  }

  // ─── Map controls & Routing ──────────────────

  onMapReady(): void {
    if (this.userPosition) {
      this.mapService.setUserLocation(this.userPosition.lng, this.userPosition.lat, this.userPosition.heading);
      this.mapService.flyTo(this.userPosition.lng, this.userPosition.lat, 15);
    }
  }

  /** Al tocar el mapa, se define el destino y se calcula trazado */
  async onMapClick(event: { lng: number; lat: number }, fromSearch = false): Promise<void> {
    // If route list is open, close it but keep selection
    if (this.showRouteList) {
      this.showRouteList = false;
      this.cdr.markForCheck();
      return;
    }
    if (!this.userPosition || this.isNavigating || (!fromSearch && this.possibleRoutes.length > 0)) return;
    
    this.searchResults = []; // clear search
    if (!fromSearch) {
      this.destinationName = 'Destino seleccionado';
      this.searchQuery = '';
    }
    
    this.destination = { lng: event.lng, lat: event.lat };
    this.mapService.setDestinationMarker(event.lng, event.lat);
    
    await this.calculateRoute(this.userPosition, this.destination);
  }

  private async calculateRoute(start: UserPosition, end: UserPosition): Promise<void> {
    try {
      this.mapService.clearRouteAndMarkers(); // Eliminar rutas pasadas
      
      const osrmUrl = `${environment.osrmUrl}/${start.lng},${start.lat};${end.lng},${end.lat}?overview=full&geometries=geojson&alternatives=3&steps=true`;
      const response = await fetch(osrmUrl);
      const data = await response.json();

      if (data.code === 'Ok' && data.routes.length > 0) {
        this.possibleRoutes = data.routes.map((r: any, i: number) => {
           let stops = 0;
           if (this.activeVehicle && this.userPreferences) {
              const km = r.distance / 1000;
              const autonomy = (this.activeVehicle.currentFuelGallons * this.activeVehicle.avgKmPerGallon) || 300;
              const safeAuto = autonomy - (this.userPreferences.notifyGasStationKmBefore ?? 20);
              stops = Math.floor(km / safeAuto);
           }
           
            return {
              index: i,
              duration: r.duration,
              formattedDuration: this.formatDuration(r.duration),
              distance: r.distance,
              geometry: r.geometry,
              summary: r.legs?.[0]?.summary || (i === 0 ? 'Ruta Principal' : `Ruta Alternativa ${i}`),
              stopsRequired: Math.max(0, stops),
              steps: r.legs?.[0]?.steps || []
            };
         });

        this.showRouteList = true;
        this.selectRouteIndex(0);
      }
    } catch (e) {
      console.error('Error calculando ruta:', e);
    }
  }

  selectRouteIndex(index: number): void {
     this.selectedRouteIndex = index;
     const route = this.possibleRoutes[index];
     
     const distKm = Math.round(route.distance / 1000).toString();
     const mins = Math.ceil(route.duration / 60);
        
     const arrivalDate = new Date();
     arrivalDate.setMinutes(arrivalDate.getMinutes() + mins);
     this.arrivalTime = arrivalDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

     this.routeDistance = `${distKm}`;
     this.eta = mins;
     
     this.mapService.clearRouteAndMarkers();
     this.mapService.setDestinationMarker(this.destination!.lng, this.destination!.lat);
     
     this.detailedRouteCoords = route.geometry.coordinates;
     this.currentRouteSteps = route.steps;
     this.nextStepIndex = 0;
     
     this.mapService.drawRoute(this.detailedRouteCoords);
     
     // Set initial maneuver
     if (this.currentRouteSteps.length > 0) {
        const step = this.currentRouteSteps[0];
        this.updateManeuver({ 
            icon: this.getManeuverIcon(step.maneuver.type, step.maneuver.modifier), 
            distance: '0 m', 
            street: step.name || step.maneuver.instruction 
        });
     } else {
        this.updateManeuver({ icon: 'straight', distance: 'Calculada', street: this.destinationName });
     }

     this.evaluateTripRules();
     this.saveTripState();
     this.cdr.markForCheck();
  }

  private getManeuverIcon(type: string, modifier?: string): string {
    if (type === 'turn') {
      if (modifier?.includes('left')) return 'turn_left';
      if (modifier?.includes('right')) return 'turn_right';
      return 'near_me';
    }
    if (type === 'merge') return 'merge';
    if (type === 'roundabout') return 'roundabout_right';
    if (type === 'exit') return 'ramp_right';
    if (type === 'arrive') return 'location_on';
    return 'straight';
  }

  private saveTripState(): void {
     if (!this.destination) {
        localStorage.removeItem('smartFuel_activeTrip');
        return;
     }
     const state = {
        destination: this.destination,
        destinationName: this.destinationName,
        vehicleId: this.activeVehicle?.id,
        selectedRouteIndex: this.selectedRouteIndex,
        isNavigating: this.isNavigating
     };
     localStorage.setItem('smartFuel_activeTrip', JSON.stringify(state));
     if (this.activeVehicle && this.isNavigating) {
        this.vehicleService.saveActiveTrip(this.activeVehicle.id, state).subscribe();
     }
  }

  openRouteList(): void {
    this.showRouteList = true;
    this.cdr.markForCheck();
  }

  toggleRouteList(): void {
    this.showRouteList = !this.showRouteList;
    this.cdr.markForCheck();
  }

  startCurrentRoute(): void {
    this.executeTripLogic();
    this.showRouteList = false;
    this.cdr.markForCheck();
  }


  clearSearch(): void {
    this.searchQuery = '';
    this.searchResults = [];
    this.possibleRoutes = [];
    this.destination = null;
    this.mapService.clearRouteAndMarkers();
    
    // Always clear persistent state on cancel/clear
    localStorage.removeItem('smartFuel_activeTrip');
    if (this.activeVehicle) {
      this.vehicleService.saveActiveTrip(this.activeVehicle.id, null).subscribe();
    }
    
    this.isNavigating = false;
    this.cdr.markForCheck();
  }

  startNavigationFromAlternative(evt: Event, index: number): void {
     evt.stopPropagation();
     this.selectRouteIndex(index);
     
     if (!this.activeVehicle) {
        this.showVehicleSelector = true;
     } else {
        this.executeTripLogic();
     }
  }

  zoomIn(): void { this.mapService.zoomIn(); }
  zoomOut(): void { this.mapService.zoomOut(); }
  togglePitch(): void {
    this.mapService.togglePitch(
      this.userPosition?.lng,
      this.userPosition?.lat,
      this.userPosition?.heading ?? undefined
    );
  }

  centerOnUser(): void {
    if (this.userPosition) {
      this.mapService.flyTo(this.userPosition.lng, this.userPosition.lat, 16);
    }
  }

  // ─── Utilities ───────────────────────────────



  // ─── Trip execution ──────────────────────────

  startTrip(): void {
    if (this.availableVehicles.length > 0 && !this.activeVehicle) {
      this.showVehicleSelector = true;
    } else if (this.activeVehicle) {
      this.executeTripLogic();
    }
  }

  confirmVehicle(vehicle: Vehicle): void {
    this.showVehicleSelector = false;
    this.activeVehicle = vehicle;
    
    // Cargar preferencias del vehiculo específico y recalcular paradas
    this.prefService.getByVehicle(vehicle.id).pipe(take(1)).subscribe(pref => {
      this.userPreferences = pref;
      
      if (this.destination && this.possibleRoutes.length > 0) {
         // Reload the current route context to replace new stops
         this.selectRouteIndex(this.selectedRouteIndex);
         
         // Fix dynamic route array texts
         this.possibleRoutes.forEach(r => {
            const km = r.distance / 1000;
            const autonomy = (this.activeVehicle?.currentFuelGallons ?? 0) * (this.activeVehicle?.avgKmPerGallon ?? 0) || 300;
            const safeAuto = autonomy - (this.userPreferences?.notifyGasStationKmBefore ?? 20);
            r.stopsRequired = Math.max(0, Math.floor(km / safeAuto));
         });
      }
      
      if (this.isNavigating) {
         this.executeTripLogic();
      }
    });
  }

  startWithoutVehicle(): void {
    this.showVehicleSelector = false;
    this.activeVehicle = null;
    this.isAutonomyCritical = false;
    this.mapService.clearStopMarkers(); // Limpiar marcadores de paradas previas si existen
    this.mapService.setDestinationMarker(this.destination!.lng, this.destination!.lat);
    this.executeTripLogic();
  }

  // ─── Vehicle Management ────────────────────────
  
  openAddVehicleForm(): void {
    this.showAddVehicleModal = true;
    this.showVehicleSelector = false;
    this.cdr.markForCheck();
  }

  saveNewVehicle(): void {
    if (!this.newVehicleForm.brand || !this.newVehicleForm.licensePlate) {
      alert('La Marca y la Placa son obligatorias.');
      return;
    }
    
    this.vehicleService.createVehicle(this.newVehicleForm).subscribe({
      next: (created) => {
        this.availableVehicles.push(created);
        this.showAddVehicleModal = false;
        
        // Auto-select the newly created vehicle and reset form
        this.confirmVehicle(created);
        this.newVehicleForm = {
          brand: '', model: '', licensePlate: '',
          year: new Date().getFullYear().toString(),
          fuelCapacityGallons: undefined, avgKmPerGallon: undefined, currentFuelGallons: undefined
        };
      },
      error: (err) => {
        alert('Error al crear el vehículo. Revisa los datos o si la placa ya existe.');
        console.error(err);
      }
    });
  }

  private evaluateTripRules(): void {
    if (!this.destination || !this.routeDistance) {
      this.isAutonomyCritical = false;
      return;
    }

    // Si no hay vehículo, no evaluamos autonomía ni paradas de combustible
    if (!this.activeVehicle || !this.userPreferences) {
      this.isAutonomyCritical = false;
      return;
    }

    const autonomy = (this.activeVehicle.currentFuelGallons * this.activeVehicle.avgKmPerGallon) || 300;
    const kmBefore = this.userPreferences.notifyGasStationKmBefore ?? 20;
    const hoursRest = this.userPreferences.notifyRestStopHours ?? null;
    const routeKm = parseFloat(this.routeDistance);
    
    this.isAutonomyCritical = routeKm > (autonomy - kmBefore);

    if (this.isAutonomyCritical) {
      const brandName = this.userPreferences.preferences?.[0]?.brandName || 'Surtidor Compatible';
      const safeAutonomy = autonomy - kmBefore;
      const numStops = Math.floor(routeKm / safeAutonomy);
      
      if (this.isNavigating) {
        this.tripAlertData = {
          title: '¡Atención! Autonomía Baja',
          message: `La ruta exige ${Math.round(routeKm)} km, pero tu tanque alcanza para ~${Math.round(autonomy)} km.`,
          detail: `Pautaremos ${numStops} paradas recargando en ${brandName}.`
        };
        this.showTripAlertModal = true;
      }
      
      if (this.detailedRouteCoords.length > 0) {
        for (let i = 1; i <= numStops; i++) {
          const ratio = (i * safeAutonomy) / routeKm;
          // limit ratio strictly
          const safeRatio = Math.max(0, Math.min(ratio, 0.99));
          const stopIdx = Math.floor(this.detailedRouteCoords.length * safeRatio);
          const stopPoint = this.detailedRouteCoords[stopIdx];
          
          if (!stopPoint) continue;
          
          const popupHtml = `
            <div style="font-family:sans-serif; text-align:center;">
               <strong style="color:var(--primary); font-size:14px;">${brandName} (Parada #${i})</strong><br>
               <span style="font-size:12px; color:#555;">Recarga recomendada</span><br>
               <span style="font-size:10px; color:#999;">Lat: ${stopPoint[1].toFixed(4)}, Lng: ${stopPoint[0].toFixed(4)}</span>
            </div>`;
          this.mapService.setSmartStopMarker(stopPoint[0], stopPoint[1], 'local_gas_station', popupHtml);
        }
      }
    } else if (hoursRest !== null && (this.eta / 60) > hoursRest) {
      // 2. Validar tiempo de descanso en viajes largos
      this.tripAlertData = {
        title: 'Sugerencia de Viaje Largo',
        message: `Esta ruta tomará alrededor de ${Math.round(this.eta / 60)}h ${this.eta % 60}m.`,
        detail: `Sugerencia: Hemps programado un punto de descanso luego de ${hoursRest} horas.`
      };
      this.showTripAlertModal = true;
      
      if (this.detailedRouteCoords.length > 0) {
         const qIdx = Math.floor(this.detailedRouteCoords.length * 0.4);
         const qPoint = this.detailedRouteCoords[qIdx];
         const popupHtml = `
          <div style="font-family:sans-serif; text-align:center;">
             <strong style="color:var(--primary); font-size:14px;">Parada de Descanso</strong><br>
             <span style="font-size:12px; color:#555;">Tómate un descanso</span><br>
             <span style="font-size:10px; color:#999;">Lat: ${qPoint[1].toFixed(4)}, Lng: ${qPoint[0].toFixed(4)}</span>
          </div>`;
         this.mapService.setSmartStopMarker(qPoint[0], qPoint[1], 'local_cafe', popupHtml);
      }
    }
    this.cdr.markForCheck();
  }

  private monitorSpeed(): void {
    if (!this.userPreferences?.maxSpeedLimit || !this.isNavigating) return;
    
    if (this.currentSpeed >= this.userPreferences.maxSpeedLimit) {
      if (!this.showSpeedAlert) {
         this.showSpeedAlert = true;
         // Dismiss alert after 3 seconds
         setTimeout(() => {
           this.showSpeedAlert = false;
           this.cdr.markForCheck();
         }, 3000);
      }
    } else {
      this.showSpeedAlert = false;
    }
  }

  getSpeedStatusClass(): string {
    if (!this.userPreferences?.maxSpeedLimit) return '';
    const limit = this.userPreferences.maxSpeedLimit;
    const ratio = this.currentSpeed / limit;
    
    if (ratio >= 1) return 'speed-critical';
    if (ratio >= 0.85) return 'speed-warning';
    return 'speed-normal';
  }

  private executeTripLogic(): void {
    this.isNavigating = true;
    this.updateManeuver({ icon: 'navigation', distance: 'En ruta', street: this.destinationName });

    this.saveTripState();

    this.showRouteList = false;
    this.centerOnUser();      // Center on current position
    
    // Auto-condense HUD after 8 seconds
    if (this.arrivalBarTimeout) clearTimeout(this.arrivalBarTimeout);
    this.isArrivalBarCondensed = false;
    this.arrivalBarTimeout = setTimeout(() => {
      this.isArrivalBarCondensed = true;
      this.cdr.markForCheck();
    }, 8000);

    this.cdr.markForCheck();
  }

  showFullArrivalBar(): void {
    this.isArrivalBarCondensed = false;
    this.cdr.markForCheck();
    
    if (this.arrivalBarTimeout) clearTimeout(this.arrivalBarTimeout);
    this.arrivalBarTimeout = setTimeout(() => {
      this.isArrivalBarCondensed = true;
      this.cdr.markForCheck();
    }, 8000);
  }

  endTrip(): void {
    this.isNavigating = false;
    this.isArrivalBarCondensed = false;
    if (this.arrivalBarTimeout) clearTimeout(this.arrivalBarTimeout);
    
    if (this.activeVehicle) {
      this.vehicleService.saveActiveTrip(this.activeVehicle.id, null).subscribe();
    }
    localStorage.removeItem('smartFuel_activeTrip');
    
    this.destination = null;
    this.searchQuery = '';
    this.destinationName = 'Destino seleccionado';
    this.mapService.clearRouteAndMarkers();
    this.cdr.markForCheck();
  }
}
