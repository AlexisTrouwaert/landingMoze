import { ApplicationConfig, provideZoneChangeDetection } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';

import { routes } from './app.routes';
import { provideHttpClient, withFetch, withInterceptors } from "@angular/common/http";
import { authInterceptor } from './interceptor/auth.interceptor';
import { provideClientHydration, withEventReplay } from '@angular/platform-browser';

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes),
    // `withFetch()` : le blog est rendu côté serveur, et le backend XHR de
    // `@angular/platform-server` y est déprécié — il réémet l'en-tête `Authorization` sur les
    // redirections cross-origin et se prête aux boucles de redirection. C'est aussi ce que
    // réclame l'avertissement NG02801 au démarrage.
    provideHttpClient(withFetch(), withInterceptors([authInterceptor])),
    provideAnimationsAsync(), provideClientHydration(withEventReplay())
  ]
};
