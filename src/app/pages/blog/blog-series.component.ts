import { isPlatformBrowser } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  OnDestroy,
  PLATFORM_ID,
  RESPONSE_INIT,
  computed,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Meta, Title } from '@angular/platform-browser';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { catchError, map, of, switchMap } from 'rxjs';
import { FloatingDockComponent } from '../../components/floating-dock/floating-dock.component';
import { NewsletterFormComponent } from '../../components/newsletter-form/newsletter-form.component';
import { SeriesCoverComponent } from '../../components/series-cover/series-cover.component';
import { SeriesDoneIconComponent } from '../../components/series-done-icon/series-done-icon.component';
import {
  PublicSeries,
  SeriesEpisode,
  formatEpisodeDate,
  totalReadingMinutes,
} from '../../model/series.model';
import { BlogService } from '../../services/blog.service';
import { SeoService, SOCIAL_IMAGE_ALT } from '../../services/seo.service';
import { SeriesProgressService } from '../../services/series-progress.service';
import { environment } from '../../../environements/environment';

/** Un épisode paru est « nouveau » pendant sept jours — même règle que le rayon du blog. */
const NEW_EPISODE_MS = 7 * 24 * 60 * 60 * 1000;

/** Une ligne de la playlist : un épisode paru, programmé, ou seulement annoncé. */
type Row =
  | { kind: 'out'; key: string; episode: SeriesEpisode; read: boolean; fresh: boolean }
  | { kind: 'upcoming'; key: string; position: number | null; date: string }
  | { kind: 'planned'; key: string; position: number };

/**
 * Page d'une série, `/blog/series/:slug` : sa couverture, de quoi reprendre la lecture, et la
 * liste de ses épisodes dans l'ordre — parus, programmés (une date, pas de titre), puis annoncés.
 *
 * Rendue côté serveur comme le reste du blog : les liens vers les épisodes sont dans le HTML que
 * lisent les moteurs. La progression de lecture, elle, ne vit que dans le navigateur : la page
 * part du serveur sans coche, et « Commencer » devient « Reprendre » une fois chargée.
 */
@Component({
  selector: 'app-blog-series',
  imports: [
    RouterLink,
    FloatingDockComponent,
    NewsletterFormComponent,
    SeriesCoverComponent,
    SeriesDoneIconComponent,
  ],
  templateUrl: './blog-series.component.html',
  styleUrl: './blog-series.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BlogSeriesComponent implements OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly blog = inject(BlogService);
  private readonly progress = inject(SeriesProgressService);
  private readonly title = inject(Title);
  private readonly meta = inject(Meta);
  private readonly seo = inject(SeoService);
  private readonly browser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly responseInit = inject(RESPONSE_INIT, { optional: true });

  readonly series = signal<PublicSeries | null>(null);
  readonly loading = signal(true);
  readonly notFound = signal(false);

  /** Les couvertures des épisodes parus, du plus récent au plus ancien. */
  readonly covers = computed(() =>
    [...(this.series()?.episodes ?? [])]
      .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt))
      .map((e) => e.coverImageUrl),
  );

  readonly facts = computed(() => {
    const episodes = this.series()?.episodes ?? [];
    const count = episodes.length;
    return `${count} épisode${count > 1 ? 's' : ''} · ${totalReadingMinutes(episodes)} min de lecture`;
  });

  /** Ce que le lecteur a déjà lu ici (vide côté serveur). */
  private readonly read = computed(() => {
    const series = this.series();
    return series ? this.progress.readEpisodes(series.slug) : new Set<string>();
  });

  /**
   * L'appel à lire : commencer au premier épisode, reprendre au premier non lu, ou tout relire.
   * `secondary` propose de repartir du début quand on reprend en cours de route.
   */
  readonly cta = computed(() => {
    const episodes = this.series()?.episodes ?? [];
    if (!episodes.length) return null;
    const read = this.read();
    const first = episodes[0];
    const unread = episodes.find((e) => !read.has(e.slug));

    if (!read.size) return { label: 'Commencer la série', target: first, secondary: null };
    if (!unread) return { label: 'Relire depuis le début', target: first, secondary: null };
    return {
      label: unread.position ? `Reprendre à l'épisode ${unread.position}` : 'Reprendre la lecture',
      target: unread,
      secondary: unread === first ? null : first,
    };
  });

  readonly rows = computed<Row[]>(() => {
    const series = this.series();
    if (!series) return [];
    const read = this.read();
    const now = Date.now();

    const rows: Row[] = [
      ...series.episodes.map((episode) => ({
        kind: 'out' as const,
        key: episode.slug,
        episode,
        read: read.has(episode.slug),
        fresh: now - new Date(episode.publishedAt).getTime() < NEW_EPISODE_MS,
      })),
      ...series.upcoming.map((u, i) => ({
        kind: 'upcoming' as const,
        key: `upcoming-${u.position ?? i}`,
        position: u.position,
        date: formatEpisodeDate(u.publishedAt),
      })),
    ];

    // Les épisodes annoncés qui n'ont encore ni texte ni date : les numéros du total pas encore pris.
    if (series.plannedCount) {
      const taken = new Set([...series.episodes, ...series.upcoming].map((e) => e.position));
      let missing = series.plannedCount - rows.length;
      for (let position = 1; position <= series.plannedCount && missing > 0; position++) {
        if (taken.has(position)) continue;
        rows.push({ kind: 'planned', key: `planned-${position}`, position });
        missing--;
      }
    }
    return rows;
  });

  /** Une suite reste à venir : on propose de la recevoir par e-mail. */
  readonly awaitsMore = computed(() => {
    const series = this.series();
    return !!series && !series.complete && (series.upcoming.length > 0 || !!series.plannedCount);
  });

  constructor() {
    this.route.paramMap
      .pipe(
        map((p) => p.get('slug') ?? ''),
        switchMap((slug) => {
          this.loading.set(true);
          this.notFound.set(false);
          return this.blog.getSeries(slug).pipe(catchError(() => of(null)));
        }),
        takeUntilDestroyed(),
      )
      .subscribe((series) => {
        this.loading.set(false);
        this.series.set(series);
        if (series) {
          this.applySeo(series);
        } else {
          this.notFound.set(true);
          this.title.setTitle('Série introuvable – Blog Moze');
          this.removeJsonLd();
          if (this.responseInit) this.responseInit.status = 404;
        }
      });
  }

  ngOnDestroy(): void {
    this.removeJsonLd();
  }

  /** « Préviens-moi » d'un épisode à venir : descend jusqu'au formulaire de la page. */
  scrollToAlert(): void {
    if (!this.browser) return;
    document.getElementById('serie-suite')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  goHome(): void {
    this.router.navigate(['/']);
  }

  goBlog(): void {
    this.router.navigate(['/blog']);
  }

  private removeJsonLd(): void {
    this.seo.removeJsonLd('series');
    this.seo.removeJsonLd('breadcrumb');
  }

  private applySeo(series: PublicSeries): void {
    const url = `${environment.siteUrl}/blog/series/${series.slug}`;
    const count = series.episodes.length;
    const description =
      series.pitch ||
      `${count} épisode${count > 1 ? 's' : ''} à lire dans l'ordre : la série « ${series.title} » sur le blog Moze.`;

    this.title.setTitle(`${series.title} – Série du blog Moze`);
    this.meta.updateTag({ name: 'description', content: description });
    this.meta.updateTag({ property: 'og:title', content: series.title });
    this.meta.updateTag({ property: 'og:description', content: description });
    this.meta.updateTag({ property: 'og:type', content: 'website' });
    this.meta.updateTag({ property: 'og:site_name', content: 'Moze' });
    this.meta.updateTag({ property: 'og:url', content: url });
    this.meta.updateTag({ name: 'twitter:title', content: series.title });
    this.meta.updateTag({ name: 'twitter:description', content: description });
    this.seo.setCanonical(url);
    this.seo.setSocialImage(SeoService.DEFAULT_SOCIAL_IMAGE, SOCIAL_IMAGE_ALT);

    // Une page de collection dont l'objet principal est la liste ordonnée des épisodes parus.
    // Les épisodes programmés n'y figurent pas : ils n'ont pas encore d'adresse qui réponde.
    this.seo.setJsonLd('series', {
      '@context': 'https://schema.org',
      '@type': 'CollectionPage',
      name: series.title,
      description,
      url,
      inLanguage: 'fr-FR',
      mainEntity: {
        '@type': 'ItemList',
        itemListOrder: 'https://schema.org/ItemListOrderAscending',
        numberOfItems: count,
        itemListElement: series.episodes.map((e, i) => ({
          '@type': 'ListItem',
          position: i + 1,
          url: `${environment.siteUrl}/blog/${e.slug}`,
          name: e.title,
        })),
      },
    });

    this.seo.setJsonLd('breadcrumb', {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Accueil', item: `${environment.siteUrl}/` },
        { '@type': 'ListItem', position: 2, name: 'Blog', item: `${environment.siteUrl}/blog` },
        { '@type': 'ListItem', position: 3, name: series.title },
      ],
    });
  }

  formatDate(iso: string): string {
    return formatEpisodeDate(iso);
  }
}
