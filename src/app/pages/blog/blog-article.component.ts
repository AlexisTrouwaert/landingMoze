import { DOCUMENT } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  inject,
  signal,
} from '@angular/core';
import { Meta, Title } from '@angular/platform-browser';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { catchError, of, switchMap } from 'rxjs';
import { ArticleViewComponent } from '../../components/article-view/article-view.component';
import { FloatingDockComponent } from '../../components/floating-dock/floating-dock.component';
import { Article } from '../../model/article.model';
import { BlogService } from '../../services/blog.service';
import { environment } from '../../../environements/environment';

@Component({
    selector: 'app-blog-article',
    imports: [RouterLink, FloatingDockComponent, ArticleViewComponent],
    templateUrl: './blog-article.component.html',
    styleUrl: './blog-article.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class BlogArticleComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly blog = inject(BlogService);
  private readonly title = inject(Title);
  private readonly meta = inject(Meta);
  private readonly document = inject(DOCUMENT);

  readonly article = signal<Article | null>(null);
  readonly loading = signal(true);
  readonly notFound = signal(false);

  constructor() {
    this.route.paramMap
      .pipe(
        switchMap((p) => {
          this.loading.set(true);
          this.notFound.set(false);
          return this.blog.getBySlug(p.get('slug') ?? '').pipe(
            catchError(() => {
              this.notFound.set(true);
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
        }
      });
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

    this.setCanonical(url);
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

  /**
   * `<link rel="canonical">` : `Meta` ne gère que les `<meta>`, on passe donc
   * par le DOM. `DOCUMENT` et non `document` — ce code s'exécute aussi pendant
   * le rendu serveur, où la variable globale n'existe pas.
   */
  private setCanonical(url: string): void {
    const head = this.document.head;
    let link = head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (!link) {
      link = this.document.createElement('link');
      link.setAttribute('rel', 'canonical');
      head.appendChild(link);
    }
    link.setAttribute('href', url);
  }
}
