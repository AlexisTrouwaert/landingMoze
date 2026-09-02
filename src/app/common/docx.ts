/**
 * Lecture d'un fichier `.docx`, sans dépendance externe.
 *
 * Un `.docx` est une archive ZIP contenant du XML. Deux briques suffisent, toutes deux natives
 * du navigateur : `DecompressionStream('deflate-raw')` pour décompresser, `DOMParser` pour lire
 * le XML. C'est le même parti pris que l'éditeur WYSIWYG (cf. `wysiwyg-editor.component.ts`) :
 * une librairie de plus pour un écran d'admin utilisé quelques fois par semaine ne se justifie
 * pas, et celles du domaine (mammoth & co.) pèsent plusieurs centaines de kilo-octets.
 *
 * Ce module ne connaît RIEN aux articles : il rend des paragraphes typés. Le sens éditorial
 * (quel paragraphe est le titre, lequel porte les tags…) est l'affaire de `article-import.ts`.
 */

/** Espaces de noms WordprocessingML. */
const W_NS = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
const R_NS = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';

/** Un paragraphe du document, réduit à ce dont l'import a besoin. */
export interface DocxParagraph {
  /** Niveau de titre (1 à 6), ou 0 pour un paragraphe courant. */
  readonly heading: number;
  /** Texte brut — c'est lui qu'on interroge pour lire les champs étiquetés. */
  readonly text: string;
  /** Le même contenu en HTML, limité aux balises acceptées par le back (`strong`, `em`, `a`). */
  readonly html: string;
  /** Type de liste quand le paragraphe en fait partie, `null` sinon. */
  readonly list: 'ul' | 'ol' | null;
}

export interface DocxDocument {
  readonly paragraphs: readonly DocxParagraph[];
  /** Propriétés du fichier (`docProps/core.xml`). */
  readonly core: { readonly title?: string; readonly creator?: string };
  /** Vrai si le document embarque des images — signalé, mais jamais importé. */
  readonly hasImages: boolean;
}

/** Le fichier fourni n'est pas un `.docx` exploitable. */
export class DocxReadError extends Error {}

// --- ZIP ------------------------------------------------------------------

const EOCD_SIGNATURE = 0x06054b50;
const CENTRAL_SIGNATURE = 0x02014b50;

/**
 * Décompresse un flux `deflate` brut. `DecompressionStream` est natif depuis Chrome 80,
 * Firefox 113 et Safari 16.4 — largement au-delà de ce que demande un écran d'administration.
 */
async function inflateRaw(data: Uint8Array): Promise<Uint8Array> {
  const stream = new Blob([data as BlobPart])
    .stream()
    .pipeThrough(new DecompressionStream('deflate-raw'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

/**
 * Extrait les fichiers d'une archive ZIP.
 *
 * On passe par le **répertoire central** (en fin d'archive) plutôt que d'enchaîner les en-têtes
 * locaux : c'est la seule table dont les tailles sont fiables, un en-tête local pouvant les
 * renvoyer à zéro quand l'archive a été écrite en flux (ce que fait Word).
 */
async function readZip(buffer: ArrayBuffer): Promise<Map<string, Uint8Array>> {
  const view = new DataView(buffer);
  const bytes = new Uint8Array(buffer);

  // L'EOCD se trouve à la fin, précédé d'un commentaire de longueur variable : on remonte.
  let eocd = -1;
  for (let i = buffer.byteLength - 22; i >= 0 && i > buffer.byteLength - 22 - 0xffff; i--) {
    if (view.getUint32(i, true) === EOCD_SIGNATURE) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new DocxReadError("Le fichier n'est pas une archive valide.");

  const count = view.getUint16(eocd + 10, true);
  let offset = view.getUint32(eocd + 16, true);

  const entries = new Map<string, Uint8Array>();
  const decoder = new TextDecoder();

  for (let i = 0; i < count; i++) {
    if (view.getUint32(offset, true) !== CENTRAL_SIGNATURE) break;

    const method = view.getUint16(offset + 10, true);
    const compressedSize = view.getUint32(offset + 20, true);
    const nameLength = view.getUint16(offset + 28, true);
    const extraLength = view.getUint16(offset + 30, true);
    const commentLength = view.getUint16(offset + 32, true);
    const localOffset = view.getUint32(offset + 42, true);
    const name = decoder.decode(bytes.subarray(offset + 46, offset + 46 + nameLength));

    // L'en-tête local répète les longueurs de nom et d'extra, qui peuvent différer de celles du
    // répertoire central : les données commencent après elles, pas à un décalage fixe.
    const localNameLength = view.getUint16(localOffset + 26, true);
    const localExtraLength = view.getUint16(localOffset + 28, true);
    const start = localOffset + 30 + localNameLength + localExtraLength;
    const raw = bytes.subarray(start, start + compressedSize);

    // 0 = stocké tel quel, 8 = deflate. Word n'en utilise pas d'autre.
    if (method === 0) entries.set(name, raw);
    else if (method === 8) entries.set(name, await inflateRaw(raw));

    offset += 46 + nameLength + extraLength + commentLength;
  }

  return entries;
}

// --- WordprocessingML -----------------------------------------------------

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Niveau de titre d'un paragraphe, d'après son style.
 *
 * Word nomme ses styles dans la langue de l'interface (`Titre1` en français, `Heading1` en
 * anglais) et Google Docs exporte en anglais — les deux sont donc reconnues. `w:outlineLvl`
 * sert de recours pour un style personnalisé qui déclarerait quand même son niveau.
 */
function headingLevel(paragraph: Element): number {
  const style = paragraph
    .getElementsByTagNameNS(W_NS, 'pStyle')[0]
    ?.getAttributeNS(W_NS, 'val');

  const named = style?.match(/^(?:titre|heading)\s*(\d)$/i);
  if (named) return Number(named[1]);

  const outline = paragraph
    .getElementsByTagNameNS(W_NS, 'outlineLvl')[0]
    ?.getAttributeNS(W_NS, 'val');
  if (outline !== null && outline !== undefined) return Number(outline) + 1;

  return 0;
}

/**
 * Table `numId` → type de liste, lue dans `numbering.xml`.
 *
 * Un paragraphe de liste ne dit que son `numId` ; c'est la définition correspondante qui précise
 * s'il s'agit de puces ou d'une numérotation.
 */
function readNumbering(xml: Document | null): Map<string, 'ul' | 'ol'> {
  const byNumId = new Map<string, 'ul' | 'ol'>();
  if (!xml) return byNumId;

  const abstractFormats = new Map<string, 'ul' | 'ol'>();
  for (const abstract of Array.from(xml.getElementsByTagNameNS(W_NS, 'abstractNum'))) {
    const id = abstract.getAttributeNS(W_NS, 'abstractNumId');
    // Seul le premier niveau nous intéresse : le contenu importé est mis à plat.
    const format = Array.from(abstract.getElementsByTagNameNS(W_NS, 'numFmt'))[0]?.getAttributeNS(
      W_NS,
      'val',
    );
    if (id) abstractFormats.set(id, format === 'bullet' ? 'ul' : 'ol');
  }

  for (const num of Array.from(xml.getElementsByTagNameNS(W_NS, 'num'))) {
    const numId = num.getAttributeNS(W_NS, 'numId');
    const abstractId = num
      .getElementsByTagNameNS(W_NS, 'abstractNumId')[0]
      ?.getAttributeNS(W_NS, 'val');
    if (numId && abstractId) {
      byNumId.set(numId, abstractFormats.get(abstractId) ?? 'ol');
    }
  }

  return byNumId;
}

/** Le contenu d'un `w:r` (une suite de caractères de même mise en forme), en HTML. */
function runToHtml(run: Element): string {
  let html = '';

  for (const node of Array.from(run.childNodes)) {
    if (node.nodeType !== 1) continue;
    const element = node as Element;
    const name = element.localName;

    if (name === 't') html += escapeHtml(element.textContent ?? '');
    else if (name === 'br') html += '<br>';
    else if (name === 'tab') html += ' ';
  }

  if (!html) return '';

  const properties = run.getElementsByTagNameNS(W_NS, 'rPr')[0];
  if (properties) {
    // `<w:b w:val="false"/>` désactive le gras hérité du style : la présence de la balise ne
    // suffit pas, il faut vérifier qu'elle n'est pas une négation.
    const isOn = (tag: string) => {
      const el = properties.getElementsByTagNameNS(W_NS, tag)[0];
      if (!el) return false;
      const val = el.getAttributeNS(W_NS, 'val');
      return val !== 'false' && val !== '0';
    };
    if (isOn('i')) html = `<em>${html}</em>`;
    if (isOn('b')) html = `<strong>${html}</strong>`;
  }

  return html;
}

/** Contenu d'un paragraphe : ses runs, et les liens qui en enveloppent. */
function paragraphContent(
  paragraph: Element,
  links: Map<string, string>,
): { text: string; html: string } {
  let html = '';

  for (const node of Array.from(paragraph.childNodes)) {
    if (node.nodeType !== 1) continue;
    const element = node as Element;

    if (element.localName === 'r') {
      html += runToHtml(element);
      continue;
    }

    if (element.localName === 'hyperlink') {
      const inner = Array.from(element.getElementsByTagNameNS(W_NS, 'r'))
        .map(runToHtml)
        .join('');
      const target = links.get(element.getAttributeNS(R_NS, 'id') ?? '');
      // Lien externe uniquement : une ancre interne au document (`w:anchor`) ne mène nulle part
      // une fois le texte sorti du fichier.
      html += target
        ? `<a href="${escapeHtml(target)}" target="_blank" rel="noopener noreferrer">${inner}</a>`
        : inner;
    }
  }

  const text = (paragraph.textContent ?? '').replace(/\s+/g, ' ').trim();
  return { text, html };
}

/** Liens externes du document, par identifiant de relation. */
function readLinks(rels: Document | null): Map<string, string> {
  const links = new Map<string, string>();
  if (!rels) return links;

  for (const rel of Array.from(rels.getElementsByTagName('Relationship'))) {
    if (!rel.getAttribute('Type')?.endsWith('/hyperlink')) continue;
    const id = rel.getAttribute('Id');
    const target = rel.getAttribute('Target');
    if (id && target) links.set(id, target);
  }

  return links;
}

// --- API ------------------------------------------------------------------

/**
 * Lit un `.docx` et rend ses paragraphes.
 *
 * @throws {DocxReadError} si le fichier n'est pas une archive lisible, ou n'est pas un document
 * Word (pas de `word/document.xml`).
 */
export async function readDocx(file: Blob): Promise<DocxDocument> {
  const entries = await readZip(await file.arrayBuffer());

  const decoder = new TextDecoder();
  const parse = (name: string): Document | null => {
    const raw = entries.get(name);
    if (!raw) return null;
    const doc = new DOMParser().parseFromString(decoder.decode(raw), 'application/xml');
    return doc.getElementsByTagName('parsererror').length ? null : doc;
  };

  const document = parse('word/document.xml');
  if (!document) {
    throw new DocxReadError("Ce fichier n'est pas un document Word (.docx) lisible.");
  }

  const links = readLinks(parse('word/_rels/document.xml.rels'));
  const numbering = readNumbering(parse('word/numbering.xml'));

  const paragraphs: DocxParagraph[] = [];
  for (const p of Array.from(document.getElementsByTagNameNS(W_NS, 'p'))) {
    const { text, html } = paragraphContent(p, links);
    // Les paragraphes vides ne servent qu'à l'espacement dans Word : ils n'apportent rien ici,
    // et produiraient des `<p></p>` que le rendu afficherait comme des trous.
    if (!text) continue;

    const numId = p
      .getElementsByTagNameNS(W_NS, 'numPr')[0]
      ?.getElementsByTagNameNS(W_NS, 'numId')[0]
      ?.getAttributeNS(W_NS, 'val');

    paragraphs.push({
      heading: headingLevel(p),
      text,
      html,
      list: numId ? (numbering.get(numId) ?? 'ul') : null,
    });
  }

  const core = parse('docProps/core.xml');
  const coreValue = (tag: string): string | undefined =>
    Array.from(core?.getElementsByTagName('*') ?? [])
      .find((el) => el.localName === tag)
      ?.textContent?.trim() || undefined;

  return {
    paragraphs,
    core: { title: coreValue('title'), creator: coreValue('creator') },
    hasImages: [...entries.keys()].some((name) => name.startsWith('word/media/')),
  };
}
