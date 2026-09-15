import {
  forbiddenForPublication,
  missingForPublication,
  publicationWarnings,
  warningText,
} from '../model/event.model';
import type { EventInput } from '../model/event.model';
import { readEventFields, toEventInput } from './event-intake';

/**
 * Lecture d'évènements collés depuis une conversation avec une IA.
 *
 * Même principe que les articles (`article-paste.ts`) : la frontière est **déclarée**, rien
 * n'est deviné. Un en-tête « clé: valeur », une ligne `---`, puis la description en HTML ;
 * plusieurs évènements se séparent par une ligne de `===`.
 *
 *     titre: Travailler à plusieurs — L’afterwork des indépendants du Grand Avignon
 *     type: afterwork
 *     debut: 2026-10-08T18:30:00+02:00
 *     fin: 2026-10-08T23:00:00+02:00
 *     lieu: Le 9 — Living Lab d’Agroparc
 *     partenaire: lieu-accueil | Le 9 | | https://…
 *     intervenant: Camille Martin | Travailler et facturer à plusieurs
 *     ---
 *     <p>…</p>
 *
 * Deux niveaux, comme la spec : une **erreur** (valeur illisible, titre absent) empêche de
 * créer ; le reste — ce qui manquera pour publier, le vocabulaire hors charte — s'affiche sans
 * rien bloquer. On crée un brouillon : c'est à la publication que la spec devient exigeante.
 */

export interface PastedEvent {
  input: EventInput;
  /** Ce qui mérite un regard sans empêcher la création. */
  warnings: string[];
}

export interface PastedEvents {
  events: PastedEvent[];
  /** Ce qui empêche de créer. */
  errors: string[];
}

/** Séparateur entre deux évènements : une ligne ne contenant que des `=`. */
const SEPARATOR = /^\s*={3,}\s*$/;

/** Fin de l'en-tête (`---`) ou ouverture d'une section nommée (`--- linkedin`). */
const DASHES = /^\s*-{3,}\s*(.*)$/;

/** Découpe en blocs ; un séparateur en trop ne mérite pas d'erreur. */
function split(text: string): string[] {
  return text
    .split(/\r?\n/)
    .reduce<string[][]>(
      (blocks, line) => {
        if (SEPARATOR.test(line)) blocks.push([]);
        else blocks[blocks.length - 1].push(line);
        return blocks;
      },
      [[]],
    )
    .map((lines) => lines.join('\n'))
    .filter((block) => block.trim().length > 0);
}

interface Block {
  pairs: { label: string; value: string }[];
  body: string;
  /** Lignes d'en-tête sans « : », ignorées. */
  stray: string[];
  /** Sections `--- nom` : les évènements n'ont pas d'annexes, elles sont écartées. */
  sections: string[];
  /** Une ligne `---` a été vue : sans elle, tout le bloc est lu comme en-tête. */
  closed: boolean;
}

function read(block: string): Block {
  const pairs: Block['pairs'] = [];
  const stray: string[] = [];
  const sections: string[] = [];
  const body: string[] = [];
  /** `null` pendant l'en-tête, `''` dans la description, sinon le nom de la section. */
  let section: string | null = null;

  for (const line of block.split(/\r?\n/)) {
    const dashes = DASHES.exec(line);
    if (dashes) {
      section = dashes[1].trim();
      if (section) sections.push(section);
      continue;
    }

    if (section === '') {
      body.push(line);
      continue;
    }
    if (section !== null) continue; // contenu d'une section écartée

    if (!line.trim()) continue;
    const at = line.indexOf(':');
    if (at <= 0) {
      stray.push(line.trim());
      continue;
    }
    // On ne coupe qu'au premier « : » — une adresse web en contient.
    pairs.push({ label: line.slice(0, at), value: line.slice(at + 1) });
  }

  return { pairs, body: body.join('\n').trim(), stray, sections, closed: section !== null };
}

/** Lit un ou plusieurs évènements collés. */
export function parsePastedEvents(text: string): PastedEvents {
  const blocks = split(text);
  if (!blocks.length) {
    return { events: [], errors: ['Rien à lire : le texte collé est vide.'] };
  }

  const events: PastedEvent[] = [];
  const errors: string[] = [];

  blocks.forEach((raw, index) => {
    const prefix = blocks.length > 1 ? `Évènement ${index + 1} : ` : '';
    const { pairs, body, stray, sections, closed } = read(raw);
    const fields = readEventFields(pairs);

    const blockErrors = [...fields.errors];
    if (!fields.values.title) blockErrors.unshift('il manque la ligne « titre: ».');
    // La description est facultative, mais du texte sous l'en-tête sans `---` en est une qu'on
    // perdrait en silence. Cas vécu : copiée depuis le rendu d'une conversation, la ligne `---`
    // collée sous « apres inscription: … » devient un titre et disparaît.
    const html = fields.unknown.some((label) => label.trim().startsWith('<'));
    if (!closed && (stray.length || html)) {
      blockErrors.push(
        'aucune ligne « --- » : le texte sous l’en-tête serait ignoré et la description vide. ' +
          'Ajouter « --- » seul sur sa ligne avant la description.',
      );
    }
    if (blockErrors.length) {
      errors.push(...blockErrors.map((e) => prefix + e));
      return;
    }

    const input = toEventInput(fields.values, body);
    const warnings = [...fields.warnings];

    if (fields.unknown.length) {
      warnings.push(`lignes d'en-tête ignorées : ${fields.unknown.join(', ')}.`);
    }
    if (stray.length) {
      warnings.push(`lignes sans « : » ignorées : ${stray.slice(0, 3).join(' · ')}${stray.length > 3 ? '…' : ''}`);
    }
    if (sections.length) {
      warnings.push(
        `sections ignorées (${sections.join(', ')}) : les évènements n'ont pas encore de kit de diffusion.`,
      );
    }
    if (!input.slug) {
      warnings.push('pas de ligne « slug: » : l’adresse sera calculée depuis le type, le titre et la date.');
    }
    if (/<h1[\s>]/i.test(body)) {
      warnings.push('la description contient un <h1> — la page en rend déjà un, il sera retiré.');
    }

    const missing = missingForPublication(input);
    if (missing.length) warnings.push(`pour publier, il manquera ${missing.join(', ')}.`);
    warnings.push(
      ...forbiddenForPublication(input),
      ...publicationWarnings(input).map(warningText),
    );

    events.push({ input, warnings });
  });

  return { events, errors };
}
