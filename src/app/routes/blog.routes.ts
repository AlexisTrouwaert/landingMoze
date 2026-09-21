import { Routes } from '@angular/router';

export const BLOG_ROUTES: Routes = [
  {
    path: '',
    title: 'Blog – Moze',
    loadComponent: () =>
      import('../pages/blog/blog-list.component').then((m) => m.BlogListComponent),
  },
  // Page d'une série : deux segments, elle ne se confond pas avec l'article `:slug`.
  {
    path: 'series/:slug',
    loadComponent: () =>
      import('../pages/blog/blog-series.component').then((m) => m.BlogSeriesComponent),
  },
  {
    path: ':slug',
    loadComponent: () =>
      import('../pages/blog/blog-article.component').then(
        (m) => m.BlogArticleComponent,
      ),
  },
];
