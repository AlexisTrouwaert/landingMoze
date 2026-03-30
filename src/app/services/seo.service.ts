import { Injectable, inject, effect } from '@angular/core';
import { Meta } from '@angular/platform-browser';
import { Router, NavigationEnd, ActivatedRoute } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { filter, map } from 'rxjs/operators';

@Injectable({
  providedIn: 'root'
})
export class SeoService {
  private readonly meta = inject(Meta);
  private readonly router = inject(Router);
  private readonly activatedRoute = inject(ActivatedRoute);

  private readonly routeDataSignal = toSignal(
    this.router.events.pipe(
      filter(event => event instanceof NavigationEnd),
      map(() => {
        let route = this.activatedRoute.snapshot;

        while (route.firstChild) {
          route = route.firstChild;
        }

        return route.data;
      })
    ),
    { initialValue: {} }
  );

  constructor() {
    effect(() => {
      const data = this.routeDataSignal() as { noindex?: boolean };

      if (data?.noindex) {
        this.meta.updateTag({ name: 'robots', content: 'noindex, nofollow' });
      } else {
        this.meta.removeTag('name="robots"');
      }
    });
  }
}
