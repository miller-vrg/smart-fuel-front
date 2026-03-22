import {
  Component,
  ElementRef,
  ViewChild,
  AfterViewInit,
  OnDestroy,
  ChangeDetectionStrategy,
  Input,
  Output,
  EventEmitter,
  inject,
} from '@angular/core';
import maplibregl, { Map, Marker, LngLatLike } from 'maplibre-gl';
import { MapService } from '../../../core/services/map.service';

@Component({
  selector: 'app-map',
  standalone: true,
  template: `<div class="map-container" #mapContainer></div>`,
  styles: [`
    .map-container {
      width: 100%;
      height: 100%;
      position: absolute;
      inset: 0;
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MapComponent implements AfterViewInit, OnDestroy {
  @ViewChild('mapContainer', { static: true }) mapContainer!: ElementRef;
  @Input() center: [number, number] = [-74.006, 40.7128];
  @Input() zoom = 14;

  private mapService = inject(MapService);

  /** Emitted once the map is fully loaded */
  @Output() mapReady = new EventEmitter<Map>();

  /** Emitted when the user clicks on the map */
  @Output() mapClick = new EventEmitter<{ lng: number; lat: number }>();

  private map: Map | null = null;
  private userMarker: Marker | null = null;
  private destMarker: Marker | null = null;
  private smartStopMarkers: Marker[] = [];

  ngAfterViewInit(): void {
    this.map = new maplibregl.Map({
      container: this.mapContainer.nativeElement,
      style: {
        version: 8,
        sources: {
          'carto-voyager': {
            type: 'raster',
            tiles: [
              'https://a.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
              'https://b.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
              'https://c.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
              'https://d.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png'
            ],
            tileSize: 256,
            attribution: '&copy; OpenStreetMap &copy; CARTO'
          }
        },
        layers: [
          {
            id: 'carto-layer',
            type: 'raster',
            source: 'carto-voyager',
            minzoom: 0,
            maxzoom: 20
          }
        ]
      },
      center: this.center,
      zoom: this.zoom,
      attributionControl: false,
    });

    this.map.on('load', () => {
      this.mapReady.emit(this.map!);
    });

    this.map.on('click', (e) => {
      this.mapClick.emit({ lng: e.lngLat.lng, lat: e.lngLat.lat });
    });

    this.mapService.register(this);
  }

  ngOnDestroy(): void {
    this.mapService.unregister();
    if (this.userMarker) this.userMarker.remove();
    if (this.destMarker) this.destMarker.remove();
    this.smartStopMarkers.forEach(m => m.remove());
    if (this.map) this.map.remove();
  }

  // ─── Public API ──────────────────────────────

  getMapInstance(): Map | null {
    return this.map;
  }

  zoomIn(): void {
    this.map?.zoomIn({ duration: 300 });
  }

  zoomOut(): void {
    this.map?.zoomOut({ duration: 300 });
  }

  is3DMode = false;

  togglePitch(lng?: number, lat?: number, heading?: number): void {
    if (!this.map) return;
    this.is3DMode = !this.is3DMode;

    if (!this.is3DMode) {
      // Back to top-down
      this.map.easeTo({ pitch: 0, bearing: 0, padding: { top: 0, bottom: 0, left: 0, right: 0 }, duration: 600 });
    } else {
      // Enter 3D navigation view — camera behind user looking forward
      const opts: any = {
        pitch: 60,
        zoom: 17,
        duration: 600,
        padding: { top: 0, bottom: 250, left: 0, right: 0 },  // push user to lower screen
      };
      if (lng !== undefined && lat !== undefined) {
        opts.center = [lng, lat];
      }
      if (heading !== undefined && !isNaN(heading)) {
        opts.bearing = heading;
      }
      this.map.easeTo(opts);
    }
  }

  /** Call this on every position update during navigation to keep 3D camera behind user */
  followUser3D(lng: number, lat: number, heading?: number): void {
    if (!this.map || !this.is3DMode) return;
    const opts: any = {
      center: [lng, lat],
      duration: 1000,
      padding: { top: 0, bottom: 250, left: 0, right: 0 },
    };
    if (heading !== undefined && !isNaN(heading)) {
      opts.bearing = heading;
    }
    this.map.easeTo(opts);
  }

  flyTo(lng: number, lat: number, zoom?: number): void {
    this.map?.flyTo({
      center: [lng, lat] as LngLatLike,
      zoom: zoom ?? this.map.getZoom(),
      duration: 1000,
    });
  }

  /**
   * Adds or updates a pulsing user-location marker on the map.
   */
  setUserLocation(lng: number, lat: number, heading?: number): void {
    if (!this.map) return;

    if (this.userMarker) {
      this.userMarker.setLngLat([lng, lat]);
      // Optional: rotate the inner dot if heading is provided
      if (heading !== undefined && heading !== null && !isNaN(heading)) {
         const el = this.userMarker.getElement();
         const dot = el.querySelector('.user-marker-dot') as HTMLElement;
         if (dot) dot.style.transform = `rotate(${heading}deg)`;
      }
      return;
    }

    // Create a custom pulsing dot element
    const el = document.createElement('div');
    el.className = 'user-location-marker';
    el.innerHTML = `
      <div class="user-marker-pulse"></div>
      <div class="user-marker-leaper">
        <div class="user-marker-dot"></div>
      </div>
    `;

    this.userMarker = new maplibregl.Marker({ element: el })
      .setLngLat([lng, lat])
      .addTo(this.map);
      
    // Ensure it's on top of tiles
    this.userMarker.getElement().style.zIndex = '150';
  }

  /**
   * Adds or updates a standard destination marker
   */
  setDestinationMarker(lng: number, lat: number): void {
    if (!this.map) return;

    if (this.destMarker) {
      this.destMarker.setLngLat([lng, lat]);
      return;
    }

    this.destMarker = new maplibregl.Marker({ color: '#ea4335' })
      .setLngLat([lng, lat])
      .addTo(this.map);
  }

  /**
   * Adiciona marcadores de sugerencia dinámica (gasolina, comida) con un popup clickeable
   */
  setSmartStopMarker(lng: number, lat: number, iconName: string = 'location_on', popupHtml?: string): void {
    if (!this.map) return;
    
    const el = document.createElement('div');
    el.style.zIndex = '100'; // always on top of route line
    el.innerHTML = `<div style="background:var(--primary-container); color:var(--on-primary-container); border-radius:50%; padding:8px; display:flex; box-shadow:0 2px 6px rgba(0,0,0,0.2); cursor:pointer;"><span class="material-symbols-outlined" style="font-size:18px;">${iconName}</span></div>`;
    
    // Evitar que el mapa lance el evento click y cambie la ruta
    el.addEventListener('click', (e) => {
      e.stopPropagation();
    });

    const m = new maplibregl.Marker({ element: el }).setLngLat([lng, lat]);
      
    if (popupHtml) {
      const popup = new maplibregl.Popup({ offset: 25, closeButton: false, closeOnClick: false }).setHTML(popupHtml);
      
      el.addEventListener('mouseenter', () => popup.setLngLat([lng, lat]).addTo(this.map!));
      el.addEventListener('mouseleave', () => popup.remove());
      
      // Keep click toggle just in case on mobile
      el.addEventListener('click', (e) => {
         e.stopPropagation();
         if (popup.isOpen()) popup.remove();
         else popup.setLngLat([lng, lat]).addTo(this.map!);
      });
    }
      
    m.addTo(this.map);
    this.smartStopMarkers.push(m);
  }

  clearRouteAndMarkers(): void {
    if (this.destMarker) {
      this.destMarker.remove();
      this.destMarker = null;
    }
    this.clearStopMarkers();
    
    if (this.map?.getSource('route-source')) {
      (this.map.getSource('route-source') as any).setData({
        type: 'Feature',
        properties: {},
        geometry: { type: 'LineString', coordinates: [] }
      });
    }
  }

  clearStopMarkers(): void {
    this.smartStopMarkers.forEach(m => m.remove());
    this.smartStopMarkers = [];
  }

  /**
   * Draws a route line on the map from GeoJSON coordinates
   */
  drawRoute(coordinates: number[][]): void {
    if (!this.map) return;

    const sourceId = 'route-source';
    const layerId = 'route-layer';

    const geojson: any = {
      type: 'Feature',
      properties: {},
      geometry: {
        type: 'LineString',
        coordinates: coordinates,
      },
    };

    // If source exists, just update data
    if (this.map.getSource(sourceId)) {
      (this.map.getSource(sourceId) as any).setData(geojson);
    } else {
      // Create source and layer
      this.map.addSource(sourceId, {
        type: 'geojson',
        data: geojson,
      });

      this.map.addLayer({
        id: layerId,
        type: 'line',
        source: sourceId,
        layout: {
          'line-join': 'round',
          'line-cap': 'round',
        },
        paint: {
          'line-color': '#4285F4',
          'line-width': 6,
          'line-opacity': 0.8,
        },
      });
    }

    // Fit bounds to show the whole route
    const bounds = new maplibregl.LngLatBounds();
    coordinates.forEach(coord => bounds.extend([coord[0], coord[1]] as LngLatLike));
    this.map.fitBounds(bounds, { padding: 60, duration: 1000 });
  }
}
