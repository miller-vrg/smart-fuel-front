import { ApplicationConfig } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { 
  SocialAuthService, 
  SOCIAL_AUTH_CONFIG, 
  GoogleLoginProvider, 
  SocialAuthServiceConfig 
} from '@abacritt/angularx-social-login';
import { environment } from '@env/environment';

import { routes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(routes), 
    provideHttpClient(),
    {
      provide: SOCIAL_AUTH_CONFIG,
      useValue: {
        autoLogin: false,
        providers: [
          {
            id: GoogleLoginProvider.PROVIDER_ID,
            provider: new GoogleLoginProvider(environment.googleClientId)
          }
        ],
        onError: (err) => console.error(err)
      } as SocialAuthServiceConfig
    },
    SocialAuthService
  ]
};
