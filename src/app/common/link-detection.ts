/**
 * Détection des URL laissées en texte brut dans un contenu HTML.
 *
 * Écrit pour tourner **aussi côté serveur** : le blog est rendu en SSR, et le DOM de Node (domino)
 * n'expose ni `DOMParser`, ni `TreeWalker`, ni les constantes globales `Node.*`. On se limite donc
 * à `createElement`, `createTextNode`, `childNodes` et `replaceChild`, et on parcourt l'arbre à la
 * main. Le `Document` est passé en paramètre plutôt que lu dans une variable globale, pour la
 * même raison.
 *
 * Corollaire utile : la linkification a lieu pendant le rendu serveur, donc les liens sont dans le
 * HTML que reçoivent les crawlers.
 */

const ELEMENT_NODE = 1;
const TEXT_NODE = 3;

/**
 * Candidat : un schéma explicite `http(s)://`, ou un domaine amorcé par `www.`.
 * On s'arrête aux espaces et aux caractères qui ne peuvent pas appartenir à une URL dans une
 * phrase (chevrons, guillemets).
 */
const CANDIDATE = /(?:https?:\/\/|www\.)[^\s<>"'«»]+/gi;

/** Ponctuation qui appartient à la phrase, pas à l'URL : « voir https://moze.fr. » */
const TRAILING = /[.,;:!?…]+$/;

/** Repère rapide, pour ne pas parcourir les nœuds de texte sans intérêt. */
const HINT = /https?:\/\/|www\./i;

/**
 * Éléments dont le texte ne doit pas être transformé : une ancre existante (on créerait un lien
 * dans un lien) et les blocs de code, où une URL est citée comme texte et non comme destination.
 */
const PROTECTED = new Set(['A', 'CODE', 'PRE']);

interface FoundUrl {
  readonly text: string;
  readonly href: string;
  readonly start: number;
  readonly end: number;
}

/**
 * Retire une parenthèse ou un crochet fermant orphelin.
 *
 * « (voir https://moze.fr/a) » : la parenthèse ferme la phrase, pas l'URL. Mais
 * « …/wiki/Vim_(logiciel) » en contient une qui lui appartient — d'où le comptage plutôt qu'un
 * retrait systématique.
 */
function trimUnbalanced(value: string): string {
  let out = value;
  for (const [open, close] of [['(', ')'], ['[', ']']] as const) {
    while (out.endsWith(close) && out.split(close).length > out.split(open).length) {
      out = out.slice(0, -1);
    }
  }
  return out;
}

/** Toutes les URL d'une chaîne de texte, dans l'ordre d'apparition. */
export function findUrls(text: string): FoundUrl[] {
  if (!HINT.test(text)) return [];

  const found: FoundUrl[] = [];

  for (const match of text.matchAll(CANDIDATE)) {
    const start = match.index ?? 0;
    const cleaned = trimUnbalanced(match[0].replace(TRAILING, ''));

    // Un « www. » isolé ou une URL réduite à son schéma ne mènent nulle part.
    if (!cleaned || /^(?:https?:\/\/|www\.)$/i.test(cleaned)) continue;

    const href = /^www\./i.test(cleaned) ? `https://${cleaned}` : cleaned;

    // Dernier filet : une URL que le navigateur lui-même refuse d'analyser n'a rien à faire
    // dans un `href`.
    try {
      new URL(href);
    } catch {
      continue;
    }

    found.push({ text: cleaned, href, start, end: start + cleaned.length });
  }

  return found;
}

/**
 * Deux adresses désignent-elles la même chose, à la présentation près ?
 *
 * Les éditeurs et les auteurs raccourcissent l'affichage — protocole masqué, `www.` omis, barre
 * oblique finale retirée — sans que la destination change pour autant. La comparaison sert à
 * décider si un libellé « est » son URL : la carte d'aperçu s'en sert pour retirer un doublon,
 * l'éditeur pour repérer un lien qui affiche une adresse et mène ailleurs.
 */
export function sameUrl(a: string, b: string): boolean {
  return canonicalUrl(a) === canonicalUrl(b);
}

function canonicalUrl(value: string): string {
  return value
    .trim()
    .replace(/^https?:\/\//i, '')
    .replace(/^www\./i, '')
    .replace(/\/+$/, '')
    .toLowerCase();
}

function isProtected(node: Node, root: Node): boolean {
  for (let current = node.parentNode; current && current !== root; current = current.parentNode) {
    if (current.nodeType === ELEMENT_NODE && PROTECTED.has((current as Element).tagName)) {
      return true;
    }
  }
  return false;
}

/** Remplace, dans un nœud de texte, chaque URL par une ancre. */
function linkifyTextNode(doc: Document, node: Node, root: Node): void {
  const data = node.nodeValue ?? '';
  const urls = findUrls(data);
  if (!urls.length) return;

  const fragment = doc.createDocumentFragment();
  let cursor = 0;

  for (const url of urls) {
    if (url.start > cursor) {
      fragment.appendChild(doc.createTextNode(data.slice(cursor, url.start)));
    }

    const anchor = doc.createElement('a');
    anchor.setAttribute('href', url.href);
    anchor.setAttribute('target', '_blank');
    // `noopener` coupe l'accès à `window.opener` depuis la page ouverte, qui pourrait sinon
    // rediriger l'onglet d'origine.
    anchor.setAttribute('rel', 'noopener noreferrer');
    // `textContent` et non `innerHTML` : le libellé reste du texte, quoi qu'il contienne.
    anchor.textContent = url.text;
    fragment.appendChild(anchor);

    cursor = url.end;
  }

  if (cursor < data.length) {
    fragment.appendChild(doc.createTextNode(data.slice(cursor)));
  }

  node.parentNode?.replaceChild(fragment, node);
}

/**
 * Parcours récursif. Les enfants sont figés dans un tableau avant traitement : remplacer un nœud
 * pendant qu'on itère sur la `NodeList` vivante ferait sauter des éléments.
 */
function walk(doc: Document, node: Node, root: Node): void {
  for (const child of Array.from(node.childNodes)) {
    if (child.nodeType === TEXT_NODE) {
      if (HINT.test(child.nodeValue ?? '') && !isProtected(child, root)) {
        linkifyTextNode(doc, child, root);
      }
      continue;
    }

    if (child.nodeType === ELEMENT_NODE) {
      if (PROTECTED.has((child as Element).tagName)) continue;
      walk(doc, child, root);
    }
  }
}

/**
 * HTML → même HTML, les URL restées en texte brut devenues cliquables.
 *
 * Les ancres posées par l'auteur dans l'éditeur sont laissées intactes, avec leur libellé.
 */
export function linkifyHtml(html: string, doc: Document): string {
  if (!html || !HINT.test(html)) return html;

  const host = doc.createElement('div');
  host.innerHTML = html;
  walk(doc, host, host);
  return host.innerHTML;
}

/** Collecte récursive des `href` externes, dans l'ordre du document. */
function gatherAnchors(node: Node, into: (href: string) => void): void {
  for (const child of Array.from(node.childNodes)) {
    if (child.nodeType !== ELEMENT_NODE) continue;

    const element = child as Element;

    // Une URL citée dans un bloc de code est du texte, pas une destination : `linkifyHtml` ne
    // l'a pas transformée, on ne la prévisualise pas non plus.
    if (element.tagName === 'CODE' || element.tagName === 'PRE') continue;

    if (element.tagName === 'A') {
      const href = element.getAttribute('href')?.trim();
      // Seuls les liens absolus http(s) : un `/blog/…` ou un `mailto:` n'a pas d'aperçu à montrer.
      if (href && /^https?:\/\//i.test(href)) into(href);
      // Pas de descente : une ancre ne peut pas en contenir une autre.
      continue;
    }

    gatherAnchors(element, into);
  }
}

/**
 * Les URL citées par un contenu, dédoublonnées, dans l'ordre d'apparition. C'est la liste que les
 * cartes d'aperçu consomment.
 *
 * **À appliquer au HTML déjà passé par `linkifyHtml`** : les URL laissées en texte brut y sont
 * devenues des ancres, il suffit donc de relever les `href` pour les voir toutes — celles que
 * l'auteur a posées lui-même comme celles qu'il a simplement collées.
 */
export function collectUrls(html: string, doc: Document): string[] {
  if (!html) return [];

  const host = doc.createElement('div');
  host.innerHTML = html;

  const seen = new Set<string>();
  gatherAnchors(host, (href) => seen.add(href));

  return Array.from(seen);
}
