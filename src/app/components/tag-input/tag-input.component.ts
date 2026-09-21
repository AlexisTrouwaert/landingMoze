import { isPlatformBrowser } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  PLATFORM_ID,
  computed,
  effect,
  forwardRef,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { Tag } from '../../model/article.model';

/** Hauteur maximale du menu (cf. `.tagi__menu`), pour décider s'il s'ouvre vers le haut. */
const MENU_MAX_HEIGHT = 240;
const MENU_GAP = 5;

/** Position du menu dans la fenêtre : sous le champ (`top`) ou au-dessus (`bottom`). */
interface MenuPosition {
  left: number;
  width: number;
  top: number | null;
  bottom: number | null;
}

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

  // --- Position du menu ---------------------------------------------------------
  //
  // Le menu est posé **par rapport à la fenêtre** (`position: fixed`), pas sous le champ dans le
  // flux. Dans l'éditeur, le champ vit dans un rail qui défile pour son compte (`overflow`) : un
  // menu en `absolute` y serait rogné au bord du rail. Fixé, il passe par-dessus tout, suit le
  // champ quand on fait défiler, et s'ouvre vers le haut quand la place manque en bas.

  private readonly field = viewChild<ElementRef<HTMLElement>>('field');
  private readonly browser = isPlatformBrowser(inject(PLATFORM_ID));
  readonly menuPosition = signal<MenuPosition | null>(null);

  private readonly reposition = () => {
    const rect = this.field()?.nativeElement.getBoundingClientRect();
    if (!rect) return;
    const below = window.innerHeight - rect.bottom;
    const upward = below < MENU_MAX_HEIGHT + MENU_GAP && rect.top > below;
    this.menuPosition.set({
      left: rect.left,
      width: rect.width,
      top: upward ? null : rect.bottom + MENU_GAP,
      bottom: upward ? window.innerHeight - rect.top + MENU_GAP : null,
    });
  };

  constructor() {
    // Écoute le défilement de n'importe quel conteneur (capture) tant que le menu est ouvert.
    effect((onCleanup) => {
      if (!this.browser || !this.open() || !this.options().length) return;
      this.reposition();
      window.addEventListener('scroll', this.reposition, { capture: true, passive: true });
      window.addEventListener('resize', this.reposition, { passive: true });
      onCleanup(() => {
        window.removeEventListener('scroll', this.reposition, { capture: true });
        window.removeEventListener('resize', this.reposition);
      });
    });
    inject(DestroyRef).onDestroy(() => this.menuPosition.set(null));
  }

  /**
   * Clé de comparaison d'un nom de tag : sans casse ni accents, pour que
   * « Électriciens », « electriciens » et « ÉLECTRICIENS » soient reconnus comme
   * un seul et même tag. Même règle que le `slugify` du back, qui déduplique en
   * base : sans ça, l'éditeur proposait de créer un tag que le back refusait
   * ensuite comme déjà existant.
   */
  private fold(value: string): string {
    return value
      .normalize('NFD')
      .replace(/\p{M}/gu, '')
      .toLowerCase()
      .trim();
  }

  /** Suggestions filtrées par la saisie, hors tags déjà sélectionnés. */
  readonly filtered = computed<Tag[]>(() => {
    const q = this.fold(this.query());
    const selected = new Set(this.tags().map((t) => this.fold(t)));
    return this.suggestions()
      .filter(
        (t) =>
          !selected.has(this.fold(t.name)) &&
          (!q || this.fold(t.name).includes(q)),
      )
      .slice(0, 8);
  });

  /** La saisie correspond-elle à un nouveau tag (à créer) ? */
  readonly canCreate = computed(() => {
    const q = this.fold(this.query());
    if (!q) return false;
    return (
      !this.tags().some((t) => this.fold(t) === q) &&
      !this.suggestions().some((s) => this.fold(s.name) === q)
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
   * (« Voiture, mécanique, réparation » → 3 tags), dédoublonne et réutilise le nom
   * canonique d'un tag existant dès que seules la casse ou les accents diffèrent.
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
          // Réutilise l'orthographe déjà en base (« Électriciens » plutôt que la
          // saisie « electriciens ») : c'est ce tag-là que le back rattachera.
          const existing = this.suggestions().find(
            (s) => this.fold(s.name) === this.fold(name),
          );
          const finalName = existing?.name ?? name;
          if (!next.some((t) => this.fold(t) === this.fold(finalName))) {
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

  /**
   * Met un tag en tête de liste. C'est le premier tag qui est mis en avant côté
   * blog (affiché comme catégorie sur la carte « à la une ») : le déplacer est
   * la façon de choisir celui qu'on veut y voir.
   */
  promote(name: string): void {
    const current = this.tags();
    if (current[0] === name) return;
    this.tags.set([name, ...current.filter((t) => t !== name)]);
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
