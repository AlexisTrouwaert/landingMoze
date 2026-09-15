import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { Router, RouterLink } from '@angular/router';
import { Observable } from 'rxjs';
import { capitalize, formatEventSchedule } from '../../common/event-time';
import { ConfirmDialogComponent } from '../../components/confirm-dialog/confirm-dialog.component';
import {
  AdminEventListItem,
  EVENT_STATUS_LABELS,
  MAX_ACTIVE_EVENTS,
  eventTypeLabel,
} from '../../model/event.model';
import { AuthService } from '../../services/auth.service';
import { EventService } from '../../services/event.service';

/** Ce que la modale de confirmation est en train de demander. */
type PendingAction =
  | { kind: 'unpublish'; event: AdminEventListItem }
  | { kind: 'delete'; event: AdminEventListItem };

/**
 * Liste d'administration des évènements — la version dépouillée du tableau de bord du blog :
 * ni recherche, ni filtres, ni actions groupées.
 *
 * Les gestes qui demandent une saisie — reporter, annuler — ouvrent l'éditeur sur le panneau
 * correspondant, plutôt que de dupliquer leurs formulaires dans une modale.
 */
@Component({
  selector: 'app-admin-event-list',
  imports: [RouterLink, ConfirmDialogComponent],
  templateUrl: './admin-event-list.component.html',
  styleUrl: './admin-event-list.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '(document:keydown.escape)': 'openMenu.set(null)' },
})
export class AdminEventListComponent {
  private readonly events = inject(EventService);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  readonly items = signal<AdminEventListItem[]>([]);
  readonly loading = signal(true);
  readonly loadError = signal(false);
  readonly actionError = signal<string | null>(null);
  /** Identifiant de l'évènement dont une action est en vol. */
  readonly busyId = signal<string | null>(null);
  readonly openMenu = signal<string | null>(null);

  readonly maxActive: number = MAX_ACTIVE_EVENTS;
  readonly statusLabels = EVENT_STATUS_LABELS;
  readonly activeCount = computed(
    () =>
      this.items().filter((e) =>
        ['PUBLISHED', 'FULL', 'POSTPONED'].includes(e.effectiveStatus),
      ).length,
  );

  readonly pending = signal<PendingAction | null>(null);

  readonly confirmTitle = computed(() =>
    this.pending()?.kind === 'delete' ? 'Supprimer le brouillon' : 'Repasser en brouillon ?',
  );

  readonly confirmMessage = computed(() => {
    const p = this.pending();
    if (!p) return '';
    if (p.kind === 'delete') {
      return `Supprimer définitivement « ${p.event.title} » ?\n\nCette action est irréversible.`;
    }
    return `La page de « ${p.event.title} » répondra « introuvable », et il sortira du listing.\n\nRéservé à une publication faite par erreur : un évènement qui n’aura pas lieu s’annule.`;
  });

  constructor() {
    this.reload();
  }

  typeLabel(item: AdminEventListItem): string {
    return eventTypeLabel(item.type, item.typeLabel);
  }

  schedule(item: AdminEventListItem): string {
    return capitalize(formatEventSchedule(item.startAt, item.endAt));
  }

  /** « Complet », « Reporté », « Annulé » en ambre ; « À venir » en vert ; le reste en neutre. */
  badgeTone(item: AdminEventListItem): 'ok' | 'warn' | null {
    switch (item.effectiveStatus) {
      case 'PUBLISHED':
      case 'FULL':
        return 'ok';
      case 'POSTPONED':
      case 'CANCELLED':
        return 'warn';
      default:
        return null;
    }
  }

  canChangeCourse(item: AdminEventListItem): boolean {
    return ['PUBLISHED', 'FULL', 'POSTPONED'].includes(item.effectiveStatus);
  }

  reload(): void {
    this.loading.set(true);
    this.loadError.set(false);
    this.events.adminList().subscribe({
      next: (items) => {
        this.items.set(items);
        this.loading.set(false);
      },
      error: () => {
        this.loadError.set(true);
        this.loading.set(false);
      },
    });
  }

  toggleMenu(id: string): void {
    this.openMenu.set(this.openMenu() === id ? null : id);
  }

  /** Publie directement : le back refuse s'il manque un champ ou si la limite est atteinte, et le dit. */
  publish(event: AdminEventListItem): void {
    this.run(event, this.events.publish(event.id), 'La publication a échoué.');
  }

  markFull(event: AdminEventListItem, full: boolean): void {
    this.run(event, this.events.markFull(event.id, full), 'L’opération a échoué.');
  }

  /** Reporter ou annuler : l'éditeur, panneau ouvert. */
  openLifecycle(event: AdminEventListItem, action: 'postpone' | 'cancel'): void {
    this.openMenu.set(null);
    void this.router.navigate(['/admin/evenements', event.id, 'edit'], {
      queryParams: { action },
    });
  }

  ask(kind: PendingAction['kind'], event: AdminEventListItem): void {
    this.openMenu.set(null);
    this.pending.set({ kind, event });
  }

  onConfirm(): void {
    const p = this.pending();
    this.pending.set(null);
    if (!p) return;
    if (p.kind === 'delete') {
      this.run(p.event, this.events.remove(p.event.id), 'La suppression a échoué.');
    } else {
      this.run(p.event, this.events.unpublish(p.event.id), 'Le retour en brouillon a échoué.');
    }
  }

  logout(): void {
    this.auth.logout();
    void this.router.navigate(['/admin/login']);
  }

  /** Une action sur une ligne, puis rechargement de la liste. Le message du back est affiché. */
  private run(event: AdminEventListItem, request: Observable<unknown>, failure: string): void {
    this.openMenu.set(null);
    this.busyId.set(event.id);
    this.actionError.set(null);
    request.subscribe({
      next: () => {
        this.busyId.set(null);
        this.reload();
      },
      error: (e: HttpErrorResponse) => {
        this.busyId.set(null);
        const message = e?.error?.message as string | string[] | undefined;
        this.actionError.set(Array.isArray(message) ? message.join(' ') : message || failure);
      },
    });
  }
}
