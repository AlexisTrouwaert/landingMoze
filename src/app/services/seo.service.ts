import { DOCUMENT } from '@angular/common';
import { Injectable, inject, effect } from '@angular/core';
import { Meta } from '@angular/platform-browser';
import { Router, NavigationEnd, ActivatedRoute } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { filter, map } from 'rxjs/operators';
import { environment } from '../../environements/environment';

/** Données SEO portées par la route active. */
interface RouteSeo {
  noindex?: boolean;
}

/** Texte alternatif de la vignette de partage par défaut — elle ne montre que la marque. */
export const SOCIAL_IMAGE_ALT = 'Moze — la plateforme des indépendants';

/**
 * Balises SEO qui dépendent de l'adresse courante, posées à chaque navigation.
 *
 * `<link rel="canonical">` et `og:url` ne peuvent pas vivre dans `index.html` : la valeur y est
 * figée sur l'accueil, si bien que chaque page annonçait l'accueil comme sa propre adresse
 * canonique. Pour un moteur, c'est dire « cette page est un doublon de l'accueil » ; pour
 * LinkedIn, c'est afficher l'aperçu de l'accueil au partage de n'importe quelle URL.
 *
 * Le service est instancié par `AppComponent`, donc actif dès le rendu serveur — ces balises sont
 * lues par des robots qui n'exécutent pas de JavaScript, elles doivent figurer dans le HTML servi.
 */
@Injectable({
  providedIn: 'root'
})
export class SeoService {
  private readonly meta = inject(Meta);
  private readonly router = inject(Router);
  private readonly activatedRoute = inject(ActivatedRoute);
  private readonly document = inject(DOCUMENT);

  private readonly navigation = toSignal(
    this.router.events.pipe(
      filter((event): event is NavigationEnd => event instanceof NavigationEnd),
      map((event) => {
        let route = this.activatedRoute.snapshot;

        while (route.firstChild) {
          route = route.firstChild;
        }

        // `urlAfterRedirects` et non `url` : c'est l'adresse où le visiteur se trouve réellement,
        // la seule qui ait un sens comme canonique.
        return { data: route.data as RouteSeo, url: event.urlAfterRedirects };
      })
    ),
    { initialValue: null }
  );

  constructor() {
    effect(() => {
      const navigation = this.navigation();
      if (!navigation) return;

      if (navigation.data?.noindex) {
        this.meta.updateTag({ name: 'robots', content: 'noindex, nofollow' });
      } else {
        this.meta.removeTag('name="robots"');
      }

      const canonical = this.absoluteUrl(navigation.url);
      this.setCanonical(canonical);
      this.meta.updateTag({ property: 'og:url', content: canonical });
    });
  }

  /**
   * Pose (ou met à jour) le `<link rel="canonical">`.
   *
   * Public : la page d'un article la rappelle avec l'adresse tirée de l'article lui-même, une
   * fois celui-ci chargé. `Meta` ne gère que les `<meta>`, d'où le passage par le DOM — et
   * `DOCUMENT` plutôt que la variable globale, ce code tournant aussi côté serveur.
   */
  setCanonical(url: string): void {
    const head = this.document.head;
    let link = head.querySelector<HTMLLinkElement>('link[rel="canonical"]');

    if (!link) {
      link = this.document.createElement('link');
      link.setAttribute('rel', 'canonical');
      head.appendChild(link);
    }

    link.setAttribute('href', url);
  }

  /**
   * Image de partage par défaut, servie depuis les assets du site.
   *
   * JPEG et non WebP : le crawler LinkedIn refuse le second. Générée par
   * `scripts/generate-og-image.mjs` — un visuel dessiné peut la remplacer sans toucher au code,
   * pourvu qu'il fasse 1200x630.
   */
  static readonly DEFAULT_SOCIAL_IMAGE = `${environment.siteUrl}/assets/images/og-moze.jpg`;

  /**
   * Déclare la vignette affichée au partage : Open Graph pour LinkedIn, Facebook, WhatsApp et
   * Slack, `twitter:*` pour X — que LinkedIn lit aussi en repli.
   *
   * Les dimensions sont annoncées bien qu'elles soient déductibles du fichier : LinkedIn choisit
   * la grande carte sur cette seule foi, sans attendre d'avoir téléchargé l'image.
   */
  setSocialImage(imageUrl: string, alt: string): void {
    this.meta.updateTag({ property: 'og:image', content: imageUrl });
    this.meta.updateTag({ property: 'og:image:alt', content: alt });
    this.meta.updateTag({ property: 'og:image:type', content: 'image/jpeg' });
    this.meta.updateTag({ property: 'og:image:width', content: '1200' });
    this.meta.updateTag({ property: 'og:image:height', content: '630' });
    this.meta.updateTag({ name: 'twitter:card', content: 'summary_large_image' });
    this.meta.updateTag({ name: 'twitter:image', content: imageUrl });
  }

  /**
   * Adresse publique absolue d'un chemin de routeur.
   *
   * Les paramètres de requête sont retirés : `?utm_source=…` ou un filtre du blog ne créent pas
   * une nouvelle page, et les laisser dans la canonique reviendrait à déclarer autant de
   * doublons qu'il existe de provenances publicitaires.
   *
   * `environment.siteUrl` et non l'hôte de la requête : le rendu serveur n'a pas de
   * `window.location`, et une canonique doit de toute façon désigner le domaine public, pas celui
   * par lequel le proxy a transmis l'appel.
   */
  private absoluteUrl(routerUrl: string): string {
    const path = routerUrl.split(/[?#]/)[0].replace(/\/+$/, '');
    return `${environment.siteUrl}${path || '/'}`;
  }
}
