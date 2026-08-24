import {
  ChangeDetectionStrategy,
  Component,
  OnDestroy,
  RESPONSE_INIT,
  inject,
  signal,
} from '@angular/core';
import { Meta, Title } from '@angular/platform-browser';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { catchError, map, of, switchMap } from 'rxjs';
import { ArticleCardComponent } from '../../components/article-card/article-card.component';
import { ArticleViewComponent } from '../../components/article-view/article-view.component';
import { FloatingDockComponent } from '../../components/floating-dock/floating-dock.component';
import { Article, ArticleListItem } from '../../model/article.model';
import { BlogService } from '../../services/blog.service';
import { SeoService } from '../../services/seo.service';
import { environment } from '../../../environements/environment';

/**
 * Taille de page demandée pour les suggestions : assez pour retrouver 3 articles une fois
 * l'article courant écarté, sans rapatrier une page entière de liste.
 */
const RELATED_POOL = 4;

/** Nombre de cartes « À lire ensuite » affichées sous l'article. */
const RELATED_SHOWN = 3;

@Component({
    selector: 'app-blog-article',
    imports: [RouterLink, FloatingDockComponent, ArticleViewComponent, ArticleCardComponent],
    templateUrl: './blog-article.component.html',
    styleUrl: './blog-article.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class BlogArticleComponent implements OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly blog = inject(BlogService);
  private readonly title = inject(Title);
  private readonly meta = inject(Meta);
  private readonly seo = inject(SeoService);

  /**
   * En-tête de la réponse en cours de rendu — présent uniquement côté serveur, `null` dans le
   * navigateur. Muter son `status` avant la fin du rendu change le code HTTP servi.
   */
  private readonly responseInit = inject(RESPONSE_INIT, { optional: true });

  readonly article = signal<Article | null>(null);
  readonly loading = signal(true);
  readonly notFound = signal(false);

  /** Suggestions « À lire ensuite » — maillage interne, rendu côté serveur comme le reste. */
  readonly related = signal<ArticleListItem[]>([]);

  constructor() {
    this.route.paramMap
      .pipe(
        switchMap((p) => {
          this.loading.set(true);
          this.notFound.set(false);
          this.related.set([]);
          return this.blog.getBySlug(p.get('slug') ?? '').pipe(
            catchError(() => {
              this.notFound.set(true);
              this.markNotFound();
              this.removeJsonLd();
              return of(null);
            }),
          );
        }),
      )
      .subscribe((a) => {
        this.loading.set(false);
        if (a) {
          this.article.set(a);
          this.applySeo(a);
          this.loadRelated(a);
        }
      });
  }

  /**
   * Le JSON-LD décrit *cette* page : parti ailleurs (autre section, article introuvable), le
   * bloc doit disparaître — les balises `<meta>`, elles, sont réécrites par la page suivante.
   */
  ngOnDestroy(): void {
    this.removeJsonLd();
  }

  private removeJsonLd(): void {
    this.seo.removeJsonLd('article');
    this.seo.removeJsonLd('breadcrumb');
  }

  /**
   * Articles suggérés : ceux qui partagent un tag, complétés par les plus récents si la
   * thématique est trop maigre — un bloc vide ne maille rien.
   *
   * Chargé côté serveur aussi (HttpClient y fonctionne) : ces liens internes sont dans le HTML
   * que crawle Google, c'est tout leur intérêt.
   */
  private loadRelated(a: Article): void {
    const tags = a.tags.map((t) => t.slug);
    const keepOthers = (items: ArticleListItem[]) => items.filter((i) => i.id !== a.id);

    const byTags$ = tags.length
      ? this.blog.list(1, RELATED_POOL, undefined, tags).pipe(
          map((page) => keepOthers(page.items)),
          catchError(() => of<ArticleListItem[]>([])),
        )
      : of<ArticleListItem[]>([]);

    byTags$
      .pipe(
        switchMap((tagged) => {
          if (tagged.length >= RELATED_SHOWN) return of(tagged);
          return this.blog.list(1, RELATED_POOL).pipe(
            map((page) => {
              const seen = new Set(tagged.map((i) => i.id));
              const extra = keepOthers(page.items).filter((i) => !seen.has(i.id));
              return [...tagged, ...extra];
            }),
            catchError(() => of(tagged)),
          );
        }),
      )
      .subscribe((items) => {
        // Une réponse tardive d'un article précédent ne doit pas écraser la page courante.
        if (this.article()?.id === a.id) this.related.set(items.slice(0, RELATED_SHOWN));
      });
  }

  /**
   * Fait répondre 404 au lieu de 200 quand l'article n'existe pas.
   *
   * Sans ça, un slug mort renvoyait une page « Article introuvable » en **200** : pour un moteur,
   * c'est une page valide et indexable — le « soft 404 » que la Search Console signale. Le lien
   * partagé d'un article dépublié restait donc référencé.
   *
   * Sans effet dans le navigateur (`RESPONSE_INIT` y est `null`) : la navigation interne vers un
   * article supprimé continue d'afficher la même page, sans rechargement.
   */
  private markNotFound(): void {
    if (this.responseInit) this.responseInit.status = 404;
  }

  goHome(): void {
    this.router.navigate(['/']);
  }

  goBlog(): void {
    this.router.navigate(['/blog']);
  }

  /**
   * Title + meta description + Open Graph par article (cf. BLOG_DETAILLE §11).
   *
   * Ces balises sont lues par LinkedIn, Facebook, X, WhatsApp, Slack… Aucun de
   * ces robots n'exécute de JavaScript : elles ne comptent que parce que
   * `/blog/:slug` est rendu côté serveur. Toute balise posée depuis un
   * `afterNextRender` serait invisible pour eux.
   */
  private applySeo(a: Article): void {
    const title = a.metaTitle || a.title;
    const description = a.metaDescription || a.excerpt;
    const url = `${environment.siteUrl}/blog/${a.slug}`;

    this.title.setTitle(`${title} – Blog Moze`);
    this.meta.updateTag({ name: 'description', content: description });

    this.meta.updateTag({ property: 'og:title', content: title });
    this.meta.updateTag({ property: 'og:description', content: description });
    this.meta.updateTag({ property: 'og:type', content: 'article' });
    this.meta.updateTag({ property: 'og:site_name', content: 'Moze' });
    // Sans ça, chaque article héritait de l'`og:url` figé dans index.html, qui
    // pointe sur l'accueil : LinkedIn considère cette balise comme l'URL
    // canonique du contenu partagé et repliait donc tous les articles sur un
    // même aperçu, celui de la page d'accueil.
    this.meta.updateTag({ property: 'og:url', content: url });
    if (a.publishedAt) {
      this.meta.updateTag({
        property: 'article:published_time',
        content: a.publishedAt,
      });
    }

    this.meta.updateTag({ name: 'twitter:title', content: title });
    this.meta.updateTag({ name: 'twitter:description', content: description });

    const social = a.coverImageUrl ? this.socialImage(a.coverImageUrl) : null;
    if (social) {
      this.meta.updateTag({ property: 'og:image', content: social });
      this.meta.updateTag({ property: 'og:image:alt', content: title });
      this.meta.updateTag({ property: 'og:image:type', content: 'image/jpeg' });
      // Dimensions connues d'avance, l'endpoint produisant toujours du
      // 1200×630 : LinkedIn choisit la grande carte sur cette seule foi, sans
      // attendre d'avoir téléchargé l'image.
      this.meta.updateTag({ property: 'og:image:width', content: '1200' });
      this.meta.updateTag({ property: 'og:image:height', content: '630' });
      // `summary_large_image` est ce qui déclenche la grande vignette sur X ;
      // LinkedIn lit aussi les balises Twitter en repli des Open Graph.
      this.meta.updateTag({ name: 'twitter:card', content: 'summary_large_image' });
      this.meta.updateTag({ name: 'twitter:image', content: social });
    } else {
      // Un article sans visuel doit repasser en carte compacte, sinon on
      // demande une grande vignette pour une image absente — et, en navigation
      // interne, on hériterait de l'image de l'article précédent.
      this.meta.removeTag('property="og:image"');
      this.meta.removeTag('property="og:image:alt"');
      this.meta.removeTag('property="og:image:type"');
      this.meta.removeTag('property="og:image:width"');
      this.meta.removeTag('property="og:image:height"');
      this.meta.removeTag('name="twitter:image"');
      this.meta.updateTag({ name: 'twitter:card', content: 'summary' });
    }

    // La canonique est déjà posée par `SeoService` à la navigation, avec l'URL demandée. On la
    // repose ici avec le slug de l'article tel que l'API le renvoie : les deux coïncident en
    // temps normal, mais un ancien slug encore résolu par le back doit désigner l'adresse
    // actuelle de l'article, pas celle par laquelle on est arrivé.
    this.seo.setCanonical(url);

    this.applyJsonLd(a, title, description, url, social);
  }

  /**
   * Données structurées de l'article (schema.org) : ce qui rend la page éligible aux résultats
   * enrichis — date, auteur, visuel et fil d'Ariane affichés dans la SERP.
   *
   * Le `publisher` est décrit en entier plutôt que par référence au bloc `Organization` de
   * `index.html` : chaque bloc reste auto-suffisant, un validateur qui les lit séparément n'a
   * rien à résoudre.
   */
  private applyJsonLd(
    a: Article,
    title: string,
    description: string,
    url: string,
    social: string | null,
  ): void {
    const publisher = {
      '@type': 'Organization',
      name: 'Moze',
      logo: {
        '@type': 'ImageObject',
        url: `${environment.siteUrl}/assets/icons/MozeLogo.svg`,
      },
    };

    this.seo.setJsonLd('article', {
      '@context': 'https://schema.org',
      '@type': 'Article',
      headline: title,
      description,
      mainEntityOfPage: url,
      inLanguage: 'fr-FR',
      // `undefined` disparaît à la sérialisation : pas de champ plutôt qu'une valeur inventée.
      image: social ?? undefined,
      datePublished: a.publishedAt ?? undefined,
      dateModified: a.updatedAt || a.publishedAt || undefined,
      author:
        a.author === 'Équipe Moze'
          ? { '@type': 'Organization', name: a.author }
          : { '@type': 'Person', name: a.author },
      publisher,
    });

    this.seo.setJsonLd('breadcrumb', {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Accueil', item: `${environment.siteUrl}/` },
        { '@type': 'ListItem', position: 2, name: 'Blog', item: `${environment.siteUrl}/blog` },
        // Dernier maillon : la page courante, sans `item` — c'est la convention schema.org.
        { '@type': 'ListItem', position: 3, name: title },
      ],
    });
  }

  /**
   * URL de l'aperçu social : la dérivée JPEG 1200×630 servie par `GET /og/`.
   *
   * On ne partage pas la couverture telle quelle car le crawler LinkedIn
   * n'accepte pas le WebP et WhatsApp abandonne au-delà de ~300 Ko. Le site
   * continue d'afficher l'original ; seuls les robots reçoivent la dérivée.
   *
   * L'origine est reprise de la couverture elle-même plutôt que de
   * `environment.blogApiUrl` : l'URL a été figée en base au moment de l'upload,
   * elle peut donc porter un hôte différent de celui configuré aujourd'hui.
   * Toute forme inattendue — une URL externe collée à la main dans l'éditeur —
   * ressort inchangée au lieu d'être réécrite vers un endpoint qui ne saurait
   * pas la servir.
   */
  private socialImage(coverImageUrl: string): string {
    const match = coverImageUrl.match(
      /^(https?:\/\/[^/]+)\/uploads\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\.(?:jpe?g|png|webp)$/i,
    );
    return match ? `${match[1]}/og/${match[2]}.jpg` : coverImageUrl;
  }

}
