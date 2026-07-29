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
import { PromptDialogComponent } from '../prompt-dialog/prompt-dialog.component';
import { BlogService } from '../../services/blog.service';

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
    imports: [PromptDialogComponent],
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
  }>({ bold: false, italic: false, ul: false, ol: false, block: '', align: '' });

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
      const raw = event.clipboardData?.getData('text/plain') ?? '';
      document.execCommand('insertText', false, this.decodeEntities(raw));
    }
    this.onInput();
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

        // L'alignement est la seule mise en forme de bloc reprise du collage : un texte centré
        // dans Word ou Docs le reste. Tout le reste du style est écarté, comme avant. Classe et
        // non `style`, pour la même raison qu'à la normalisation de sortie.
        const alignment = alignmentOf(el);
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
   */
  private activeAlignment(): '' | 'left' | 'center' | 'right' | 'justify' {
    if (document.queryCommandState('justifyCenter')) return 'center';
    if (document.queryCommandState('justifyRight')) return 'right';
    if (document.queryCommandState('justifyFull')) return 'justify';
    return document.queryCommandState('justifyLeft') ? 'left' : '';
  }

  /** État de la modale d'insertion de lien + sélection mémorisée à l'ouverture. */
  readonly linkDialogOpen = signal(false);
  private savedLinkRange: Range | null = null;
  private linkHadSelection = false;

  /** Ouvre la modale d'insertion de lien en mémorisant la sélection courante. */
  addLink(): void {
    if (this.disabled()) return;
    const selection = window.getSelection();
    this.savedLinkRange =
      selection && selection.rangeCount ? selection.getRangeAt(0).cloneRange() : null;
    this.linkHadSelection =
      !!this.savedLinkRange && this.savedLinkRange.toString().trim().length > 0;
    this.linkDialogOpen.set(true);
  }

  onLinkCancel(): void {
    this.linkDialogOpen.set(false);
    this.savedLinkRange = null;
  }

  /**
   * Insère le lien saisi dans la modale.
   *  - Normalise l'URL : préfixe `https://` si aucun schéma (sinon lien relatif
   *    cassé une fois enregistré), `mailto:` si ça ressemble à un e-mail.
   *  - Restaure la sélection d'origine (le focus était parti dans la modale).
   *  - Avec sélection : l'enveloppe en conservant son formatage. Sans : insère
   *    l'URL comme texte cliquable.
   *  - Ouvre dans un nouvel onglet (`target="_blank"` ; le back reforce le `rel`).
   */
  onLinkConfirm(rawUrl: string): void {
    this.linkDialogOpen.set(false);
    const savedRange = this.savedLinkRange;
    const hadSelection = this.linkHadSelection;
    this.savedLinkRange = null;

    const url = this.normalizeUrl(rawUrl.trim());
    if (!url) return;

    const selection = this.restoreSelection(savedRange);

    if (hadSelection) {
      document.execCommand('createLink', false, url);
      // createLink ne pose pas `target` → on l'ajoute sur le lien fraîchement créé.
      const anchor = selection?.anchorNode?.parentElement?.closest('a');
      anchor?.setAttribute('target', '_blank');
      anchor?.setAttribute('rel', 'noopener noreferrer');
    } else {
      const safe = this.escapeHtml(url);
      document.execCommand(
        'insertHTML',
        false,
        `<a href="${safe}" target="_blank" rel="noopener noreferrer">${safe}</a>`,
      );
    }

    this.onInput();
  }

  /** Retire le lien à l'emplacement du curseur (ou de la sélection). */
  removeLink(): void {
    this.exec('unlink');
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
