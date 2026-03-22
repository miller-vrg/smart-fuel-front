export interface Vehicle {
  id: string;
  licensePlate: string;
  brand: string;
  model: string;
  year: string;
  fuelCapacityGallons: number;
  currentFuelGallons: number;
  avgKmPerGallon: number;
  safetyBuffer: number;
}
