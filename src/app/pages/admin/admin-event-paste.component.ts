import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { concatMap, from, of, toArray } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { capitalize, formatEventSchedule } from '../../common/event-time';
import { PastedEvent, parsePastedEvents } from '../../common/event-paste';
import { AdminEvent, EVENT_ACCESS, ROLES_MOZE, eventTypeLabel } from '../../model/event.model';
import { EventService } from '../../services/event.service';

/**
 * Création d'évènements par collage — le pendant de `AdminBlogPasteComponent`.
 *
 * Même propriété de sécurité : c'est un humain **déjà authentifié** qui pousse le texte depuis
 * son navigateur, aucun identifiant n'existe hors de sa session. L'IA redevient un éditeur de
 * texte qui connaît le format et la charte.
 *
 * Le prompt diffère de celui des articles : il porte la spec des évènements (champs, rôle de
 * Moze, charte) et une consigne que les articles n'ont pas besoin d'énoncer — **ne rien
 * inventer**. Une adresse ou une billetterie plausible mais fausse part en ligne avec l'aplomb
 * d'une vraie.
 */
@Component({
  selector: 'app-admin-event-paste',
  imports: [RouterLink],
  templateUrl: './admin-event-paste.component.html',
  // La feuille de l'écran de collage des articles : même mise en page en deux volets, mêmes
  // cartes. La seconde ne porte que ce qui est propre aux évènements.
  styleUrls: [
    './admin-blog-paste.component.scss',
    './admin-event-paste.component.scss',
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminEventPasteComponent {
  private readonly events = inject(EventService);
  private readonly router = inject(Router);

  readonly texte = signal('');
  readonly creating = signal(false);
  readonly error = signal<string | null>(null);
  readonly aide = signal(false);

  /** Retour du bouton de copie. `ko` quand le presse-papiers refuse. */
  readonly copie = signal<'repos' | 'ok' | 'ko'>('repos');
  private retour?: ReturnType<typeof setTimeout>;

  /** Relecture du texte collé, à chaque frappe : l'analyse est locale et sans coût. */
  readonly lu = computed(() =>
    this.texte().trim() ? parsePastedEvents(this.texte()) : null,
  );

  readonly peutCreer = computed(() => {
    const lu = this.lu();
    return !!lu && lu.errors.length === 0 && lu.events.length > 0;
  });

  typeLabel(event: PastedEvent): string {
    return eventTypeLabel(event.input.type, event.input.typeLabel);
  }

  schedule(event: PastedEvent): string {
    return capitalize(formatEventSchedule(event.input.startAt, event.input.endAt));
  }

  place(event: PastedEvent): string | null {
    const e = event.input;
    if (e.mode === 'en-ligne') return 'En ligne';
    return [e.venueName, e.city].filter(Boolean).join(', ') || null;
  }

  /** « organisateur », « partenaire »… en toutes lettres, pour la ligne « Moze … ». */
  roleLabel(event: PastedEvent): string {
    return (ROLES_MOZE.find((r) => r.value === event.input.roleMoze)?.label ?? '').toLowerCase();
  }

  accessLabel(event: PastedEvent): string | null {
    const e = event.input;
    return e.priceLabel || EVENT_ACCESS.find((a) => a.value === e.access)?.label || null;
  }

  onInput(event: Event): void {
    this.texte.set((event.target as HTMLTextAreaElement).value);
    this.error.set(null);
  }

  /**
   * Copie le prompt affiché. Le texte est lu dans le DOM : il n'existe qu'à un seul endroit, le
   * gabarit, et c'est celui qu'on voit qui part.
   */
  async copier(texte: string): Promise<void> {
    clearTimeout(this.retour);
    try {
      await navigator.clipboard.writeText(texte);
      this.copie.set('ok');
    } catch {
      this.copie.set('ko');
    }
    this.retour = setTimeout(() => this.copie.set('repos'), 2000);
  }

  vider(): void {
    this.texte.set('');
    this.error.set(null);
  }

  /**
   * Crée les brouillons, un par un — séquentiel, pour que les slugs se dédoublonnent sans se
   * marcher dessus. Un échec n'interrompt pas les suivants, et il est nommé.
   *
   * Un seul évènement : on ouvre son éditeur, c'est là qu'on ajoute l'image et qu'on publie.
   * Plusieurs : la liste.
   */
  creer(): void {
    const lu = this.lu();
    if (!lu || !this.peutCreer()) return;

    this.creating.set(true);
    this.error.set(null);
    const echecs: string[] = [];

    from(lu.events)
      .pipe(
        concatMap((event) =>
          this.events.create(event.input).pipe(
            catchError((err: unknown) => {
              echecs.push(`« ${event.input.title} » — ${this.messageOf(err) ?? 'échec'}`);
              return of(null);
            }),
          ),
        ),
        toArray(),
      )
      .subscribe((resultats) => {
        this.creating.set(false);
        const crees = resultats.filter((r): r is AdminEvent => r !== null);

        if (echecs.length) {
          this.error.set(`${crees.length} créé(s), ${echecs.length} en échec :\n${echecs.join('\n')}`);
          return;
        }

        this.texte.set('');
        void this.router.navigate(
          crees.length === 1 ? ['/admin/evenements', crees[0].id, 'edit'] : ['/admin/evenements'],
        );
      });
  }

  private messageOf(err: unknown): string | null {
    const msg = (err as { error?: { message?: string | string[] } } | null)?.error?.message;
    if (Array.isArray(msg)) return msg.join(' · ');
    return typeof msg === 'string' ? msg : null;
  }
}
