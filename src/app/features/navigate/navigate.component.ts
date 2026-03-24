import {
  Component,
  OnInit,
  OnDestroy,
  ChangeDetectorRef,
  inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { take } from 'rxjs';

import { MapService } from '@core/services/map.service';
import { VehicleService } from '@core/services/vehicle.service';
import { Preference } from '@core/interfaces/preference.interface';
import { PreferencesService } from '@core/services/preferences.service';
import { NotificationsService } from '@core/services/notifications.service';
import { Vehicle } from '@core/interfaces/vehicle.interface';

import { environment } from '@env/environment';
import { UserPosition } from './navigate.interfaces';
import { AppNotification } from '@/app/core/interfaces/notification.interface';

@Component({
  selector: 'app-navigate',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './navigate.component.html',
  styleUrl: './navigate.component.scss',
  host: {
    class: 'navigate-component'
  }
})
export class NavigateComponent implements OnInit, OnDestroy {
  private cdr = inject(ChangeDetectorRef);
  private prefService = inject(PreferencesService);
  private vehicleService = inject(VehicleService);
  private mapService = inject(MapService);

  private notificationsService = inject(NotificationsService);

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
  showActiveNotification = false;
  activeNotification: any | null = null;
  private notificationTimeout: any = null;
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

  showTripAlertModal = false;
  tripAlertData: { title: string; message: string; detail: string } | null = null;
  private hasShownAutonomyAlert = false;
  private hasShownLowFuelAlert = false;
  private isEvaluatingRules = false;

  // Cache stops so they don't flicker on every GPS update
  cachedSmartStops: { name: string; brand: string; lat: number; lng: number; alerted: boolean }[] = [];

  // Fuel HUD computations
  get fuelLevelPercent(): number {
    if (!this.activeVehicle || !this.activeVehicle.fuelCapacityGallons) return 100;
    return (this.activeVehicle.currentFuelGallons! / this.activeVehicle.fuelCapacityGallons) * 100;
  }

  get fuelColor(): string {
    const p = this.fuelLevelPercent;
    if (p > 50) return '#4caf50'; // Green
    if (p > 25) return '#ff9800'; // Amber
    return '#f44336';             // Red
  }

  get fuelDashOffset(): number {
    return 125.6 * (1 - this.fuelLevelPercent / 100);
  }

  ngOnInit(): void {
    this.startWatchingPosition();
    this.loadPreferences();

    this.mapService.mapClick.subscribe(event => {
      this.onMapClick(event);
    });

    // Handle "Add Stop" from popups
    window.addEventListener('map:setWay', (e: any) => {
      if (e.detail && e.detail.lng && e.detail.lat) {
        // For now, since we only support A->B, we set the stop as the new destination
        // but we keep the original destination in mind if needed.
        // Or simply recalculate route to this new point.
        this.onMapClick(e.detail, true);
      }
    });
  }

  ngOnDestroy(): void {
    this.stopWatchingPosition();
  }

  private loadPreferences() {
    this.vehicleService.loadInitialVehicle().pipe(take(1)).subscribe(vs => {
      if (vs && vs.length > 0) {
        this.availableVehicles = vs;
        const mainV = vs.find(v => v.isMain);
        if (mainV && !this.activeVehicle) {
          this.activeVehicle = mainV;
        }

        if (this.activeVehicle) {
          this.prefService.getByVehicle(this.activeVehicle.id).pipe(take(1)).subscribe(pref => {
            this.userPreferences = pref;
          });
        }
      }
    });
  }

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

  private triggerActiveNotification(title: string, message: string, type: 'anomaly_alert' | 'smart_stop') {
    const notif: AppNotification = {
      id: Math.random().toString(36).substring(7),
      type,
      timestamp: new Date().toISOString(),
      title,
      message,
      isRead: false
    };

    // Update global list
    this.notificationsService.notifications.update(list => [notif, ...list]);

    // Show on screen
    this.activeNotification = notif;
    this.showActiveNotification = true;

    if (this.notificationTimeout) clearTimeout(this.notificationTimeout);
    this.notificationTimeout = setTimeout(() => {
      this.showActiveNotification = false;
      this.cdr.markForCheck();
    }, 6000);

    this.cdr.markForCheck();
  }

  private processNavigationUpdate(currentPos: UserPosition): void {
    if (!this.activeVehicle || !this.destination) return;

    this.currentSpeed = Math.round((currentPos.speed || 0) * 3.6);

    // 1. Calculate delta distance & Fuel consumption ONLY if moving >= 1 km/h
    if (this.lastPosition) {
      const deltaKm = this.calculateDistance(this.lastPosition, currentPos);
      const speedKmh = this.currentSpeed;
      const isMoving = speedKmh >= 1; // 1 km/h threshold

      if (isMoving && deltaKm > 0.002) { // Threshold for significant move ~2m
        this.totalKmTraveled += deltaKm;
        const gallonsConsumed = deltaKm / (this.activeVehicle.avgKmPerGallon || 30);
        this.activeVehicle.currentFuelGallons = Math.max(0, this.activeVehicle.currentFuelGallons! - gallonsConsumed);

        if (this.totalKmTraveled - this.lastKmUpdate >= 1) {
          this.lastKmUpdate = this.totalKmTraveled;
          this.vehicleService.updateVehicle(this.activeVehicle.id, {
            currentFuelGallons: this.activeVehicle.currentFuelGallons
          }).subscribe();
        }
      }

      // Approach Alerts for cached smart stops
      this.cachedSmartStops.forEach(stop => {
        if (!stop.alerted) {
          const distToStop = this.calculateDistance(currentPos, { lat: stop.lat, lng: stop.lng }) * 1000;
          if (distToStop <= 150) {
            stop.alerted = true;
            this.triggerActiveNotification(
              'Parada Próxima',
              `Estás llegando a: ${stop.name || stop.brand}. Prepárate para tanquear.`,
              'smart_stop'
            );
          }
        }
      });

      // Low fuel alert (< 15%)
      if (this.fuelLevelPercent < 15 && !this.hasShownLowFuelAlert) {
        this.hasShownLowFuelAlert = true;
        this.triggerActiveNotification(
          'Combustible Crítico',
          `Nivel de combustible al ${this.fuelLevelPercent.toFixed(0)}%. Busca una estación próxima.`,
          'anomaly_alert'
        );
      }
    }

    // 2. Maneuver Logic
    if (this.currentRouteSteps.length > 0 && this.nextStepIndex < this.currentRouteSteps.length) {
      const step = this.currentRouteSteps[this.nextStepIndex];
      const stepCoord = { lng: step.maneuver.location[0], lat: step.maneuver.location[1] };
      const distToStep = this.calculateDistance(currentPos, stepCoord) * 1000;

      const icon = this.getManeuverIcon(step.maneuver.type, step.maneuver.modifier);
      const distText = distToStep > 1000
        ? `${(distToStep / 1000).toFixed(1)} km`
        : `${Math.round(distToStep)} m`;

      this.updateManeuver({
        icon,
        distance: distText,
        street: step.name || step.maneuver.instruction
      });

      if (distToStep < 30) {
        this.nextStepIndex++;
      }
    }

    // 3. Path Slicing & Off-route detection (Tightened to 40m)
    const now = Date.now();
    let minLineDist = Infinity;
    let closestIdx = -1;

    if (this.detailedRouteCoords.length > 1) {
      const searchRange = Math.min(20, this.detailedRouteCoords.length - 1);
      for (let i = 0; i < searchRange; i++) {
        const d = this.distanceToSegment(currentPos, this.detailedRouteCoords[i] as any, this.detailedRouteCoords[i + 1] as any);
        if (d < minLineDist) {
          minLineDist = d;
          closestIdx = i;
        }
      }

      if (closestIdx > 0 && minLineDist < 0.04) { // User is on the route
        this.detailedRouteCoords = this.detailedRouteCoords.slice(closestIdx);
        this.mapService.updateRouteData(this.detailedRouteCoords);
      }
    }

    // Recalculate if off-route (> 40m)
    if (now - this.lastRecalculationTime > 10000 && minLineDist > 0.04) {
      this.lastRecalculationTime = now;
      this.calculateRoute(currentPos, this.destination).then(() => {
        this.executeTripLogic();
      });
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
    return Math.sqrt(dx * dx + dy * dy) * 111.32;
  }

  async searchDestination(): Promise<void> {
    if (!this.searchQuery.trim() || this.isNavigating) return;
    this.isSearching = true;
    this.cdr.markForCheck();
    try {
      let url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(this.searchQuery)}&format=json&limit=10&addressdetails=1`;

      // Bias results towards user location if available
      if (this.userPosition) {
        url += `&lat=${this.userPosition.lat}&lon=${this.userPosition.lng}`;
      }

      const resp = await fetch(url);
      let results = await resp.json();

      // Sort results by distance if user location is known
      if (this.userPosition && results.length > 0) {
        results = results.sort((a: any, b: any) => {
          const distA = this.calculateDistance(this.userPosition!, { lat: parseFloat(a.lat), lng: parseFloat(a.lon) });
          const distB = this.calculateDistance(this.userPosition!, { lat: parseFloat(b.lat), lng: parseFloat(b.lon) });
          return distA - distB;
        });
      }

      this.searchResults = results.slice(0, 5); // Keep top 5 nearest
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

  onMapReady(): void {
    if (this.userPosition) {
      this.mapService.setUserLocation(this.userPosition.lng, this.userPosition.lat, this.userPosition.heading);
      this.mapService.flyTo(this.userPosition.lng, this.userPosition.lat, 15);
    }
  }

  async onMapClick(event: { lng: number; lat: number }, fromSearch = false): Promise<void> {
    if (this.showRouteList) {
      this.showRouteList = false;
      this.cdr.markForCheck();
      return;
    }
    if (!this.userPosition || this.isNavigating || (!fromSearch && this.possibleRoutes.length > 0)) return;

    this.searchResults = [];
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
      this.mapService.clearRouteAndMarkers();
      const osrmUrl = `${environment.osrmUrl}/${start.lng},${start.lat};${end.lng},${end.lat}?overview=full&geometries=geojson&alternatives=3&steps=true`;
      const response = await fetch(osrmUrl);
      const data = await response.json();

      if (data.code === 'Ok' && data.routes.length > 0) {
        this.possibleRoutes = data.routes.map((r: any, i: number) => {
          let stops = 0;
          if (this.activeVehicle && this.userPreferences) {
            const km = r.distance / 1000;
            const autonomy = (this.activeVehicle.currentFuelGallons! * this.activeVehicle.avgKmPerGallon!) || 300;
            const safeAuto = autonomy - (this.userPreferences.notifyGasStationKmBefore ?? 20);
            // Number of stops = how many times we'll need to refuel along the way
            // If km <= safeAuto, 0 stops. If km = 150, safeAuto = 100, 1 stop.
            stops = km > safeAuto ? Math.floor(km / (safeAuto > 5 ? safeAuto : 50)) : 0;
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
    const mins = Math.ceil(route.duration / 60);
    const arrivalDate = new Date();
    arrivalDate.setMinutes(arrivalDate.getMinutes() + mins);
    this.arrivalTime = arrivalDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    this.routeDistance = `${Math.round(route.distance / 1000)}`;
    this.eta = mins;

    this.mapService.clearRouteAndMarkers();
    this.cachedSmartStops = []; // Reset markers caching for the new route
    this.mapService.setDestinationMarker(this.destination!.lng, this.destination!.lat);

    this.detailedRouteCoords = route.geometry.coordinates;
    this.currentRouteSteps = route.steps;
    this.nextStepIndex = 0;
    this.mapService.drawRoute(this.detailedRouteCoords);

    if (this.currentRouteSteps.length > 0) {
      const step = this.currentRouteSteps[0];
      this.updateManeuver({
        icon: this.getManeuverIcon(step.maneuver.type, step.maneuver.modifier),
        distance: '0 m',
        street: step.name || step.maneuver.instruction
      });
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
    this.cachedSmartStops = []; // Limpiar paradas al limpiar búsqueda
    this.isAutonomyCritical = false;
    this.mapService.clearRouteAndMarkers();
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
    if (!this.activeVehicle) this.showVehicleSelector = true;
    else this.executeTripLogic();
  }

  zoomIn(): void { this.mapService.zoomIn(); }
  zoomOut(): void { this.mapService.zoomOut(); }
  togglePitch(): void {
    this.mapService.togglePitch(this.userPosition?.lng, this.userPosition?.lat, this.userPosition?.heading);
  }

  centerOnUser(): void {
    if (this.userPosition) this.mapService.flyTo(this.userPosition.lng, this.userPosition.lat, 16);
  }

  startTrip(): void {
    if (this.availableVehicles.length > 0 && !this.activeVehicle) this.showVehicleSelector = true;
    else if (this.activeVehicle) this.executeTripLogic();
  }

  confirmVehicle(vehicle: Vehicle): void {
    this.showVehicleSelector = false;
    this.activeVehicle = vehicle;
    this.prefService.getByVehicle(vehicle.id).pipe(take(1)).subscribe(pref => {
      this.userPreferences = pref;
      if (this.destination && this.possibleRoutes.length > 0) {
        this.selectRouteIndex(this.selectedRouteIndex);
        this.possibleRoutes.forEach(r => {
          const km = r.distance / 1000;
          const autonomy = (this.activeVehicle?.currentFuelGallons ?? 0) * (this.activeVehicle?.avgKmPerGallon ?? 0) || 300;
          const safeAuto = autonomy - (this.userPreferences?.notifyGasStationKmBefore ?? 20);
          r.stopsRequired = Math.max(0, Math.floor(km / (safeAuto > 5 ? safeAuto : 50)));
        });
      }
      this.hasShownAutonomyAlert = false; // Reset on vehicle change
      if (this.isNavigating) this.executeTripLogic();
    });
  }

  startWithoutVehicle(): void {
    this.showVehicleSelector = false;
    this.activeVehicle = null;
    this.isAutonomyCritical = false;
    this.mapService.clearStopMarkers();
    if (this.destination) this.mapService.setDestinationMarker(this.destination.lng, this.destination.lat);
    this.executeTripLogic();
  }

  openAddVehicleForm(): void {
    this.showAddVehicleModal = true;
    this.showVehicleSelector = false;
    this.cdr.markForCheck();
  }

  saveNewVehicle(): void {
    if (!this.newVehicleForm.brand || !this.newVehicleForm.licensePlate) {
      alert('La Marca y la Placa son obligatorias.'); return;
    }
    this.vehicleService.createVehicle(this.newVehicleForm).subscribe({
      next: (created) => {
        this.availableVehicles.push(created);
        this.showAddVehicleModal = false;
        this.confirmVehicle(created);
        this.newVehicleForm = { brand: '', model: '', licensePlate: '', year: '2024', safetyBuffer: 0.15 };
      },
      error: (err) => alert('Error al crear el vehículo.')
    });
  }

  private async evaluateTripRules(): Promise<void> {
    if (!this.destination || !this.routeDistance || !this.activeVehicle || !this.userPreferences || this.isEvaluatingRules) {
      this.isAutonomyCritical = false; return;
    }

    const currentAutonomy = (this.activeVehicle.currentFuelGallons! * this.activeVehicle.avgKmPerGallon!) || 0;
    const fullAutonomy = (this.activeVehicle.fuelCapacityGallons! * this.activeVehicle.avgKmPerGallon!) || 300;
    const kmBefore = this.userPreferences.notifyGasStationKmBefore ?? 20;
    const routeKm = parseFloat(this.routeDistance);

    // Autonomía "segura" actual
    const safeCurrentAutonomy = currentAutonomy - kmBefore;

    // Es crítico si la ruta es más larga que lo que tenemos ahora menos el margen
    this.isAutonomyCritical = routeKm > safeCurrentAutonomy;

    // Si ya tenemos paradas calculadas para esta ruta, no repetimos el proceso
    if (this.cachedSmartStops.length > 0) return;

    this.isEvaluatingRules = true;
    this.mapService.clearStopMarkers();

    try {
      if (this.isAutonomyCritical && this.detailedRouteCoords.length > 0) {
        const brandPreference = this.userPreferences.preferences?.[0]?.brandName;

        // Calcular puntos de parada
        // 1. La primera parada debe ser antes de agotar el combustible actual
        // 2. Las siguientes paradas se calculan asumiendo tanque lleno
        let stopsCoords: number[][] = [];

        // Primera parada (distancia actual segura)
        let accumulatedKm = Math.max(5, safeCurrentAutonomy);

        while (accumulatedKm < routeKm) {
          const ratio = accumulatedKm / routeKm;
          const idx = Math.floor(this.detailedRouteCoords.length * Math.min(ratio, 0.98));
          stopsCoords.push(this.detailedRouteCoords[idx]);

          // Siguiente parada será después de un tanque lleno (menos el margen)
          accumulatedKm += (fullAutonomy - kmBefore);

          // Evitar bucles infinitos si la autonomía es muy baja
          if (fullAutonomy <= kmBefore) break;
        }

        if (this.isNavigating && !this.hasShownAutonomyAlert && stopsCoords.length > 0) {
          this.triggerActiveNotification(
            'Autonomía Insuficiente',
            `Tu combustible actual (~${Math.round(currentAutonomy)}km) no alcanza para la ruta (${Math.round(routeKm)}km). Sugiriendo ${stopsCoords.length} paradas.`,
            'smart_stop'
          );
          this.hasShownAutonomyAlert = true;
        }

        for (const coord of stopsCoords) {
          // Búsqueda real de estaciones cerca de este punto de la ruta
          const stations = await this.findGasStationsNear(coord[1], coord[0], brandPreference);

          let stationToMark;
          if (stations && stations.length > 0) {
            stationToMark = stations[0];
          } else {
            // Fallback: Si no hay resultados de la API, usamos el punto de la ruta
            stationToMark = {
              name: brandPreference ? `Estación ${brandPreference}` : 'Estación de Servicio',
              brand: brandPreference || 'Combustible',
              lat: coord[1].toString(),
              lon: coord[0].toString()
            };
          }

          const popupHtml = `
            <div style="font-family: 'Montserrat', sans-serif; text-align:center; min-width:160px; padding:12px; background: white; border-radius: 16px;">
               <div style="background: var(--primary-container); color: var(--on-primary-container); padding: 8px; border-radius: 12px; margin-bottom: 8px;">
                 <strong style="font-size:14px; display:block;">${stationToMark.name}</strong>
               </div>
               <span style="font-size:12px; color:#666; font-weight: 500;">${stationToMark.brand}</span><br>
               <div style="margin-top: 10px; padding-top: 10px; border-top: 1px dashed #ddd;">
                 <button onclick="window.dispatchEvent(new CustomEvent('map:setWay', {detail: {lng: ${stationToMark.lon}, lat: ${stationToMark.lat}}}))"
                         style="padding:10px 16px; background:#006C53; color:white; border:none; border-radius:12px; font-size:12px; font-weight:700; cursor:pointer; width:100%; box-shadow: 0 4px 8px rgba(0,108,83,0.3);">
                    ⛽ Agregar Parada
                 </button>
               </div>
            </div>`;

          this.mapService.setSmartStopMarker(
            parseFloat(stationToMark.lon),
            parseFloat(stationToMark.lat),
            'local_gas_station',
            popupHtml
          );

          this.cachedSmartStops.push({
            name: stationToMark.name,
            brand: stationToMark.brand,
            lat: parseFloat(stationToMark.lat),
            lng: parseFloat(stationToMark.lon),
            alerted: false
          });
        }
      }
    } finally {
      this.isEvaluatingRules = false;
      this.cdr.markForCheck();
    }
  }

  private async findGasStationsNear(lat: number, lng: number, brand?: string): Promise<any[]> {
    try {
      // Usar una búsqueda más amplia si hay marca, o genérica si no
      const query = brand ? `${brand} gas station` : 'gas station';

      // Nominatim con viewbox pequeño alrededor del punto para simular "cerca"
      const delta = 0.05; // ~5km
      const viewbox = `${lng - delta},${lat + delta},${lng + delta},${lat - delta}`;

      const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1&viewbox=${viewbox}&bounded=1`;

      const resp = await fetch(url, {
        headers: { 'Accept-Language': 'es' }
      });
      return await resp.json();
    } catch (e) {
      console.error('Error buscando estaciones:', e);
      return [];
    }
  }

  private monitorSpeed(): void {
    if (!this.userPreferences?.maxSpeedLimit || !this.isNavigating) return;
    if (this.currentSpeed >= this.userPreferences.maxSpeedLimit) {
      if (!this.showSpeedAlert) {
        this.showSpeedAlert = true;
        setTimeout(() => { this.showSpeedAlert = false; this.cdr.markForCheck(); }, 3000);
      }
    } else this.showSpeedAlert = false;
  }

  getSpeedStatusClass(): string {
    if (!this.userPreferences?.maxSpeedLimit) return '';
    const ratio = this.currentSpeed / this.userPreferences.maxSpeedLimit;
    if (ratio >= 1) return 'speed-critical';
    if (ratio >= 0.85) return 'speed-warning';
    return 'speed-normal';
  }

  private executeTripLogic(): void {
    this.isNavigating = true;
    this.hasShownAutonomyAlert = false; // Initial trip check
    this.updateManeuver({ icon: 'navigation', distance: 'En ruta', street: this.destinationName });
    this.saveTripState();
    this.showRouteList = false;
    this.centerOnUser();
    if (this.arrivalBarTimeout) clearTimeout(this.arrivalBarTimeout);
    this.isArrivalBarCondensed = false;
    this.arrivalBarTimeout = setTimeout(() => { this.isArrivalBarCondensed = true; this.cdr.markForCheck(); }, 8000);
    this.cdr.markForCheck();
  }

  showFullArrivalBar(): void {
    this.isArrivalBarCondensed = false;
    this.cdr.markForCheck();
    if (this.arrivalBarTimeout) clearTimeout(this.arrivalBarTimeout);
    this.arrivalBarTimeout = setTimeout(() => { this.isArrivalBarCondensed = true; this.cdr.markForCheck(); }, 8000);
  }

  endTrip(): void {
    this.isNavigating = false;
    this.isArrivalBarCondensed = false;
    if (this.arrivalBarTimeout) clearTimeout(this.arrivalBarTimeout);
    if (this.activeVehicle) this.vehicleService.saveActiveTrip(this.activeVehicle.id, null).subscribe();
    localStorage.removeItem('smartFuel_activeTrip');
    this.destination = null; this.searchQuery = '';
    this.destinationName = 'Destino seleccionado';
    this.hasShownAutonomyAlert = false;
    this.hasShownLowFuelAlert = false;
    this.cachedSmartStops = [];
    this.mapService.clearRouteAndMarkers();
    this.cdr.markForCheck();
  }
}
