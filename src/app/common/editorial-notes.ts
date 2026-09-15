import { sortAnnexes } from './article-intake';
import { POST_SLOTS } from './social-networks';

/**
 * Les notes de rédaction : ce qui accompagne un article sans être ni l'article, ni un post.
 *
 * **Pourquoi des groupes.** Chaque note sert à un geste précis, et ce geste se fait à un endroit
 * précis de l'écran. L'idée d'image se lit en choisissant la couverture ; le mot-clé, en réglant
 * le référencement ; les liens internes, en relisant le texte. Les regrouper toutes dans un bloc
 * à part obligerait à faire l'aller-retour — c'est ce qui les rendait inutiles sur l'écran de
 * diffusion, qu'on ouvre une fois l'article déjà publié.
 */
export type NoteGroupe = 'image' | 'seo' | 'autres';

/**
 * Le groupe d'une note, d'après son emplacement.
 *
 * `autres` recueille les liens internes **et** tout bloc que l'import n'a pas reconnu : une note
 * au nom libre reste visible sous le texte plutôt que de disparaître faute de case prévue.
 */
export function groupeDeNote(slot: string): NoteGroupe {
  if (slot === 'image') return 'image';
  if (slot.startsWith('seo-')) return 'seo';
  return 'autres';
}

/** Les notes d'un groupe, dans l'ordre d'affichage stable des emplacements connus. */
export function notesDuGroupe<T extends { slot: string }>(
  annexes: readonly T[],
  groupe: NoteGroupe,
): T[] {
  return sortAnnexes(
    annexes.filter(
      (a) => !POST_SLOTS.includes(a.slot) && groupeDeNote(a.slot) === groupe,
    ),
  );
}
