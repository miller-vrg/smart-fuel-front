import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { ApiService } from '@core/services/api.service';
import { Preference } from '@core/interfaces/preference.interface';

@Injectable({
  providedIn: 'root'
})
export class PreferencesService {
  private api = inject(ApiService);

  getByVehicle(vehicleId: string): Observable<Preference> {
    return this.api.get<Preference>(`/preferences/${vehicleId}`);
  }

  updatePreferences(dto: Preference): Observable<Preference> {
    return this.api.put<Preference>('/preferences', dto);
  }
}
