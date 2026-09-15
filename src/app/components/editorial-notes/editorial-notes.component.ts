import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  input,
  signal,
} from '@angular/core';
import { annexTitle } from '../../common/article-intake';
import { NoteGroupe, notesDuGroupe } from '../../common/editorial-notes';
import { ArticleAnnex } from '../../model/article.model';

/**
 * Les notes de rédaction d'un groupe, posées à côté du geste qu'elles éclairent.
 *
 * **Pourquoi un composant.** La relecture et l'éditeur montrent les mêmes notes, chacune près
 * du champ qu'elle concerne — l'idée d'image dans la couverture, le mot-clé dans le
 * référencement. Recopier le gabarit six fois en aurait fait six à tenir d'accord.
 *
 * **Rien quand il n'y a rien.** Un article écrit à la main n'a pas de notes : le composant ne
 * rend alors aucun élément, et l'écran qui l'accueille ne montre pas de cadre vide.
 */
@Component({
  selector: 'app-editorial-notes',
  templateUrl: './editorial-notes.component.html',
  styleUrl: './editorial-notes.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EditorialNotesComponent {
  /** Les annexes de l'article, corps compris. Les posts sont écartés d'office. */
  readonly annexes = input<readonly ArticleAnnex[]>([]);
  readonly groupe = input.required<NoteGroupe>();

  /**
   * Dépliées d'emblée. Vrai pour l'idée d'image : une phrase qu'on lit en choisissant le
   * visuel, pas un document qu'on va consulter.
   */
  readonly ouvertes = input(false);

  readonly notes = computed(() => notesDuGroupe(this.annexes(), this.groupe()));

  /** Note dont le texte vient d'être copié, pour l'accusé sur son propre bouton. */
  readonly copiee = signal<string | null>(null);
  private copieTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    inject(DestroyRef).onDestroy(() => {
      if (this.copieTimer) clearTimeout(this.copieTimer);
    });
  }

  titre(note: ArticleAnnex): string {
    return annexTitle(note);
  }

  /**
   * Copie le texte d'une note. L'accusé est posé sur le bouton lui-même : ces notes vivent dans
   * des écrans qui n'ont pas tous un bandeau de message, et le geste suivant — coller dans un
   * courriel au graphiste, dans un outil SEO — se fait ailleurs.
   */
  async copier(note: ArticleAnnex): Promise<void> {
    try {
      await navigator.clipboard.writeText(note.body);
      this.copiee.set(note.id);
      if (this.copieTimer) clearTimeout(this.copieTimer);
      this.copieTimer = setTimeout(() => this.copiee.set(null), 1800);
    } catch {
      // Presse-papiers refusé : le texte reste affiché et sélectionnable à la main.
      this.copiee.set(null);
    }
  }
}
