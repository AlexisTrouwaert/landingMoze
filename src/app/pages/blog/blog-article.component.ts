import { DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  inject,
  signal,
} from '@angular/core';
import { Meta, Title } from '@angular/platform-browser';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { catchError, of, switchMap } from 'rxjs';
import { FloatingDockComponent } from '../../components/floating-dock/floating-dock.component';
import { Article } from '../../model/article.model';
import { BlogService } from '../../services/blog.service';

@Component({
  selector: 'app-blog-article',
  standalone: true,
  imports: [DatePipe, RouterLink, FloatingDockComponent],
  templateUrl: './blog-article.component.html',
  styleUrl: './blog-article.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BlogArticleComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly blog = inject(BlogService);
  private readonly title = inject(Title);
  private readonly meta = inject(Meta);

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

  /** Title + meta description + Open Graph par article (cf. BLOG_DETAILLE §11). */
  private applySeo(a: Article): void {
    const title = a.metaTitle || a.title;
    const description = a.metaDescription || a.excerpt;
    this.title.setTitle(`${title} – Blog Moze`);
    this.meta.updateTag({ name: 'description', content: description });
    this.meta.updateTag({ property: 'og:title', content: title });
    this.meta.updateTag({ property: 'og:description', content: description });
    this.meta.updateTag({ property: 'og:type', content: 'article' });
    if (a.coverImageUrl) {
      this.meta.updateTag({ property: 'og:image', content: a.coverImageUrl });
    }
  }
}
