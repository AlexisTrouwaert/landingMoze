import {
  ChangeDetectionStrategy,
  Component,
  HostListener,
  computed,
  effect,
  input,
  output,
  signal,
} from '@angular/core';

/** Valeurs saisies dans la modale de lien. */
export interface LinkDialogResult {
  /** L'adresse, telle que saisie — la normalisation (schéma, mailto:) appartient à l'appelant. */
  readonly url: string;
  /** Le texte affiché (l'alias). Vide : l'appelant choisit (sélection en cours, ou l'URL). */
  readonly label: string;
}

/**
 * Cible interne proposée par le sélecteur : une page du site ou un article publié.
 * L'URL est absolue, construite sur l'origine canonique — c'est justement pour que
 * la rédaction n'ait ni URL à taper, ni version www à deviner.
 */
export interface InternalLinkTarget {
  readonly group: 'Pages' | 'Articles';
  readonly label: string;
  readonly url: string;
}

/**
 * Modale d'insertion / édition de lien : adresse + texte affiché (alias).
 *
 * Sœur de `PromptDialogComponent` — mêmes styles, même pilotage par le parent via `open` — mais à
 * deux champs : un lien est la seule saisie de l'éditeur qui porte deux valeurs indépendantes, et
 * greffer un second champ optionnel à la modale générique en aurait compliqué tous les usages.
 */
@Component({
  selector: 'app-link-dialog',
  imports: [],
  templateUrl: './link-dialog.component.html',
  styleUrl: '../prompt-dialog/prompt-dialog.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LinkDialogComponent {
  readonly open = input(false);
  readonly title = input('Insérer un lien');
  readonly initialUrl = input('');
  readonly initialLabel = input('');
  readonly confirmLabel = input('Insérer');
  /** Cibles internes proposées (vide = pas de sélecteur, saisie libre seulement). */
  readonly targets = input<InternalLinkTarget[]>([]);

  readonly confirmed = output<LinkDialogResult>();
  readonly cancelled = output<void>();

  readonly url = signal('');
  readonly label = signal('');

  readonly pages = computed(() => this.targets().filter((t) => t.group === 'Pages'));
  readonly articles = computed(() => this.targets().filter((t) => t.group === 'Articles'));

  /** L'option du sélecteur qui correspond à l'adresse courante — sinon le placeholder. */
  readonly selectedTarget = computed(
    () => this.targets().find((t) => t.url === this.url())?.url ?? '',
  );

  /**
   * Choix d'une cible interne : remplit l'adresse, et propose le libellé de la
   * cible comme texte affiché si l'auteur n'en a pas déjà saisi un — le titre de
   * l'article lié fait une bien meilleure ancre qu'une URL ou un « lire la suite ».
   */
  onInternalPick(event: Event): void {
    const url = (event.target as HTMLSelectElement).value;
    if (!url) return;

    this.url.set(url);
    if (!this.label().trim()) {
      const target = this.targets().find((t) => t.url === url);
      if (target) this.label.set(target.label);
    }
  }

  constructor() {
    // À l'ouverture, pré-remplit les champs (lien en cours d'édition, ou sélection).
    // allowSignalWrites : on écrit dans un signal depuis l'effect (requis en Angular 18).
    effect(
      () => {
        if (this.open()) {
          this.url.set(this.initialUrl());
          this.label.set(this.initialLabel());
        }
      },
      { allowSignalWrites: true },
    );
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.open()) this.cancelled.emit();
  }

  onUrlInput(event: Event): void {
    this.url.set((event.target as HTMLInputElement).value);
  }

  onLabelInput(event: Event): void {
    this.label.set((event.target as HTMLInputElement).value);
  }

  onConfirm(): void {
    const url = this.url().trim();
    if (url) this.confirmed.emit({ url, label: this.label().trim() });
  }

  onCancel(): void {
    this.cancelled.emit();
  }
}
