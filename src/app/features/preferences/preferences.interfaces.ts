export interface ToggleSetting {
  id: string;
  icon: string;
  label: string;
  sublabel: string;
  iconContainerClass: string;
  enabled: boolean;
}

export interface FuelPriority {
  brand: string;
  name: string;
  description: string;
  starred: boolean;
  isEditing?: boolean;
}
