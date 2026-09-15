import { toHtml } from './article-import';
import {
  ANNEX_BLOCKS,
  ANNEX_LABELS,
  IntakeAnnex,
  IntakeArticle,
  IntakeResult,
  annexSlotFor,
  estVrai,
  fieldFor,
  normalizeLabel,
  parseDateFr,
  slugifyLabel,
} from './article-intake';
import { DocxParagraph, readDocx } from './docx';
import { linkifyHtml } from './link-detection';

/**
 * Lecture d'un document Word comme **dossier éditorial complet** : l'article, ses
 * métadonnées, et ses annexes — posts réseaux sociaux, idée d'image, analyse SEO.
 *
 * ## Les trois règles, tirées des documents réels
 *
 * Trois fichiers ont servi d'étalon. Ils se répartissent en **deux gabarits** :
 *
 *  - l'un marque ses annexes par une **étiquette grasse à valeur vide** (`Post LinkedIn :`
 *    seul sur sa ligne, le texte suivant en dessous) ;
 *  - l'autre les marque par un **titre de niveau 2**, et regroupe même certaines
 *    métadonnées sous un titre (`SEO et visuel`).
 *
 * D'où les règles :
 *
 * **1. L'appareil éditorial s'arrête au dernier titre de niveau 1.** Ce titre est celui de
 * l'article ; tout ce qui suit est de la prose. On n'y cherche donc plus jamais d'étiquette —
 * et c'est essentiel, parce que le style rédactionnel emploie constamment la construction
 * « Formule courte : explication » (« Première vérification : … »), qui ressemble trait pour
 * trait à une métadonnée.
 *
 * **2. Un bloc s'ouvre sur un titre de niveau ≥ 2 *ou* sur une étiquette à valeur vide**, et
 * court jusqu'au suivant. Les deux gabarits ouvrent ainsi le même objet.
 *
 * **3. Un champ n'est reconnu que par son étiquette, jamais par sa position.** C'est le
 * vocabulaire qui filtre : les fausses étiquettes du corps des posts (« Ce qui change : … »)
 * n'y figurent pas et restent du contenu.
 *
 * Sur les trois documents, ces règles écartent la totalité des fausses étiquettes.
 */

/** Une étiquette découpée, avec son libellé d'origine conservé pour l'affichage. */
interface Etiquette {
  brut: string;
  label: string;
  valeur: string;
}

/**
 * Découpe « Libellé : valeur ».
 *
 * La borne de cinq mots écarte les phrases ordinaires : au-delà, un `:` sépare deux
 * propositions, il n'annonce pas un champ.
 */
function couperEtiquette(texte: string): Etiquette | null {
  const at = texte.indexOf(':');
  if (at <= 0) return null;

  const brut = texte.slice(0, at).trim();
  const label = normalizeLabel(brut);
  if (!label || label.split(' ').length > 5) return null;

  return { brut, label, valeur: texte.slice(at + 1).trim() };
}

/** Accumulateur d'un bloc en cours de lecture. */
interface BlocEnCours {
  slot: string;
  label: string;
  lignes: string[];
}

/**
 * Les règles, appliquées à une liste de paragraphes déjà lue.
 *
 * Séparé de {@link readDocxIntake} pour la même raison que `docx.ts` ignore les articles :
 * ouvrir l'archive et comprendre le document sont deux métiers. Celui-ci ne touche ni au
 * fichier ni au DOM — il s'exerce donc sur des paragraphes fabriqués à la main.
 */
export function intakeFromParagraphs(
  paragraphs: readonly DocxParagraph[],
  contexte: { titreFichier?: string; hasImages?: boolean } = {},
): IntakeResult {
  const core = { title: contexte.titreFichier };
  const hasImages = contexte.hasImages ?? false;

  // --- Règle 1 : borner l'appareil éditorial ------------------------------
  let dernierT1 = -1;
  paragraphs.forEach((p, i) => {
    if (p.heading === 1) dernierT1 = i;
  });

  const appareil = dernierT1 >= 0 ? paragraphs.slice(0, dernierT1) : [];
  const corps = dernierT1 >= 0 ? paragraphs.slice(dernierT1 + 1) : paragraphs;
  const titreH1 = dernierT1 >= 0 ? paragraphs[dernierT1].text.trim() : '';

  const warnings: string[] = [];
  if (dernierT1 < 0) {
    warnings.push(
      "aucun titre de niveau 1 : tout le document a été pris pour l'article, sans annexes.",
    );
  }
  if (hasImages) {
    warnings.push("le document contient des images — elles ne sont pas importées.");
  }

  // --- Règles 2 et 3 : champs et blocs ------------------------------------
  const champs = new Map<string, string>();
  const annexes: IntakeAnnex[] = [];
  let courant: BlocEnCours | null = null;

  const fermer = (): void => {
    // Un bloc sans contenu est un simple intertitre — « SEO et visuel » n'annonce que des
    // champs. On ne le conserve pas : il ne porterait rien.
    if (courant?.lignes.length) {
      annexes.push({
        slot: courant.slot,
        label: courant.label,
        body: courant.lignes.join('\n\n'),
      });
    }
    courant = null;
  };

  const ouvrir = (libelle: string): void => {
    fermer();
    const label = normalizeLabel(libelle);
    courant = {
      slot: annexSlotFor(label, ANNEX_BLOCKS) ?? slugifyLabel(libelle),
      label: libelle,
      lignes: [],
    };
  };

  for (const p of appareil) {
    const texte = p.text.trim();
    if (!texte) continue;

    if (p.heading === 1) {
      // « Métadonnées éditoriales » : un en-tête de section, rien à retenir.
      fermer();
      continue;
    }
    if (p.heading >= 2) {
      ouvrir(texte);
      continue;
    }

    const etiquette = couperEtiquette(texte);
    if (etiquette) {
      const champ = fieldFor(etiquette.label);
      if (champ && etiquette.valeur) {
        // Première occurrence retenue : les métadonnées ouvrent le document, une phrase
        // plus loin pourrait porter la même étiquette.
        if (!champs.has(champ)) champs.set(champ, etiquette.valeur);
        continue;
      }

      const note = annexSlotFor(etiquette.label, ANNEX_LABELS);
      if (note && etiquette.valeur) {
        // Une note d'une ligne ne referme pas le bloc qui l'entoure : dans l'un des
        // gabarits, « Idée d'image » vit à l'intérieur d'une section « SEO et visuel ».
        annexes.push({ slot: note, label: etiquette.brut, body: etiquette.valeur });
        continue;
      }

      if (!etiquette.valeur) {
        ouvrir(etiquette.brut);
        continue;
      }
    }

    // Tout le reste est du contenu de bloc — ou rien, si aucun bloc n'est ouvert.
    if (courant) courant.lignes.push(texte);
  }
  fermer();

  // --- L'article ----------------------------------------------------------
  const content = toHtml(corps);

  const titre = champs.get('title') || titreH1 || core.title || '';
  const errors: string[] = [];
  if (!titre) errors.push("aucun titre trouvé dans le document.");
  if (!content.trim()) errors.push("aucun corps d'article trouvé.");

  const { iso, jour, erreur } = parseDateFr(champs.get('publishAt') ?? '');
  if (erreur) warnings.push(erreur);
  if (jour) {
    warnings.push("le document ne donne qu'un jour : l'heure de parution reste à préciser.");
  }

  // Une date déjà passée serait refusée par le serveur ; on le dit ici sans bloquer, elle se
  // corrige à l'arrivée. Pour un jour seul, on compare au jour courant — pas à l'instant.
  const passee =
    (iso !== null && new Date(iso).getTime() <= Date.now()) ||
    (jour !== null && jour < new Date().toISOString().slice(0, 10));
  if (passee) warnings.push('la date de parution proposée est déjà passée.');

  if (errors.length) return { articles: [], errors };

  const tags = (champs.get('tags') ?? '')
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean);

  const article: IntakeArticle = {
    input: {
      title: titre,
      ...(champs.get('slug') ? { slug: champs.get('slug') } : {}),
      ...(champs.get('excerpt') ? { excerpt: champs.get('excerpt') } : {}),
      content,
      ...(champs.get('metaTitle') ? { metaTitle: champs.get('metaTitle') } : {}),
      ...(champs.get('metaDescription')
        ? { metaDescription: champs.get('metaDescription') }
        : {}),
      ...(tags.length ? { tags } : {}),
      origin: 'ASSISTANT',
    },
    proposedPublishAt: passee ? null : iso,
    // Le jour reste proposé même s'il est passé : il dit ce que le document voulait, et
    // l'effacer obligerait à rouvrir le fichier pour le retrouver.
    proposedPublishDay: jour,
    proposedFeatured: estVrai(champs.get('featured') ?? ''),
    series: champs.get('series') ?? null,
    coverImageAlt: champs.get('coverImageAlt') ?? null,
    annexes,
    warnings,
  };

  return { articles: [article], errors: [] };
}

/**
 * Lit un `.docx` comme dossier éditorial.
 *
 * Ouvre l'archive, applique les règles, puis transforme les adresses écrites en texte brut en
 * vrais liens — Word ne pose un lien que sur une adresse explicitement liée, et une URL
 * simplement tapée arriverait inerte, indiscernable d'une phrase à la relecture.
 */
export async function readDocxIntake(file: Blob): Promise<IntakeResult> {
  const { paragraphs, core, hasImages } = await readDocx(file);
  const lu = intakeFromParagraphs(paragraphs, {
    titreFichier: core.title,
    hasImages,
  });

  if (!lu.articles.length) return lu;

  // `DOMParser` plutôt que le `document` global : ce module est compilé aussi pour le SSR.
  const host = new DOMParser().parseFromString('<body></body>', 'text/html');
  return {
    ...lu,
    articles: lu.articles.map((a) => ({
      ...a,
      input: { ...a.input, content: linkifyHtml(a.input.content ?? '', host) },
    })),
  };
}
