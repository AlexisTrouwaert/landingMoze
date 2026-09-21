import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  untracked,
} from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { Observable } from 'rxjs';
import { flagLabel } from '../../common/flag-labels';
import { FlagField, Signalement } from '../../model/article.model';
import { SeriesFlagField } from '../../model/series.model';
import { BlogService } from '../../services/blog.service';

/** Signalement en cours de saisie, avant envoi. */
interface Brouillon {
  field: FlagField | SeriesFlagField;
  quote?: string;
  annexSlot?: string;
}

/**
 * Les retouches demandées à l'assistant sur un article : les signaler, les lire, les reprendre.
 *
 * **Pourquoi un composant.** L'éditeur a besoin de la même chose que la relecture — marquer un
 * passage ou un champ, écrire ce qui ne va pas, revenir sur une demande. Recopier le gabarit et
 * sa logique aurait fait deux versions à tenir d'accord, qui auraient divergé à la première
 * évolution.
 *
 * **Article ou série.** `cible` choisit ce qui est signalé. Sur le brouillon d'une série on ne
 * vise que des champs entiers — nom, accroche, idée d'image — et les demandes partent vers les
 * routes des séries ; le reste du composant, saisie, liste et reprise, est le même.
 *
 * **Où se fait la sélection.** L'écran hôte marque ses textes signalables avec
 * `data-flag-zone="content"` (ou `"annex"` + `data-annex-slot`) et passe leur conteneur commun
 * dans `zone`. La cible se déduit de l'endroit surligné, pas du bouton : une sélection doit tenir
 * dans UNE zone de ce conteneur.
 */
@Component({
  selector: 'app-article-flags',
  templateUrl: './article-flags.component.html',
  styleUrl: './article-flags.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ArticleFlagsComponent {
  private readonly blog = inject(BlogService);
  private readonly hote = inject<ElementRef<HTMLElement>>(ElementRef);

  /** Identifiant de ce qui est signalé : l'article, ou la série quand `cible` vaut `serie`. */
  readonly cibleId = input.required<string>();

  readonly cible = input<'article' | 'serie'>('article');

  /** Conteneur des zones signalables (`data-flag-zone`). Absent : pas de signalement de passage. */
  readonly zone = input<HTMLElement | null | undefined>(null);

  /** Champs entiers proposés au signalement, dans l'ordre d'affichage. */
  readonly champs = input<readonly (FlagField | SeriesFlagField)[]>([]);

  /**
   * Raison pour laquelle on ne peut pas signaler maintenant, dite à l'écran. Nulle : on peut.
   * Les signalements existants restent lisibles et modifiables dans tous les cas.
   */
  readonly bloque = input<string | null>(null);

  /**
   * Afficher la barre « Signaler le passage sélectionné » et les champs.
   *
   * Faux quand l'écran hôte pose lui-même ses boutons au plus près de ce qu'ils visent — la
   * relecture met « Signaler le titre » à côté du titre, et un bouton sous chaque post. Il les
   * relie alors à `signalerChamp` et `signalerSelection` par une référence de gabarit.
   */
  readonly actions = input(true);

  /** Émis après chaque changement, avec les signalements encore ouverts. */
  readonly changed = output<Signalement[]>();

  readonly flags = signal<Signalement[]>([]);
  readonly ouverts = computed(() => this.flags().filter((f) => !f.resolvedAt));

  readonly brouillon = signal<Brouillon | null>(null);
  readonly note = signal('');
  readonly occupe = signal(false);
  readonly erreur = signal<string | null>(null);

  readonly editionId = signal<string | null>(null);
  readonly editionNote = signal('');

  constructor() {
    // Rechargé à chaque article : l'éditeur peut passer d'un article à l'autre sans être détruit.
    effect(() => {
      const id = this.cibleId();
      untracked(() => {
        this.brouillon.set(null);
        this.editionId.set(null);
        this.charger(id);
      });
    });
  }

  label(cible: { field: FlagField | SeriesFlagField; annexSlot?: string | null }): string {
    return flagLabel(cible, this.cible());
  }

  /** Relit les signalements — après un « Actualiser » de l'écran hôte, par exemple. */
  recharger(): void {
    this.charger(this.cibleId());
  }

  /**
   * Amène la saisie (ou le message d'erreur) à l'écran.
   *
   * Le bouton cliqué peut être loin du composant — sous un post, à côté du titre : sans ce
   * défilement, on cliquerait « Signaler » sans rien voir se passer. `nearest` ne bouge pas la
   * page si la saisie est déjà visible.
   */
  private reveler(): void {
    if (typeof window === 'undefined') return;
    setTimeout(() =>
      this.hote.nativeElement
        .querySelector<HTMLElement>('.draft, .flags__error')
        ?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }),
    );
  }

  private charger(id: string): void {
    const liste = this.cible() === 'serie' ? this.blog.seriesFlags(id) : this.blog.flags(id);
    liste.subscribe({
      next: (liste) => {
        this.flags.set(liste);
        this.changed.emit(liste.filter((f) => !f.resolvedAt));
      },
      error: () => this.flags.set([]),
    });
  }

  /** Marque un champ entier — titre, adresse, extrait. */
  signalerChamp(field: FlagField | SeriesFlagField): void {
    if (this.bloque()) return;
    this.erreur.set(null);
    this.note.set('');
    this.brouillon.set({ field });
    this.reveler();
  }

  /**
   * Marque le passage sélectionné dans une zone signalable.
   *
   * Le bouton qui l'appelle empêche le `mousedown` de voler le focus : dans un éditeur
   * `contenteditable`, perdre le focus ferait perdre la sélection sur certains navigateurs.
   */
  signalerSelection(): void {
    if (this.bloque()) return;
    const selection = typeof window !== 'undefined' ? window.getSelection() : null;
    const racine = this.zone();

    const zoneDe = (node: Node | null | undefined): HTMLElement | null => {
      const el = node instanceof HTMLElement ? node : (node?.parentElement ?? null);
      const z = el?.closest<HTMLElement>('[data-flag-zone]') ?? null;
      return z && racine?.contains(z) ? z : null;
    };
    const z = zoneDe(selection?.anchorNode);
    if (!z || z !== zoneDe(selection?.focusNode)) {
      this.erreur.set(
        "Sélectionnez d'abord un passage dans le texte de l'article, ou dans un seul post.",
      );
      this.reveler();
      return;
    }

    const quote = selection?.toString().replace(/\s+/g, ' ').trim() ?? '';
    // En deçà, la citation se retrouverait à dix endroits — limite appliquée aussi par le serveur.
    if (quote.length < 8) {
      this.erreur.set('Sélectionnez un passage un peu plus long (8 caractères au moins).');
      this.reveler();
      return;
    }

    const annexSlot = z.dataset['flagZone'] === 'annex' ? z.dataset['annexSlot'] : undefined;
    this.erreur.set(null);
    this.note.set('');
    this.brouillon.set(
      annexSlot ? { field: 'annex', quote, annexSlot } : { field: 'content', quote },
    );
    this.reveler();
  }

  annuler(): void {
    this.brouillon.set(null);
    this.note.set('');
  }

  envoyer(): void {
    const b = this.brouillon();
    if (!b || this.occupe()) return;
    const note = this.note().trim();

    this.occupe.set(true);
    const creation: Observable<unknown> =
      this.cible() === 'serie'
        ? this.blog.createSeriesFlag(this.cibleId(), {
            field: b.field as SeriesFlagField,
            ...(note ? { note } : {}),
          })
        : this.blog.createFlag(this.cibleId(), {
            field: b.field as FlagField,
            ...(b.quote ? { quote: b.quote } : {}),
            ...(b.annexSlot ? { annexSlot: b.annexSlot } : {}),
            ...(note ? { note } : {}),
          });
    creation.subscribe({
      next: () => {
        this.occupe.set(false);
        this.annuler();
        this.charger(this.cibleId());
      },
      error: (err) => this.echec(err, "Le signalement n'a pas pu être enregistré."),
    });
  }

  // --- Reprendre une demande -------------------------------------------------

  modifier(flag: Signalement): void {
    this.brouillon.set(null);
    this.editionNote.set(flag.note ?? '');
    this.editionId.set(flag.id);
  }

  annulerEdition(): void {
    this.editionId.set(null);
    this.editionNote.set('');
  }

  enregistrerEdition(flag: Signalement): void {
    if (this.occupe()) return;
    const note = this.editionNote().trim() || null;
    this.occupe.set(true);
    const maj: Observable<unknown> =
      this.cible() === 'serie'
        ? this.blog.updateSeriesFlag(flag.id, note)
        : this.blog.updateFlag(flag.id, note);
    maj.subscribe({
      next: () => {
        this.occupe.set(false);
        this.annulerEdition();
        this.charger(this.cibleId());
      },
      error: (err) => this.echec(err, "La note n'a pas pu être modifiée."),
    });
  }

  supprimer(flag: Signalement): void {
    if (this.occupe()) return;
    this.occupe.set(true);
    const retrait: Observable<unknown> =
      this.cible() === 'serie'
        ? this.blog.deleteSeriesFlag(flag.id)
        : this.blog.deleteFlag(flag.id);
    retrait.subscribe({
      next: () => {
        this.occupe.set(false);
        this.charger(this.cibleId());
      },
      error: (err) => this.echec(err, "Le signalement n'a pas pu être supprimé."),
    });
  }

  /** Le message du serveur quand il en donne un — « Le passage cité ne figure pas… ». */
  private echec(err: unknown, parDefaut: string): void {
    this.occupe.set(false);
    const message =
      err instanceof HttpErrorResponse ? (err.error as { message?: unknown })?.message : null;
    this.erreur.set(
      typeof message === 'string' ? message : Array.isArray(message) ? message.join(' ') : parDefaut,
    );
  }
}
