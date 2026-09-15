import {
  ChangeDetectionStrategy,
  Component,
  OnDestroy,
  RESPONSE_INIT,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Meta, Title } from '@angular/platform-browser';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { catchError, map, of, switchMap } from 'rxjs';
import { eventJsonLd } from '../../common/event-jsonld';
import { EventViewComponent } from '../../components/event-view/event-view.component';
import { FloatingDockComponent } from '../../components/floating-dock/floating-dock.component';
import { SiteEvent } from '../../model/event.model';
import { EventService } from '../../services/event.service';
import { SeoService, SOCIAL_IMAGE_ALT } from '../../services/seo.service';
import { environment } from '../../../environements/environment';

/** Longueur visée d'une meta description : au-delà, Google la coupe (spec : 155). */
const DESCRIPTION_MAX = 155;

/**
 * Page publique d'un évènement, `/evenements/:slug`.
 *
 * Répond pour tout évènement publié, **quel que soit son état** — reporté, annulé, passé : « une
 * page ne disparaît jamais ». Seul un brouillon ou un slug inconnu donne une 404, avec le vrai
 * statut HTTP pour que le lien mort ne reste pas indexé.
 *
 * Porte le balisage `Event` (JSON-LD), déduit des champs par `eventJsonLd` — ou aucun, quand
 * l'évènement n'y est pas éligible : un balisage refusé vaut moins que pas de balisage (spec,
 * section 05). Rendu côté serveur, il est dans le HTML que lit Google.
 */
@Component({
  selector: 'app-event-page',
  imports: [RouterLink, FloatingDockComponent, EventViewComponent],
  templateUrl: './event-page.component.html',
  styleUrl: './event-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EventPageComponent implements OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly events = inject(EventService);
  private readonly title = inject(Title);
  private readonly meta = inject(Meta);
  private readonly seo = inject(SeoService);

  /** En-tête de la réponse en cours de rendu — côté serveur uniquement, `null` dans le navigateur. */
  private readonly responseInit = inject(RESPONSE_INIT, { optional: true });

  readonly event = signal<SiteEvent | null>(null);
  readonly loading = signal(true);
  readonly notFound = signal(false);

  constructor() {
    this.route.paramMap
      .pipe(
        map((p) => p.get('slug') ?? ''),
        switchMap((requested) => {
          this.loading.set(true);
          this.notFound.set(false);
          return this.events.bySlug(requested).pipe(
            map((event) => ({ requested, event })),
            catchError(() => of({ requested, event: null })),
          );
        }),
        takeUntilDestroyed(),
      )
      .subscribe(({ requested, event }) => {
        // Le back résout aussi les ANCIENS slugs (évènement renommé après sa mise en ligne) en
        // renvoyant l'évènement avec son slug actuel : l'écart signifie que l'adresse consultée
        // n'est plus la bonne — on redirige au lieu d'afficher. Même règle que les articles.
        if (event && event.slug !== requested) {
          this.redirectToCurrentSlug(event.slug);
          return;
        }

        this.loading.set(false);
        this.event.set(event);
        if (event) {
          this.applySeo(event);
        } else {
          this.notFound.set(true);
          this.title.setTitle('Évènement introuvable – Moze');
          this.removeJsonLd();
          if (this.responseInit) this.responseInit.status = 404;
        }
      });
  }

  /**
   * L'adresse canonique est celle du slug actuel.
   *
   * Côté serveur : une vraie 301 (statut + `Location`), qui transfère aux moteurs l'historique de
   * l'ancienne URL. Côté navigateur : navigation interne en remplaçant l'entrée d'historique, pour
   * que « précédent » ne repasse pas par l'ancienne adresse.
   */
  private redirectToCurrentSlug(slug: string): void {
    if (this.responseInit) {
      this.responseInit.status = 301;
      const headers = new Headers(this.responseInit.headers);
      headers.set('Location', `${environment.siteUrl}/evenements/${slug}`);
      this.responseInit.headers = headers;
      return;
    }
    void this.router.navigate(['/evenements', slug], { replaceUrl: true });
  }

  /** Le JSON-LD décrit *cette* page : parti ailleurs, le bloc doit disparaître. */
  ngOnDestroy(): void {
    this.removeJsonLd();
  }

  private removeJsonLd(): void {
    this.seo.removeJsonLd('event');
    this.seo.removeJsonLd('breadcrumb');
  }

  goHome(): void {
    this.router.navigate(['/']);
  }

  goEvents(): void {
    this.router.navigate(['/evenements']);
  }

  /** Titre, description, canonique et aperçu de partage. */
  private applySeo(event: SiteEvent): void {
    const url = `${environment.siteUrl}/evenements/${event.slug}`;
    const description = this.truncate(
      event.summary || event.tagline || this.plainText(event.content),
      DESCRIPTION_MAX,
    );

    this.title.setTitle(`${event.title} – Évènement Moze`);
    this.meta.updateTag({ name: 'description', content: description });
    this.meta.updateTag({ property: 'og:title', content: event.title });
    this.meta.updateTag({ property: 'og:description', content: description });
    this.meta.updateTag({ property: 'og:type', content: 'website' });
    this.meta.updateTag({ property: 'og:site_name', content: 'Moze' });
    this.meta.updateTag({ property: 'og:url', content: url });
    this.meta.updateTag({ name: 'twitter:title', content: event.title });
    this.meta.updateTag({ name: 'twitter:description', content: description });
    this.seo.setCanonical(url);

    const social = event.coverImageUrl ? this.socialImage(event.coverImageUrl) : null;
    if (social) {
      this.seo.setSocialImage(social, event.coverImageAlt || event.title);
    } else {
      this.seo.setSocialImage(SeoService.DEFAULT_SOCIAL_IMAGE, SOCIAL_IMAGE_ALT);
    }

    const jsonLd = eventJsonLd(event, url, social ? [social] : []);
    if (jsonLd) this.seo.setJsonLd('event', jsonLd);
    else this.seo.removeJsonLd('event');

    this.seo.setJsonLd('breadcrumb', {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Accueil', item: `${environment.siteUrl}/` },
        { '@type': 'ListItem', position: 2, name: 'Évènements', item: `${environment.siteUrl}/evenements` },
        // Dernier maillon : la page courante, sans `item` — c'est la convention schema.org.
        { '@type': 'ListItem', position: 3, name: event.title },
      ],
    });
  }

  /**
   * Texte brut d'un HTML. Par expression régulière et non par le DOM : la page est rendue côté
   * serveur, et le contenu a déjà été nettoyé par le back — il ne s'agit que d'en ôter les balises.
   */
  private plainText(html: string): string {
    return html
      .replace(/<\/(p|h2|h3|li)>/g, '. ')
      .replace(/<[^>]*>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/\s+([.,])/g, '$1')
      .replace(/\.(\s*\.)+/g, '.')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /** Coupe au mot, avec une ellipse. */
  private truncate(text: string, max: number): string {
    if (text.length <= max) return text;
    const cut = text.slice(0, max - 1);
    return `${cut.slice(0, cut.lastIndexOf(' ')) || cut}…`;
  }

  /**
   * Dérivée JPEG 1200×630 de l'image, servie par `GET /og/` — même règle que
   * `BlogArticleComponent.socialImage` : LinkedIn refuse le WebP, WhatsApp abandonne au-delà de
   * ~300 Ko. Une adresse qui n'est pas un upload du back ressort inchangée.
   */
  private socialImage(coverImageUrl: string): string {
    const match = coverImageUrl.match(
      /^(https?:\/\/[^/]+)\/uploads\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\.(?:jpe?g|png|webp)$/i,
    );
    return match ? `${match[1]}/og/${match[2]}.jpg` : coverImageUrl;
  }
}
