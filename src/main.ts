import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { AppComponent } from './app/app.component';

/*
 * Capture du flag "serveur de test" AVANT le bootstrap du router : Angular normalise
 * l'URL au premier rendu et supprime un param à clé vide (?=test) via replaceState.
 * On lit donc window.location.search ici (URL d'origine intacte) et on persiste le
 * flag pour le funnel. Re-évalué à chaque chargement complet de la page.
 */
try {
  const p = new URLSearchParams(window.location.search);
  const isTest = p.has('test') || p.get('') === 'test'
    || p.get('env') === 'test' || p.get('server') === 'test';
  if (isTest) sessionStorage.setItem('funnel-test-server', '1');
  else sessionStorage.removeItem('funnel-test-server');
} catch { /* environnement sans window/sessionStorage — on ignore */ }

bootstrapApplication(AppComponent, appConfig)
  .catch((err) => console.error(err));
