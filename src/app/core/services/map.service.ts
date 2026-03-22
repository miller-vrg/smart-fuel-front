import { Injectable, signal, EventEmitter } from '@angular/core';
import { MapComponent } from '@shared/components/map/map.component';

@Injectable({
  providedIn: 'root'
})
export class MapService {
  private mapComp = signal<MapComponent | null>(null);
  public mapClick = new EventEmitter<{ lng: number; lat: number }>();

  register(comp: MapComponent) {
    this.mapComp.set(comp);
  }

  unregister() {
    this.mapComp.set(null);
  }

  // Proxy methods
  zoomIn() {
    this.mapComp()?.zoomIn();
  }

  zoomOut() {
    this.mapComp()?.zoomOut();
  }

  togglePitch(lng?: number, lat?: number, heading?: number) {
    this.mapComp()?.togglePitch(lng, lat, heading);
  }

  followUser3D(lng: number, lat: number, heading?: number) {
    this.mapComp()?.followUser3D(lng, lat, heading);
  }

  flyTo(lng: number, lat: number, zoom?: number) {
    this.mapComp()?.flyTo(lng, lat, zoom);
  }

  setUserLocation(lng: number, lat: number, heading?: number) {
    this.mapComp()?.setUserLocation(lng, lat, heading);
  }

  setDestinationMarker(lng: number, lat: number) {
    this.mapComp()?.setDestinationMarker(lng, lat);
  }

  setSmartStopMarker(lng: number, lat: number, iconName: string = 'location_on', popupHtml?: string) {
    this.mapComp()?.setSmartStopMarker(lng, lat, iconName, popupHtml);
  }

  clearRouteAndMarkers() {
    this.mapComp()?.clearRouteAndMarkers();
  }

  drawRoute(coordinates: number[][]) {
    this.mapComp()?.drawRoute(coordinates);
  }
}
