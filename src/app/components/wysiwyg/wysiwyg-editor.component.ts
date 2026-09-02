import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  forwardRef,
  inject,
  signal,
  ViewChild,
} from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { findUrls, sameUrl } from '../../common/link-detection';
import {
  InternalLinkTarget,
  LinkDialogComponent,
  LinkDialogResult,
} from '../link-dialog/link-dialog.component';
import { PromptDialogComponent } from '../prompt-dialog/prompt-dialog.component';
import { BlogService } from '../../services/blog.service';
import { environment } from '../../../environements/environment';

/**
 * Les seuls alignements acceptés. Doit rester aligné sur trois autres endroits : la whitelist du
 * back (`common/sanitize.ts`, `allowedClasses`), les styles de l'article
 * (`article-view.component.scss`) et ceux de la zone d'édition.
 */
const ALIGNMENTS = new Set(['left', 'center', 'right', 'justify']);

/**
 * L'alignement d'un élément, quelle qu'en soit la forme : `style="text-align:…"` que produit
 * `execCommand`, attribut `align` des traitements de texte et vieux éditeurs, ou classe `ta-*`
 * d'un contenu déjà enregistré. Chaîne vide s'il n'en porte pas, ou une valeur inconnue.
 */
function alignmentOf(element: HTMLElement): string {
  const inline = (element.style.textAlign || element.getAttribute('align') || '').toLowerCase();
  if (ALIGNMENTS.has(inline)) return inline;

  for (const value of ALIGNMENTS) {
    if (element.classList.contains(`ta-${value}`)) return value;
  }

  return '';
}

/** Un lien dont le texte affiché annonce une adresse, et le `href` une autre. */
export interface MismatchedLink {
  /** L'adresse que le lecteur voit dans le texte. */
  readonly shown: string;
  /** La destination réelle du clic. */
  readonly target: string;
  /** Son hôte seul, pour un message court. */
  readonly targetHost: string;
}

/**
 * Éditeur WYSIWYG maison (sans librairie externe, cf. BLOG_DETAILLE §7).
 * `contentEditable` + barre d'outils, sortie = chaîne HTML.
 * S'intègre aux formulaires via `ControlValueAccessor` (formControlName).
 *
 * NB : l'insertion d'images/fichiers est volontairement désactivée pour l'instant ;
 * seuls les liens sont autorisés. `document.execCommand` est déprécié mais reste
 * fonctionnel sur les navigateurs actuels — choix assumé pour le MVP.
 */
@Component({
    selector: 'app-wysiwyg-editor',
    imports: [LinkDialogComponent, PromptDialogComponent],
    templateUrl: './wysiwyg-editor.component.html',
    styleUrl: './wysiwyg-editor.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
    providers: [
        {
            provide: NG_VALUE_ACCESSOR,
            useExisting: forwardRef(() => WysiwygEditorComponent),
            multi: true,
        },
    ]
})
export class WysiwygEditorComponent
  implements ControlValueAccessor, AfterViewInit
{
  @ViewChild('editor') private editorRef?: ElementRef<HTMLDivElement>;
  @ViewChild('body') private bodyRef?: ElementRef<HTMLDivElement>;
  @ViewChild('imageInput') private fileRef?: ElementRef<HTMLInputElement>;

  private readonly blog = inject(BlogService);

  readonly disabled = signal(false);

  /** Upload d'image en cours (désactive le bouton + affiche l'état). */
  readonly imageUploading = signal(false);
  /** Message d'erreur d'upload affiché sous la barre (null = rien). */
  readonly imageError = signal<string | null>(null);

  /** Surbrillance des boutons : formatage actif à l'emplacement du curseur. */
  readonly activeFormats = signal<{
    bold: boolean;
    italic: boolean;
    ul: boolean;
    ol: boolean;
    block: string;
    align: '' | 'left' | 'center' | 'right' | 'justify';
    // `justify` d'entrée : c'est l'alignement par défaut du site (cf. les règles `p, li,
    // blockquote` de la zone d'édition et d'article-view) — la barre doit le dire avant même
    // le premier clic, sinon l'auteur croit son texte aligné à gauche.
  }>({ bold: false, italic: false, ul: false, ol: false, block: '', align: 'justify' });

  private pendingValue = '';
  private onChange: (value: string) => void = () => {};
  onTouched: () => void = () => {};

  ngAfterViewInit(): void {
    if (this.editorRef) {
      this.editorRef.nativeElement.innerHTML = this.pendingValue;
      // Un article déjà enregistré peut porter le défaut : on le signale dès l'ouverture, sans
      // attendre que l'auteur touche au texte.
      this.refreshMismatchedLinks();
    }
    // Sans ça, `execCommand` produit des `<span style="font-weight:bold">` et la
    // zone éditable crée un `<div>` à chaque retour à la ligne : deux formes
    // absentes de la whitelist du back, donc perdues à l'enregistrement.
    try {
      document.execCommand('styleWithCSS', false, 'false');
      document.execCommand('defaultParagraphSeparator', false, 'p');
    } catch {
      /* non supporté → la normalisation de sortie sert de filet */
    }
  }

  // --- ControlValueAccessor ---
  writeValue(value: string): void {
    this.pendingValue = value ?? '';
    if (this.editorRef) {
      this.editorRef.nativeElement.innerHTML = this.pendingValue;
      this.refreshMismatchedLinks();
      // Le contenu vient d'être remplacé : le lien que la bulle visait n'existe plus.
      this.hideLinkBubble();
    }
  }
  registerOnChange(fn: (value: string) => void): void {
    this.onChange = fn;
  }
  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }
  setDisabledState(isDisabled: boolean): void {
    this.disabled.set(isDisabled);
  }

  // --- Édition ---
  onInput(): void {
    if (this.editorRef)
      this.onChange(this.toSemanticHtml(this.editorRef.nativeElement.innerHTML));
    this.refreshMismatchedLinks();
    // L'édition a pu détacher le lien que la bulle visait (mot supprimé, ligne refaite).
    if (this.bubbleAnchor && !this.bubbleAnchor.isConnected) this.hideLinkBubble();
  }

  /**
   * Autodétection de lien à la frappe : espace ou Entrée juste après une URL la transforme en
   * ancre, comme le font les éditeurs de mail ou Docs.
   *
   * Sur `keydown` et non `input` : le caractère séparateur n'est pas encore inséré, le texte
   * avant le curseur se termine donc par l'URL — pas besoin de la découper autour.
   */
  onEditorKeydown(event: KeyboardEvent): void {
    if (event.key === ' ' || event.key === 'Enter') this.autolinkBeforeCaret();
  }

  /**
   * Transforme en ancre l'URL qui précède immédiatement le curseur, s'il y en a une.
   *
   * Ne touche à rien dans une ancre existante (lien dans un lien) ni dans un bloc de code, où
   * une URL est citée comme texte — mêmes protections que `linkifyHtml` au rendu. La ponctuation
   * de fin de phrase entre l'URL et le curseur (« voir moze.fr. ») est tolérée : elle reste du
   * texte, seul le cœur devient un lien.
   */
  private autolinkBeforeCaret(): void {
    const root = this.editorRef?.nativeElement;
    const selection = window.getSelection();
    if (!root || !selection?.rangeCount || !selection.isCollapsed) return;

    const node = selection.anchorNode;
    const offset = selection.anchorOffset;
    if (!node || node.nodeType !== Node.TEXT_NODE || !root.contains(node)) return;
    if (node.parentElement?.closest('a, code, pre')) return;

    const typed = (node.nodeValue ?? '').slice(0, offset);
    const urls = findUrls(typed);
    const url = urls[urls.length - 1];
    if (!url) return;
    if (!/^[.,;:!?…)»\]]*$/.test(typed.slice(url.end))) return;

    const range = document.createRange();
    range.setStart(node, url.start);
    range.setEnd(node, url.end);

    const anchor = document.createElement('a');
    anchor.setAttribute('href', url.href);
    anchor.setAttribute('target', '_blank');
    anchor.setAttribute('rel', 'noopener noreferrer');
    anchor.textContent = url.text;

    range.deleteContents();
    range.insertNode(anchor);

    // Restaure le curseur là où il était : dans le texte qui suit l'ancre s'il y en a un
    // (la ponctuation conservée), sinon juste après elle.
    const caret = document.createRange();
    const rest = anchor.nextSibling;
    if (rest && rest.nodeType === Node.TEXT_NODE) {
      caret.setStart(rest, Math.min(offset - url.end, rest.nodeValue?.length ?? 0));
    } else {
      caret.setStartAfter(anchor);
    }
    caret.collapse(true);
    selection.removeAllRanges();
    selection.addRange(caret);

    this.onInput();
  }

  // --- Garde-fou : libellé ≠ destination ---

  /**
   * Liens dont le texte affiché est une adresse, différente de celle où mène le clic.
   *
   * Le cas se produit tout seul : on retape ou on colle une URL **à l'intérieur** d'un lien déjà
   * posé. Le libellé change, le `href` reste — `contentEditable` ne le réécrit pas, et le
   * nettoyage de sortie conserve l'attribut tel quel (cf. `cleanPastedHtml`). Rien ne le
   * signalait, ni à la frappe ni à l'enregistrement : l'article partait en ligne en annonçant une
   * adresse et en menant à une autre.
   */
  readonly mismatchedLinks = signal<MismatchedLink[]>([]);

  private refreshMismatchedLinks(): void {
    const root = this.editorRef?.nativeElement;
    if (!root) return;

    const found: MismatchedLink[] = [];

    for (const anchor of Array.from(root.querySelectorAll('a[href]'))) {
      const shown = this.shownUrl(anchor);
      const target = anchor.getAttribute('href')?.trim();
      if (!shown || !target || sameUrl(shown, target)) continue;

      found.push({ shown, target, targetHost: this.hostOf(target) });
    }

    this.mismatchedLinks.set(found);
  }

  /**
   * L'adresse qu'un lien affiche, à condition que son libellé ne soit **que** cela.
   *
   * `null` dès que l'auteur a écrit une phrase (« voir l'article ») : là, le texte et la
   * destination n'ont aucune raison de coïncider, et prévenir serait du bruit.
   */
  private shownUrl(anchor: Element): string | null {
    const label = anchor.textContent?.trim() ?? '';
    if (!label) return null;

    const urls = findUrls(label);
    return urls.length === 1 && urls[0].text === label ? urls[0].href : null;
  }

  private hostOf(url: string): string {
    try {
      return new URL(url).host.replace(/^www\./, '');
    } catch {
      return url;
    }
  }

  /**
   * Aligne la destination des liens signalés sur l'adresse qu'ils affichent.
   *
   * Le texte fait foi, pas le `href` : c'est lui que l'auteur vient d'écrire, et c'est lui que le
   * lecteur voit. L'inverse — corriger le texte — effacerait la saisie la plus récente.
   */
  alignMismatchedLinks(): void {
    const root = this.editorRef?.nativeElement;
    if (!root || this.disabled()) return;

    for (const anchor of Array.from(root.querySelectorAll('a[href]'))) {
      const shown = this.shownUrl(anchor);
      const target = anchor.getAttribute('href')?.trim();
      if (!shown || !target || sameUrl(shown, target)) continue;

      anchor.setAttribute('href', shown);
    }

    this.onInput();
  }

  /**
   * Traduit le HTML natif de `contentEditable` vers les balises sémantiques
   * acceptées par le back : `<b>`→`<strong>`, `<i>`→`<em>`, `<div>`→`<p>`.
   *
   * Indispensable : `execCommand` produit `<b>/<i>` et la zone éditable des
   * `<div>`, trois balises hors whitelist du back (cf. `sanitize.ts`). Comme
   * `sanitize-html` est en mode `discard`, il supprimait la balise en gardant le
   * texte → la mise en forme était silencieusement perdue à l'enregistrement.
   * On ne touche pas au DOM de l'éditeur (sélection préservée) : seule la valeur
   * émise au formulaire est normalisée.
   */
  private toSemanticHtml(html: string): string {
    const aConvertir = /<\/?(b|i|div)\b/i.test(html);
    // Tout attribut `style`, pas seulement un alignement : aucun n'a le droit de traverser — ni
    // la whitelist du back ni le sanitizer d'Angular n'en laissent passer. Autant les retirer
    // ici, pour que la valeur émise soit exactement celle qui sera enregistrée.
    const aNettoyer = /style=|align=/i.test(html);
    if (!aConvertir && !aNettoyer) return html; // rien à convertir → coût nul

    const RENAME: Record<string, string> = { B: 'strong', I: 'em', DIV: 'p' };
    const doc = new DOMParser().parseFromString(html, 'text/html');

    // 1. L'alignement passe de l'inline à une classe. `execCommand` écrit
    //    `style="text-align:…"`, or ni la whitelist du back ni le sanitizer d'Angular ne
    //    laissent passer un attribut `style` : le texte serait centré dans l'éditeur et à plat
    //    en ligne. La classe, elle, traverse les deux (cf. `article-view.component.scss`).
    doc.body.querySelectorAll<HTMLElement>('[style], [align]').forEach((el) => {
      const alignment = alignmentOf(el);
      el.removeAttribute('style');
      el.removeAttribute('align');
      el.removeAttribute('class');
      if (alignment) el.setAttribute('class', `ta-${alignment}`);
    });

    // 2. Balises natives de `contentEditable` → balises sémantiques.
    //    NodeList statique : sûr même si l'on remplace des éléments imbriqués.
    doc.body.querySelectorAll('b, i, div').forEach((el) => {
      const tag = RENAME[el.tagName];
      if (!tag) return;
      const replacement = doc.createElement(tag);
      // Le renommage crée un élément neuf, donc sans attributs : sans ce report, une ligne
      // centrée que la zone éditable a enfermée dans un `<div>` repartait à plat.
      const classe = el.getAttribute('class');
      if (classe) replacement.setAttribute('class', classe);
      while (el.firstChild) replacement.appendChild(el.firstChild);
      el.replaceWith(replacement);
    });

    return doc.body.innerHTML;
  }

  onBlur(): void {
    this.onTouched();
  }

  /**
   * Collage : conserve la mise en forme utile en nettoyant le HTML source à la
   * whitelist de l'éditeur (gras, italique, titres, listes, citations, liens) — le
   * reste (span, styles, couleurs, polices, MSO…) est retiré. Repli en texte brut
   * (+ décodage des entités) si la source n'a pas de HTML.
   */
  onPaste(event: ClipboardEvent): void {
    event.preventDefault();
    const html = event.clipboardData?.getData('text/html');
    const cleaned = html ? this.cleanPastedHtml(html) : '';
    if (cleaned) {
      document.execCommand('insertHTML', false, cleaned);
    } else {
      const raw = this.decodeEntities(event.clipboardData?.getData('text/plain') ?? '');
      const urlOnly = this.asSingleUrl(raw);
      if (urlOnly) {
        // Une URL collée seule devient un lien tout de suite — même résultat qu'à la frappe
        // (cf. autolinkBeforeCaret), sans attendre un espace qui ne viendra peut-être pas.
        const safeHref = this.escapeHtml(urlOnly.href);
        const safeText = this.escapeHtml(urlOnly.text);
        document.execCommand(
          'insertHTML',
          false,
          `<a href="${safeHref}" target="_blank" rel="noopener noreferrer">${safeText}</a>`,
        );
      } else {
        document.execCommand('insertText', false, raw);
      }
    }
    this.onInput();
  }

  /**
   * L'URL que ce texte *est* — pas celle qu'il contient. Un collage multi-lignes ou une phrase
   * autour de l'adresse gardent le comportement texte : la linkification au rendu s'en charge.
   */
  private asSingleUrl(raw: string): { href: string; text: string } | null {
    const trimmed = raw.trim();
    if (!trimmed) return null;

    const urls = findUrls(trimmed);
    const url = urls.length === 1 ? urls[0] : undefined;
    return url && url.start === 0 && url.text === trimmed
      ? { href: url.href, text: url.text }
      : null;
  }

  /**
   * Nettoie du HTML collé (Word, Google Docs, web) → ne garde que les balises
   * supportées (`h2 h3 p strong em ul ol li a blockquote br hr`). Le gras/italique
   * porté par `<b>/<i>` OU un style inline (`font-weight`/`font-style`) est converti
   * en `<strong>/<em>` pour survivre à la whitelist du back ; le conteneur
   * `<b style="font-weight:normal">` de Google Docs est correctement ignoré.
   * Parsing inerte (DOMParser) : aucun script exécuté, aucune ressource chargée.
   */
  private cleanPastedHtml(html: string): string {
    const SKIP = new Set(['STYLE', 'SCRIPT', 'HEAD', 'META', 'TITLE', 'LINK', 'NOSCRIPT']);
    const BLOCK: Record<string, string> = {
      H1: 'h2', H2: 'h2', H3: 'h3', H4: 'h3', H5: 'h3', H6: 'h3',
      P: 'p', DIV: 'p', UL: 'ul', OL: 'ol', LI: 'li', BLOCKQUOTE: 'blockquote',
    };

    const styleOf = (el: HTMLElement) => (el.getAttribute('style') || '').toLowerCase();
    const isBold = (el: HTMLElement): boolean => {
      const s = styleOf(el);
      if (/font-weight:\s*(normal|[1-4]00)/.test(s)) return false; // conteneur Docs
      return el.tagName === 'B' || el.tagName === 'STRONG' || /font-weight:\s*(bold|[5-9]00)/.test(s);
    };
    const isItalic = (el: HTMLElement): boolean => {
      const s = styleOf(el);
      if (/font-style:\s*normal/.test(s)) return false;
      return el.tagName === 'I' || el.tagName === 'EM' || /font-style:\s*italic/.test(s);
    };
    // Une classe `ta-*` ne peut venir que de la barre d'outils de cet éditeur : la retrouver au
    // collage, c'est retrouver un choix déjà fait par l'auteur — elle seule est conservée.
    const ownAlignment = (el: HTMLElement): string => {
      for (const value of ALIGNMENTS) {
        if (el.classList.contains(`ta-${value}`)) return value;
      }
      return '';
    };

    const walk = (node: Node): string => {
      let out = '';
      node.childNodes.forEach((child) => {
        if (child.nodeType === Node.TEXT_NODE) {
          out += this.escapeHtml(child.textContent ?? '');
          return;
        }
        if (child.nodeType !== Node.ELEMENT_NODE) return;
        const el = child as HTMLElement;
        const tag = el.tagName;
        if (SKIP.has(tag)) return;
        if (tag === 'BR') { out += '<br>'; return; }
        if (tag === 'HR') { out += '<hr>'; return; }

        if (tag === 'A') {
          const href = this.normalizeUrl((el.getAttribute('href') || '').trim());
          const inner = walk(el);
          out += href
            ? `<a href="${this.escapeHtml(href)}" target="_blank" rel="noopener noreferrer">${inner}</a>`
            : inner;
          return;
        }

        let inner = walk(el);
        if (isItalic(el)) inner = `<em>${inner}</em>`;
        if (isBold(el)) inner = `<strong>${inner}</strong>`;

        const block = BLOCK[tag];
        if (!block) {
          out += inner;
          return;
        }

        // L'alignement du document source (style Word/Docs, attribut `align`) n'est PAS repris :
        // le corps d'article est justifié par défaut, et seul un alignement choisi par l'auteur
        // dans la barre doit y déroger. Un texte collé arrive donc « neutre » — sauf s'il porte
        // déjà une classe `ta-*`, trace d'un choix fait dans cet éditeur.
        const alignment = ownAlignment(el);
        out += alignment
          ? `<${block} class="ta-${alignment}">${inner}</${block}>`
          : `<${block}>${inner}</${block}>`;
      });
      return out;
    };

    return walk(new DOMParser().parseFromString(html, 'text/html').body).trim();
  }

  /** Décode les entités HTML d'une chaîne via un textarea détaché (sans risque XSS). */
  private decodeEntities(text: string): string {
    if (!text.includes('&')) return text; // rien à décoder → coût nul
    const ta = document.createElement('textarea');
    ta.innerHTML = text;
    return ta.value;
  }

  exec(command: string, value?: string): void {
    if (this.disabled()) return;
    document.execCommand(command, false, value);
    this.editorRef?.nativeElement.focus();
    this.onInput();
    this.refreshActiveFormats();
  }

  formatBlock(tag: string): void {
    this.exec('formatBlock', tag);
  }

  /**
   * Aligne le bloc courant.
   *
   * `styleWithCSS` est basculé le temps de la commande : à `false` — le réglage général, qui fait
   * produire `<b>`/`<i>` plutôt que des `<span style>` — `justifyCenter` pose l'attribut
   * historique `align="center"`, que la whitelist du back retire. L'alignement aurait disparu à
   * l'enregistrement sans que rien ne le signale. À `true`, la commande écrit
   * `style="text-align: center"`, seule forme que le back accepte (cf. `common/sanitize.ts`).
   *
   * Le réglage est remis à `false` aussitôt : le laisser à `true` ferait dériver le gras et
   * l'italique vers des `<span>` stylés, hors whitelist eux aussi.
   */
  align(direction: 'Left' | 'Center' | 'Right' | 'Full'): void {
    if (this.disabled()) return;

    try {
      document.execCommand('styleWithCSS', false, 'true');
      this.exec(`justify${direction}`);
    } finally {
      try {
        document.execCommand('styleWithCSS', false, 'false');
      } catch {
        /* non supporté → la normalisation de sortie sert de filet */
      }
    }
  }

  /** Recalcule la surbrillance des boutons (frappe / déplacement du curseur). */
  onSelectionChange(): void {
    this.refreshActiveFormats();
  }

  private refreshActiveFormats(): void {
    try {
      const block = (document.queryCommandValue('formatBlock') || '').toLowerCase();
      // Les titres sont gras par défaut → queryCommandState('bold') y renvoie true.
      // On masque l'état « Gras » dans un titre pour ne pas induire en erreur.
      const inHeading = block === 'h2' || block === 'h3';
      this.activeFormats.set({
        bold: document.queryCommandState('bold') && !inHeading,
        italic: document.queryCommandState('italic'),
        ul: document.queryCommandState('insertUnorderedList'),
        ol: document.queryCommandState('insertOrderedList'),
        block,
        align: this.activeAlignment(),
      });
    } catch {
      /* queryCommand* indisponible (ex. SSR) → on ignore */
    }
  }

  /**
   * Alignement du bloc sous le curseur.
   *
   * Les alignements explicites sont testés avant la gauche : le navigateur répond `true` à
   * `justifyLeft` pour un texte simplement laissé au fil de l'eau, et le bouton « gauche »
   * resterait allumé sur un paragraphe centré.
   *
   * Quand le navigateur ne se prononce pas (éditeur vide, curseur hors de tout bloc), c'est le
   * défaut du site qui fait foi : justifié — un paragraphe sans classe `ta-*` sera rendu ainsi.
   */
  private activeAlignment(): '' | 'left' | 'center' | 'right' | 'justify' {
    if (document.queryCommandState('justifyCenter')) return 'center';
    if (document.queryCommandState('justifyRight')) return 'right';
    if (document.queryCommandState('justifyFull')) return 'justify';
    return document.queryCommandState('justifyLeft') ? 'left' : 'justify';
  }

  /**
   * Cibles du sélecteur de lien interne : pages fixes + articles publiés.
   * Chargées à la première ouverture de la modale seulement — la liste des
   * articles ne bouge pas pendant une session de rédaction, un appel suffit.
   * URLs absolues sur l'origine canonique : la rédaction n'a ni adresse à
   * taper, ni version www à deviner.
   */
  readonly internalTargets = signal<InternalLinkTarget[]>([]);
  private internalTargetsLoaded = false;

  private loadInternalTargets(): void {
    if (this.internalTargetsLoaded) return;
    this.internalTargetsLoaded = true;

    const site = environment.siteUrl;
    const pages: InternalLinkTarget[] = [
      { group: 'Pages', label: 'Accueil', url: `${site}/` },
      { group: 'Pages', label: 'Commencer (inscription)', url: `${site}/commencer` },
      { group: 'Pages', label: 'Blog', url: `${site}/blog` },
    ];
    this.internalTargets.set(pages);

    // Liste PUBLIQUE : seuls les articles publiés sont proposés — un lien vers
    // un brouillon serait un 404 en ligne. 50 = plafond de l'API.
    this.blog.list(1, 50).subscribe({
      next: (page) =>
        this.internalTargets.set([
          ...pages,
          ...page.items.map((a) => ({
            group: 'Articles' as const,
            label: a.title,
            url: `${site}/blog/${a.slug}`,
          })),
        ]),
      error: () => {
        /* la saisie manuelle reste possible, le sélecteur montre au moins les pages */
      },
    });
  }

  /** État de la modale de lien + sélection mémorisée à l'ouverture. */
  readonly linkDialogOpen = signal(false);
  readonly linkDialogTitle = signal('Insérer un lien');
  readonly linkDialogUrl = signal('');
  readonly linkDialogLabel = signal('');
  private savedLinkRange: Range | null = null;
  private linkHadSelection = false;
  /** Lien existant en cours d'édition (bulle de survol, ou curseur posé dedans). Sinon `null`. */
  private editingLink: HTMLAnchorElement | null = null;

  /**
   * Bouton « Insérer un lien » de la barre. Curseur dans un lien existant : on l'édite plutôt
   * que d'en créer un second au même endroit. Sinon, insertion — la sélection courante est
   * mémorisée et proposée comme texte affiché.
   */
  addLink(): void {
    if (this.disabled()) return;

    const selection = window.getSelection();
    const inside = this.anchorAtCaret(selection);
    if (inside) {
      this.openLinkEditor(inside);
      return;
    }

    this.editingLink = null;
    this.savedLinkRange =
      selection && selection.rangeCount ? selection.getRangeAt(0).cloneRange() : null;
    this.linkHadSelection =
      !!this.savedLinkRange && this.savedLinkRange.toString().trim().length > 0;
    this.linkDialogTitle.set('Insérer un lien');
    this.linkDialogUrl.set('');
    this.linkDialogLabel.set(this.savedLinkRange?.toString().trim() ?? '');
    this.loadInternalTargets();
    this.linkDialogOpen.set(true);
  }

  /** Ouvre la modale sur un lien existant, adresse et texte affiché pré-remplis. */
  openLinkEditor(anchor: HTMLAnchorElement): void {
    if (this.disabled()) return;
    this.hideLinkBubble();
    this.editingLink = anchor;
    this.savedLinkRange = null;
    this.linkHadSelection = false;
    this.linkDialogTitle.set('Modifier le lien');
    this.linkDialogUrl.set(anchor.getAttribute('href') ?? '');
    this.linkDialogLabel.set(anchor.textContent?.trim() ?? '');
    this.loadInternalTargets();
    this.linkDialogOpen.set(true);
  }

  /** L'ancre qui contient le curseur (ou le début de la sélection), s'il y en a une. */
  private anchorAtCaret(selection: Selection | null): HTMLAnchorElement | null {
    const root = this.editorRef?.nativeElement;
    const node = selection?.anchorNode;
    if (!root || !node || !root.contains(node)) return null;

    const element = node.nodeType === Node.ELEMENT_NODE ? (node as Element) : node.parentElement;
    const anchor = element?.closest('a[href]');
    return anchor && root.contains(anchor) ? (anchor as HTMLAnchorElement) : null;
  }

  onLinkCancel(): void {
    this.linkDialogOpen.set(false);
    this.savedLinkRange = null;
    this.editingLink = null;
  }

  /**
   * Applique la saisie de la modale de lien.
   *  - Normalise l'URL : préfixe `https://` si aucun schéma (sinon lien relatif
   *    cassé une fois enregistré), `mailto:` si ça ressemble à un e-mail.
   *  - Édition d'un lien existant : `href` et texte affiché mis à jour en place.
   *  - Insertion avec sélection : l'enveloppe en conservant son formatage tant que l'alias n'en
   *    diverge pas ; un alias différent remplace la sélection.
   *  - Insertion sans sélection : l'alias (ou l'URL à défaut) devient le texte cliquable.
   *  - Ouvre dans un nouvel onglet (`target="_blank"` ; le back reforce le `rel`).
   */
  onLinkConfirm({ url: rawUrl, label: rawLabel }: LinkDialogResult): void {
    this.linkDialogOpen.set(false);
    const editing = this.editingLink;
    const savedRange = this.savedLinkRange;
    const hadSelection = this.linkHadSelection;
    this.editingLink = null;
    this.savedLinkRange = null;

    const url = this.normalizeUrl(rawUrl.trim());
    if (!url) return;
    const label = rawLabel.trim();

    if (editing) {
      editing.setAttribute('href', url);
      editing.setAttribute('target', '_blank');
      editing.setAttribute('rel', 'noopener noreferrer');
      const next = label || url;
      // `textContent` réécrit efface la mise en forme interne du libellé — acceptable : l'auteur
      // vient précisément de saisir un nouveau texte.
      if (next !== (editing.textContent?.trim() ?? '')) editing.textContent = next;
      this.onInput();
      return;
    }

    const selection = this.restoreSelection(savedRange);
    const selectedText = savedRange?.toString().trim() ?? '';

    if (hadSelection && (!label || label === selectedText)) {
      document.execCommand('createLink', false, url);
      // createLink ne pose pas `target` → on l'ajoute sur le lien fraîchement créé.
      const anchor = selection?.anchorNode?.parentElement?.closest('a');
      anchor?.setAttribute('target', '_blank');
      anchor?.setAttribute('rel', 'noopener noreferrer');
    } else {
      const text = this.escapeHtml(label || url);
      document.execCommand(
        'insertHTML',
        false,
        `<a href="${this.escapeHtml(url)}" target="_blank" rel="noopener noreferrer">${text}</a>`,
      );
    }

    this.onInput();
  }

  /** Retire le lien à l'emplacement du curseur (ou de la sélection). */
  removeLink(): void {
    this.exec('unlink');
  }

  // --- Bulle d'actions au survol d'un lien ---

  /** Lien survolé : adresse + position de la bulle, relative à la zone d'édition. `null` = cachée. */
  readonly linkBubble = signal<{ href: string; top: number; left: number } | null>(null);
  /** Retour visuel éphémère après « Copier ». */
  readonly linkCopied = signal(false);
  private bubbleAnchor: HTMLAnchorElement | null = null;
  private copiedTimer: ReturnType<typeof setTimeout> | null = null;
  private hideTimer: ReturnType<typeof setTimeout> | null = null;

  /**
   * Suivi du survol sur l'enveloppe (zone éditable + bulle) et non sur les ancres une à une :
   * `mouseover` remonte, un seul écouteur suffit.
   *
   * La fermeture n'est jamais immédiate : le trajet de la souris entre le lien et la bulle
   * traverse du texte « neutre », et fermer à ce moment-là rendrait les actions incliquables.
   * Elle est programmée (cf. `scheduleHideBubble`) et annulée dès que la souris atteint la bulle
   * ou revient sur un lien.
   */
  onBodyMouseOver(event: MouseEvent): void {
    const target = event.target as Element | null;
    if (!target) return;

    if (target.closest('.wys-linkpop')) {
      this.cancelScheduledHide();
      return;
    }

    const root = this.editorRef?.nativeElement;
    const anchor = target.closest('a[href]');
    if (root && anchor && root.contains(anchor)) {
      this.cancelScheduledHide();
      this.showLinkBubble(anchor as HTMLAnchorElement);
    } else {
      this.scheduleHideBubble();
    }
  }

  onBodyMouseLeave(): void {
    this.scheduleHideBubble();
  }

  /** Ferme la bulle dans 300 ms — le temps pour la souris d'atteindre les actions. */
  private scheduleHideBubble(): void {
    if (!this.linkBubble()) return;
    this.cancelScheduledHide();
    this.hideTimer = setTimeout(() => this.hideLinkBubble(), 300);
  }

  private cancelScheduledHide(): void {
    if (this.hideTimer) {
      clearTimeout(this.hideTimer);
      this.hideTimer = null;
    }
  }

  private showLinkBubble(anchor: HTMLAnchorElement): void {
    if (this.bubbleAnchor === anchor) return;
    const host = this.bodyRef?.nativeElement;
    if (!host) return;

    const hostRect = host.getBoundingClientRect();
    const rect = anchor.getBoundingClientRect();
    this.bubbleAnchor = anchor;
    this.linkCopied.set(false);
    this.linkBubble.set({
      href: anchor.getAttribute('href') ?? '',
      top: rect.bottom - hostRect.top + 6,
      left: Math.max(0, rect.left - hostRect.left),
    });
  }

  hideLinkBubble(): void {
    this.cancelScheduledHide();
    this.bubbleAnchor = null;
    this.linkBubble.set(null);
  }

  /** « Voir le lien » : ouvre la destination dans un nouvel onglet. */
  openHoveredLink(): void {
    const href = this.linkBubble()?.href;
    if (href) window.open(href, '_blank', 'noopener');
  }

  /** « Insérer un lien » : ouvre la modale sur le lien survolé — l'alias y est modifiable. */
  editHoveredLink(): void {
    if (this.bubbleAnchor) this.openLinkEditor(this.bubbleAnchor);
  }

  /** « Copier » : copie l'adresse du lien, avec un accusé bref dans la bulle. */
  copyHoveredLink(): void {
    const href = this.linkBubble()?.href;
    if (!href || !navigator.clipboard) return;

    navigator.clipboard
      .writeText(href)
      .then(() => {
        this.linkCopied.set(true);
        if (this.copiedTimer) clearTimeout(this.copiedTimer);
        this.copiedTimer = setTimeout(() => this.linkCopied.set(false), 1500);
      })
      .catch(() => {
        /* presse-papiers refusé (permissions) → pas d'accusé, rien à casser */
      });
  }

  /**
   * Redonne le focus à la zone éditable et y restaure la sélection mémorisée.
   * Nécessaire après tout détour par une modale ou le sélecteur de fichier :
   * le focus est parti ailleurs, et `execCommand` opère sur la sélection courante.
   */
  private restoreSelection(range: Range | null): Selection | null {
    this.editorRef?.nativeElement.focus();
    const selection = window.getSelection();
    if (range && selection) {
      selection.removeAllRanges();
      selection.addRange(range);
    }
    return selection;
  }

  // --- Image ---

  /** État de la modale de texte alternatif + image téléversée en attente. */
  readonly imageDialogOpen = signal(false);
  readonly imageAltDefault = signal('');
  private pendingImageUrl: string | null = null;
  private savedImageRange: Range | null = null;

  /**
   * Ouvre le sélecteur de fichier. La position du curseur est mémorisée ici :
   * la boîte de dialogue système fait perdre le focus à la zone éditable.
   */
  pickImage(): void {
    if (this.disabled() || this.imageUploading()) return;
    const selection = window.getSelection();
    this.savedImageRange =
      selection && selection.rangeCount ? selection.getRangeAt(0).cloneRange() : null;
    this.imageError.set(null);
    this.fileRef?.nativeElement.click();
  }

  /** Téléverse le fichier choisi, puis demande le texte alternatif. */
  onImageSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = ''; // autorise la re-sélection du même fichier
    if (!file) return;

    this.imageUploading.set(true);
    this.blog.upload(file).subscribe({
      next: ({ url }) => {
        this.imageUploading.set(false);
        this.pendingImageUrl = url;
        // Nom du fichier sans extension : point de départ raisonnable pour l'alt.
        this.imageAltDefault.set(file.name.replace(/\.[^.]+$/, ''));
        this.imageDialogOpen.set(true);
      },
      error: () => {
        this.imageUploading.set(false);
        this.imageError.set("L'envoi de l'image a échoué. Réessayez.");
      },
    });
  }

  /**
   * Insère l'image téléversée avec son texte alternatif.
   * `loading="lazy"` : évite de pénaliser le LCP des articles illustrés.
   */
  onImageAltConfirm(alt: string): void {
    this.imageDialogOpen.set(false);
    const url = this.pendingImageUrl;
    this.pendingImageUrl = null;
    if (!url) return;

    this.restoreSelection(this.savedImageRange);
    this.savedImageRange = null;
    document.execCommand(
      'insertHTML',
      false,
      `<img src="${this.escapeHtml(url)}" alt="${this.escapeHtml(alt)}" loading="lazy">`,
    );
    this.onInput();
  }

  /** Abandon : l'image reste sur le serveur mais n'est pas insérée. */
  onImageAltCancel(): void {
    this.imageDialogOpen.set(false);
    this.pendingImageUrl = null;
    this.savedImageRange = null;
  }

  /** Ajoute un schéma si l'utilisateur n'en met pas (évite un href relatif cassé). */
  private normalizeUrl(url: string): string {
    if (!url) return '';
    if (/^(https?:\/\/|mailto:|tel:|\/\/)/i.test(url)) return url;
    if (/^[^\s@/]+@[^\s@/]+\.[^\s@/]+$/.test(url)) return `mailto:${url}`;
    return `https://${url}`;
  }

  /** Échappe le HTML avant une insertion via `insertHTML`. */
  private escapeHtml(value: string): string {
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
}
