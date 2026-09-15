import { AbstractControl, ValidationErrors } from '@angular/forms';

/**
 * L'adresse est-elle un lien Google Maps ?
 *
 * Le bouton de la page publique dit « Voir sur Google Maps » : un autre lien ferait mentir ce
 * libellé, et l'aperçu de carte prévu plus tard ne saura lire qu'une adresse Google.
 *
 * Copie de `isGoogleMapsUrl` du back (`src/events/google-maps.ts`), qui fait foi : ce double ne
 * sert qu'à signaler l'erreur à la saisie plutôt qu'à l'enregistrement. Les deux doivent rester
 * alignés.
 */
export function isGoogleMapsUrl(value: string): boolean {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return false;
  }
  if (url.protocol !== 'https:') return false;

  const host = url.hostname.toLowerCase();
  const path = url.pathname;

  if (host === 'maps.app.goo.gl') return true;
  if (host === 'goo.gl') return path.startsWith('/maps');
  if (/^maps\.google\.[a-z]{2,3}(\.[a-z]{2})?$/.test(host)) return true;
  if (/^(www\.)?google\.[a-z]{2,3}(\.[a-z]{2})?$/.test(host)) {
    return path === '/maps' || path.startsWith('/maps/');
  }
  return false;
}

/** Validateur de formulaire : champ vide accepté (le lien est facultatif). */
export function googleMapsUrlValidator(
  control: AbstractControl<string>,
): ValidationErrors | null {
  const value = (control.value ?? '').trim();
  return !value || isGoogleMapsUrl(value) ? null : { googleMapsUrl: true };
}
