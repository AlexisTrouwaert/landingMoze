import {
  ChangeDetectionStrategy,
  Component,
  RESPONSE_INIT,
  inject,
  signal,
} from '@angular/core';
import { Meta, Title } from '@angular/platform-browser';
import { Router, RouterLink } from '@angular/router';
import { EventCardComponent } from '../../components/event-card/event-card.component';
import { FloatingDockComponent } from '../../components/floating-dock/floating-dock.component';
import { NAV_GROUPS } from '../../config/nav-groups';
import { EventCard } from '../../model/event.model';
import { ContactPanelService } from '../../services/contact-panel.service';
import { EventService } from '../../services/event.service';
import { MetaPixelService } from '../../services/meta-pixel.service';
import { SeoService, SOCIAL_IMAGE_ALT } from '../../services/seo.service';

const DESCRIPTION =
  'Afterworks, ateliers et rencontres organisés par Moze pour les indépendants : le prochain rendez-vous, et ceux qui ont déjà eu lieu.';

/**
 * Page publique `/evenements` : le prochain évènement en grand, puis les archives.
 *
 * Les archives ne sont pas un reliquat : c'est le seul contenu du site qui montre Moze présent
 * sur le terrain (spec, section 01). Elles restent donc visibles même sans évènement à venir.
 *
 * Rendue côté serveur, comme le blog : cartes et liens doivent être dans le HTML que lisent les
 * robots — ce sont eux qui mènent aux pages de chaque évènement.
 */
@Component({
  selector: 'app-events-page',
  imports: [RouterLink, FloatingDockComponent, EventCardComponent],
  templateUrl: './events-page.component.html',
  styleUrl: './events-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EventsPageComponent {
  private readonly eventService = inject(EventService);
  private readonly router = inject(Router);
  private readonly title = inject(Title);
  private readonly meta = inject(Meta);
  private readonly seo = inject(SeoService);
  private readonly metaPixel = inject(MetaPixelService);
  private readonly contactPanel = inject(ContactPanelService);

  /** En-tête de la réponse en cours de rendu — côté serveur uniquement, `null` dans le navigateur. */
  private readonly responseInit = inject(RESPONSE_INIT, { optional: true });

  readonly navGroups = NAV_GROUPS;

  readonly upcoming = signal<EventCard[]>([]);
  readonly past = signal<EventCard[]>([]);
  readonly loading = signal(true);
  readonly failed = signal(false);

  constructor() {
    this.title.setTitle('Évènements – Moze');
    this.meta.updateTag({ name: 'description', content: DESCRIPTION });
    this.meta.updateTag({ property: 'og:title', content: 'Évènements Moze' });
    this.meta.updateTag({ property: 'og:description', content: DESCRIPTION });
    this.meta.updateTag({ property: 'og:type', content: 'website' });
    this.meta.updateTag({ name: 'twitter:title', content: 'Évènements Moze' });
    this.meta.updateTag({ name: 'twitter:description', content: DESCRIPTION });
    this.seo.setSocialImage(SeoService.DEFAULT_SOCIAL_IMAGE, SOCIAL_IMAGE_ALT);

    this.eventService.hub().subscribe({
      next: ({ upcoming, past }) => {
        this.upcoming.set(upcoming);
        this.past.set(past);
        this.loading.set(false);
        if (!upcoming.length && !past.length) this.noindex();
      },
      error: () => {
        this.failed.set(true);
        this.loading.set(false);
        this.noindex();
      },
    });
  }

  goToFunnel(): void {
    this.metaPixel.trackLeadCTA('inscription_generic');
    this.router.navigate(['/commencer']);
  }

  /** Action d'un lien du dock (ex. « Support » → panneau de contact). */
  onDockAction(action: string): void {
    if (action === 'support') this.contactPanel.open();
  }

  /**
   * Aucun évènement du tout : la page n'est qu'un « revenez bientôt », on ne la fait pas indexer.
   *
   * Par l'en-tête `X-Robots-Tag` et non par une balise : `SeoService` retire la balise `robots`
   * à chaque fin de navigation, c'est-à-dire *après* ce code — vérifié, elle n'arrivait jamais
   * dans le HTML servi. L'en-tête, lui, part avec la réponse. Sans effet dans le navigateur
   * (`RESPONSE_INIT` y est `null`), où il n'y a de toute façon aucun robot à prévenir.
   */
  private noindex(): void {
    if (!this.responseInit) return;
    const headers = new Headers(this.responseInit.headers);
    headers.set('X-Robots-Tag', 'noindex, follow');
    this.responseInit.headers = headers;
  }
}
