import {
  ChangeDetectionStrategy,
  Component,
  computed,
  forwardRef,
  input,
  output,
  signal,
} from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { Tag } from '../../model/article.model';

interface TagOption {
  label: string;
  create: boolean;
  tag: Tag | null;
}

/**
 * Champ de saisie de tags : chips supprimables + autocomplétion (navigable au
 * clavier) + création à la volée + mini-CRUD (renommer/supprimer un tag global
 * depuis les suggestions). Valeur = tableau de noms (string[]).
 */
@Component({
    selector: 'app-tag-input',
    imports: [],
    templateUrl: './tag-input.component.html',
    styleUrl: './tag-input.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
    providers: [
        {
            provide: NG_VALUE_ACCESSOR,
            useExisting: forwardRef(() => TagInputComponent),
            multi: true,
        },
    ]
})
export class TagInputComponent implements ControlValueAccessor {
  /** Tags existants (pour l'autocomplétion + le CRUD). */
  readonly suggestions = input<Tag[]>([]);

  /** Émis pour supprimer un tag globalement. */
  readonly tagRemove = output<Tag>();
  /** Émis pour renommer un tag globalement (le parent affiche la modale). */
  readonly tagRename = output<Tag>();

  readonly tags = signal<string[]>([]);
  readonly query = signal('');
  readonly open = signal(false);
  readonly disabled = signal(false);
  /** Index de l'option surlignée (navigation clavier ; -1 = aucune). */
  readonly activeIndex = signal(-1);

  readonly tagCreate = output<string>();

  /** Suggestions filtrées par la saisie, hors tags déjà sélectionnés. */
  readonly filtered = computed<Tag[]>(() => {
    const q = this.query().trim().toLowerCase();
    const selected = new Set(this.tags().map((t) => t.toLowerCase()));
    return this.suggestions()
      .filter(
        (t) =>
          !selected.has(t.name.toLowerCase()) &&
          (!q || t.name.toLowerCase().includes(q)),
      )
      .slice(0, 8);
  });

  /** La saisie correspond-elle à un nouveau tag (à créer) ? */
  readonly canCreate = computed(() => {
    const q = this.query().trim().toLowerCase();
    if (!q) return false;
    return (
      !this.tags().some((t) => t.toLowerCase() === q) &&
      !this.suggestions().some((s) => s.name.toLowerCase() === q)
    );
  });

  /** Options du menu (suggestions existantes + éventuelle création). */
  readonly options = computed<TagOption[]>(() => {
    const opts: TagOption[] = this.filtered().map((tag) => ({
      label: tag.name,
      create: false,
      tag,
    }));
    if (this.canCreate()) {
      opts.push({ label: this.query().trim(), create: true, tag: null });
    }
    return opts;
  });

  createAndAdd(name: string): void {
    // La virgule est un séparateur : elle ne doit jamais faire partie du nom.
    const clean = name.replace(/,/g, '').trim();
    if (clean) this.tagCreate.emit(clean);
    this.query.set('');
    this.open.set(false);
    this.activeIndex.set(-1);
  }

  private onChange: (value: string[]) => void = () => {};
  onTouched: () => void = () => {};

  writeValue(value: string[]): void {
    this.tags.set(value ?? []);
  }
  registerOnChange(fn: (value: string[]) => void): void {
    this.onChange = fn;
  }
  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }
  setDisabledState(isDisabled: boolean): void {
    this.disabled.set(isDisabled);
  }

  /**
   * Ajoute un ou plusieurs tags depuis une saisie brute : découpe sur les virgules
   * (« Voiture, mécanique, réparation » → 3 tags), dédoublonne (insensible à la
   * casse) et réutilise le nom canonique d'un tag existant si la casse diffère.
   * Les tags nouveaux sont créés à l'enregistrement de l'article (upsert côté back).
   */
  add(raw: string): void {
    const names = raw
      .split(',')
      .map((n) => n.trim())
      .filter(Boolean);

    if (names.length) {
      let changed = false;
      this.tags.update((arr) => {
        const next = [...arr];
        for (const name of names) {
          // Réutilise le tag existant (casse canonique) s'il y en a un.
          const existing = this.suggestions().find(
            (s) => s.name.toLowerCase() === name.toLowerCase(),
          );
          const finalName = existing?.name ?? name;
          if (!next.some((t) => t.toLowerCase() === finalName.toLowerCase())) {
            next.push(finalName);
            changed = true;
          }
        }
        return next;
      });
      if (changed) this.onChange(this.tags());
    }

    this.query.set('');
    this.open.set(false);
    this.activeIndex.set(-1);
  }

  remove(name: string): void {
    this.tags.update((arr) => arr.filter((t) => t !== name));
    this.onChange(this.tags());
  }

  /** Émet la demande de renommage vers le parent (qui affiche la modale). */
  renameTagInList(tag: Tag): void {
    this.tagRename.emit(tag);
  }

  /** Supprime un tag global → émet vers le parent (qui confirme). */
  removeTagFromList(tag: Tag): void {
    this.tagRemove.emit(tag);
  }

  onInput(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    // Une virgule agit comme séparateur : on valide les segments complets et on
    // garde le reste dans le champ → jamais de virgule dans un nom de tag
    // (ex. « data, » saisi ou collé ne crée pas le tag « data, » mais « data »).
    if (value.includes(',')) {
      const parts = value.split(',');
      const remainder = parts.pop() ?? '';
      const complete = parts.map((p) => p.trim()).filter(Boolean);
      if (complete.length) this.add(complete.join(','));
      this.query.set(remainder);
      this.open.set(true);
      this.activeIndex.set(-1);
      return;
    }
    this.query.set(value);
    this.open.set(true);
    this.activeIndex.set(-1);
  }

  /** Collage : si le texte contient des virgules, on découpe en plusieurs tags. */
  onPaste(event: ClipboardEvent): void {
    const text = event.clipboardData?.getData('text/plain') ?? '';
    if (text.includes(',')) {
      event.preventDefault();
      this.add(text);
    }
    // Sans virgule : collage normal → va dans le champ, validé comme d'habitude.
  }

  onKeydown(event: KeyboardEvent): void {
    const opts = this.options();

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      this.open.set(true);
      if (opts.length) {
        this.activeIndex.update((i) => Math.min(i + 1, opts.length - 1));
      }
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      if (opts.length) this.activeIndex.update((i) => Math.max(i - 1, 0));
    } else if (event.key === 'Enter' || event.key === ',') {
      event.preventDefault();
      const i = this.activeIndex();
      if (i >= 0 && i < opts.length) {
        this.add(opts[i].label);
      } else if (this.query().trim()) {
        this.add(this.query());
      }
    } else if (event.key === 'Backspace' && !this.query() && this.tags().length) {
      this.remove(this.tags()[this.tags().length - 1]);
    } else if (event.key === 'Escape') {
      this.open.set(false);
      this.activeIndex.set(-1);
    }
  }

  onBlur(): void {
    this.onTouched();
    // Valide le tag en cours de saisie (au cas où l'utilisateur clique ailleurs
    // — ex. le bouton Enregistrer — sans avoir appuyé sur Entrée).
    if (this.query().trim()) {
      this.add(this.query());
    } else {
      // Laisse le temps au clic sur une option de s'exécuter avant de fermer.
      setTimeout(() => this.open.set(false), 150);
    }
  }
}
