import { ApplicationConfig, provideZoneChangeDetection } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';

import { routes } from './app.routes';
import { provideHttpClient, withFetch, withInterceptors } from "@angular/common/http";
import { authInterceptor } from './interceptor/auth.interceptor';
import { provideClientHydration, withIncrementalHydration } from '@angular/platform-browser';

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    /**
     * Pas de `withInMemoryScrolling` ici : mesuré sans effet dans cette configuration SSR (le
     * `RouterScroller` s'installe mais ne défile jamais), et il désactive au passage la
     * restitution native du navigateur au retour arrière. Le retour en haut de page est fait
     * explicitement dans `AppComponent`, où le détail est documenté.
     */
    provideRouter(routes),
    // `withFetch()` : le blog est rendu côté serveur, et le backend XHR de
    // `@angular/platform-server` y est déprécié — il réémet l'en-tête `Authorization` sur les
    // redirections cross-origin et se prête aux boucles de redirection. C'est aussi ce que
    // réclame l'avertissement NG02801 au démarrage.
    provideHttpClient(withFetch(), withInterceptors([authInterceptor])),
    provideAnimationsAsync(),
    /**
     * `withIncrementalHydration()` et non plus `withEventReplay()` seul.
     *
     * Les sections de l'accueil sont en `@defer` : sans cette option, le serveur n'en rendait que
     * le placeholder, et le HTML servi de `/` tombait à 235 mots visibles — dont 150 pour le menu
     * répété deux fois. Ni tarifs, ni fonctionnalités, ni FAQ, ni le JSON-LD `FAQPage` qui en
     * découle. Google finit par voir la page à sa seconde passe, mais les robots qui n'exécutent
     * pas de JavaScript — crawlers IA en tête, que notre `robots.txt` invite pourtant
     * explicitement — repartaient avec cette coquille.
     *
     * Activée, elle autorise les triggers `hydrate` : le contenu part dans le HTML, seule
     * l'hydratation reste différée. Le bénéfice du `@defer` sur le chargement JS est conservé.
     *
     * Inutile de conserver `withEventReplay()` à côté : `withIncrementalHydration()` le fournit
     * lui-même (premier de ses providers).
     */
    provideClientHydration(withIncrementalHydration())
  ]
};
