import { FlagField } from '../model/article.model';
import { SeriesFlagField } from '../model/series.model';
import { networkFor } from './social-networks';

/** Libellés des cibles de signalement, pour l'affichage. */
export const FLAG_LABELS: Readonly<Record<FlagField, string>> = {
  title: 'Titre',
  slug: 'Adresse',
  excerpt: 'Extrait',
  metaTitle: 'Titre moteurs',
  metaDescription: 'Description moteurs',
  content: 'Passage',
  annex: 'Post',
};

/** Libellés des champs d'un brouillon de série. « Nom » et non « Titre » : c'est le mot de l'écran. */
export const SERIES_FLAG_LABELS: Readonly<Record<SeriesFlagField, string>> = {
  title: 'Nom de la série',
  pitch: 'Accroche',
  imageIdea: 'Idée d’image',
};

/**
 * « Titre », « Passage », « Post LinkedIn »… — la cible d'un signalement, en clair.
 *
 * Partagé par la relecture et l'éditeur : un même signalement doit porter le même nom quel que
 * soit l'écran d'où on le regarde. `sur` dit ce qui est signalé : un même champ `title` se
 * nomme « Titre » sur un article et « Nom de la série » sur une série.
 */
export function flagLabel(
  cible: { field: FlagField | SeriesFlagField; annexSlot?: string | null },
  sur: 'article' | 'serie' = 'article',
): string {
  if (sur === 'serie') {
    return SERIES_FLAG_LABELS[cible.field as SeriesFlagField] ?? cible.field;
  }
  if (cible.field === 'annex') {
    const reseau = cible.annexSlot ? networkFor(cible.annexSlot)?.label : null;
    return `Post ${reseau ?? cible.annexSlot ?? ''}`.trim();
  }
  return FLAG_LABELS[cible.field as FlagField] ?? cible.field;
}
