import type { EventInput } from '../model/event.model';
import { toHtml } from './article-import';
import { readDocx } from './docx';
import { EVENT_FIELD_NAMES, EventField, eventFieldFor, readEventFields } from './event-intake';
import { linkifyHtml } from './link-detection';

/**
 * Traduction d'un document Word en champs d'évènement — le bouton « Importer… » de l'éditeur.
 *
 * Même trame que pour les articles : des lignes « Étiquette : valeur » pour les champs, et le
 * texte de l'évènement sous son titre de niveau 1. Les étiquettes sont celles du collage
 * (`event-intake.ts`) : un document et un texte collé se comprennent de la même façon.
 *
 * Un document qui ne suit pas la trame reste importable : sans étiquettes, on retombe sur son
 * titre et son texte, et ce qui manque pour publier s'affiche dans l'éditeur.
 */

export interface ImportedEvent {
  /** Champs lus. `content` n'y figure que si le document avait un texte. */
  readonly values: Partial<EventInput>;
  /** Libellés des champs remplis, pour le bilan. */
  readonly filled: readonly string[];
  /** Valeurs illisibles et étiquettes ignorées : laissées de côté, à vérifier. */
  readonly issues: readonly string[];
  /** Le document embarquait des images — jamais importées. */
  readonly hasImages: boolean;
}

/**
 * Découpe « Étiquette : valeur » sur le premier deux-points, et seulement si l'étiquette est
 * connue : « Ce qu'on retient : … » dans le texte n'est pas un champ.
 */
function labelled(text: string): { label: string; value: string; field: EventField } | null {
  const at = text.indexOf(':');
  if (at <= 0) return null;
  const label = text.slice(0, at);
  if (label.trim().split(/\s+/).length > 5) return null;
  const field = eventFieldFor(label);
  return field ? { label, value: text.slice(at + 1), field } : null;
}

/**
 * Lit un document Word et en tire les champs d'un évènement.
 *
 * @throws {DocxReadError} si le fichier n'est pas un `.docx` lisible.
 */
export async function importEventFromDocx(file: Blob): Promise<ImportedEvent> {
  const { paragraphs, core, hasImages } = await readDocx(file);

  const pairs = paragraphs
    .filter((p) => p.heading === 0)
    .map((p) => labelled(p.text))
    .filter((pair): pair is NonNullable<typeof pair> => pair !== null);

  // Le texte : ce qui suit le dernier titre de niveau 1, ou à défaut tout ce qui n'est pas une
  // étiquette. Ce qui précède le titre est l'appareil éditorial.
  let start = -1;
  paragraphs.forEach((p, i) => {
    if (p.heading === 1) start = i;
  });
  const body =
    start >= 0
      ? paragraphs.slice(start + 1).filter((p) => !labelled(p.text))
      : paragraphs.filter((p) => !labelled(p.text));

  const read = readEventFields(pairs);
  const values: Partial<EventInput> = { ...read.values };

  // Le titre de niveau 1 fait foi s'il n'y avait pas d'étiquette « Titre ».
  if (!values.title && start >= 0) values.title = paragraphs[start].text.slice(0, 90);
  if (!values.title && core.title) values.title = core.title.slice(0, 90);

  // `DOMParser` plutôt que le `document` global : ce module est compilé aussi pour le SSR.
  const host = new DOMParser().parseFromString('<body></body>', 'text/html');
  const content = body.length ? linkifyHtml(toHtml(body), host) : '';
  if (content) values.content = content;

  const filled = [
    ...(values.title && !read.filled.includes('title') ? ['titre'] : []),
    ...read.filled.map((field) => EVENT_FIELD_NAMES[field]),
    ...(content ? ['description'] : []),
  ];

  return {
    values,
    filled,
    issues: [
      ...read.errors,
      ...read.warnings,
      ...(read.unknown.length ? [`étiquettes ignorées : ${read.unknown.join(', ')}.`] : []),
    ],
    hasImages,
  };
}
