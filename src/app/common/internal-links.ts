import { environment } from '../../environements/environment';

/**
 * Reconnaissance des liens qui pointent vers le site lui-même.
 *
 * Centralisé ici parce que deux endroits en dépendent et doivent rester d'accord : le découpage
 * de l'article (quels liens méritent une carte) et le service d'aperçu (où chercher la donnée).
 */

/**
 * Hôte réduit à sa forme comparable : minuscules, sans `www.`.
 *
 * `moze.fr` et `www.moze.fr` servent le même site. Comparer les hôtes bruts faisait passer pour
 * externe tout lien interne écrit sans `www` — le serveur demandait alors un aperçu de nos
 * propres pages, une requête par lien.
 */
export function bareHost(host: string): string {
  return host.toLowerCase().replace(/^www\./, '');
}

/** Hôte du site. `environment` est figé, un calcul suffit. */
export const SITE_HOST = (() => {
  try {
    return bareHost(new URL(environment.siteUrl).host);
  } catch {
    return '';
  }
})();

/** Vrai si l'adresse désigne le site lui-même, quelle que soit la forme de l'hôte. */
export function isInternalUrl(url: string): boolean {
  try {
    return bareHost(new URL(url).host) === SITE_HOST;
  } catch {
    // URL que le navigateur lui-même refuse d'analyser : rien de bon à en tirer.
    return true;
  }
}

/**
 * Le slug de l'article de blog désigné par cette adresse, ou `null`.
 *
 * Seule la forme `/blog/<slug>` compte : ni la liste `/blog`, ni une page plus profonde. Un lien
 * vers l'accueil ou les mentions légales n'a rien d'un article, et n'a donc pas de carte à
 * montrer — le lecteur est déjà sur le site.
 */
export function internalBlogSlug(url: string): string | null {
  if (!isInternalUrl(url)) return null;

  try {
    const segments = new URL(url).pathname.split('/').filter(Boolean);
    return segments.length === 2 && segments[0] === 'blog' ? segments[1] : null;
  } catch {
    return null;
  }
}
