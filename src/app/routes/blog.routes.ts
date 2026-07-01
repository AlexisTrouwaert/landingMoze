import { Routes } from '@angular/router';

export const BLOG_ROUTES: Routes = [
  {
    path: '',
    title: 'Blog – Moze',
    loadComponent: () =>
      import('../pages/blog/blog-list.component').then((m) => m.BlogListComponent),
  },
  {
    path: ':slug',
    loadComponent: () =>
      import('../pages/blog/blog-article.component').then(
        (m) => m.BlogArticleComponent,
      ),
  },
];
