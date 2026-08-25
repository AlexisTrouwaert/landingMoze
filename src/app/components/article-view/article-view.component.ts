import { DatePipe, DOCUMENT, NgTemplateOutlet } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { environment } from '../../../environements/environment';
import { collectUrls, linkifyHtml, sameUrl } from '../../common/link-detection';
import { Article } from '../../model/article.model';
import { LinkPreviewComponent } from '../link-preview/link-preview.component';

/**
 * Un segment d'article : soit du texte, soit la carte d'aperçu d'un lien. Le gabarit les rend
 * dans l'ordre, ce qui place chaque carte au niveau du lien qu'elle illustre.
 */
export type ContentBlock =
  | { kind: 'html'; html: string }
  | { kind: 'preview'; url: string };

/** État partagé le long du découpage, qui descend dans les éléments imbriqués. */
interface SegmentContext {
  /** Liens autorisés à recevoir une carte. */
  readonly eligible: ReadonlySet<string>;
  /** Liens déjà posés, pour ne pas les répéter en fin d'article. */
  readonly placed: Set<string>;
  /** Liens dont la carte aboutit, seuls à voir leur ancre retirée du texte. */
  readonly shown: ReadonlySet<string>;
}

/**
 * `Node.ELEMENT_NODE` en dur : l'article est rendu côté serveur, où le DOM de Node n'expose pas
 * la constante globale `Node` (même raison que dans `common/link-detection.ts`).
 */
const ELEMENT_NODE = 1;

/** Hôte du site, pour écarter les liens internes. `environment` est figé, un calcul suffit. */
const SITE_HOST = (() => {
  try {
    return new URL(environment.siteUrl).host;
  } catch {
    return '';
  }
})();

/**
 * Rendu complet d'un article (page publique + aperçu admin).
 * `back` (défaut true) affiche le lien « Tous les articles » — masqué en aperçu.
 */
@Component({
  selector: 'app-article-view',
  imports: [DatePipe, RouterLink, NgTemplateOutlet, LinkPreviewComponent],
  templateUrl: './article-view.component.html',
  styleUrl: './article-view.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ArticleViewComponent {
  private readonly document = inject(DOCUMENT);

  readonly article = input.required<Article>();
  readonly back = input(true);

  /**
   * Vrai quand la dernière modification est postérieure au **jour** de publication.
   * Comparaison au jour près : publier bouge aussi `updatedAt` de quelques
   * secondes, et « mis à jour le » le jour même de la publication serait du bruit.
   */
  readonly updatedLater = computed(() => {
    const a = this.article();
    if (!a.publishedAt || !a.updatedAt) return false;
    return a.updatedAt.slice(0, 10) > a.publishedAt.slice(0, 10);
  });

  /**
   * Corps de l'article, URL tapées en texte brut converties en liens cliquables.
   *
   * L'éditeur ne transforme que les liens saisis via son outil dédié : une adresse simplement
   * collée dans le texte restait inerte. Les ancres déjà posées par l'auteur ne sont pas touchées.
   *
   * `DOCUMENT` injecté plutôt que la variable globale : l'article est rendu côté serveur, où
   * `document` n'existe pas — et c'est justement ce qui fait que les liens se retrouvent dans le
   * HTML servi aux moteurs de recherche.
   */
  private readonly content = computed(() =>
    linkifyHtml(this.article().content ?? '', this.document),
  );

  /** Liens à prévisualiser, dans leur ordre d'apparition, dédoublonnés. */
  private readonly previewUrls = computed(() => this.pickPreviewUrls(this.content()));

  /**
   * Les URL dont la carte est effectivement affichée.
   *
   * Un ensemble et non un booléen : chaque carte règle son sort indépendamment (un lien peut
   * rester muet, un autre s'afficher normalement), et seule celle qui aboutit autorise le retrait
   * de son lien du texte.
   */
  private readonly shownPreviews = signal<ReadonlySet<string>>(new Set());

  /**
   * L'article découpé en segments : des morceaux de texte, et les cartes d'aperçu intercalées
   * **juste après le bloc qui cite le lien**.
   *
   * C'est ce qui permet d'afficher plusieurs aperçus sans que le lecteur ait à deviner lequel
   * correspond à quoi. La carte n'est pas insérée au caractère près — une URL au milieu d'une
   * phrase la couperait en deux — mais après le bloc de premier niveau qui la porte, comme le
   * font Slack ou LinkedIn.
   */
  readonly blocks = computed(() =>
    this.buildBlocks(this.content(), this.previewUrls(), this.shownPreviews()),
  );

  /**
   * Le sort d'une carte vient d'être tranché. Seules celles qui s'affichent effacent leur lien du
   * texte : sinon il disparaîtrait sans rien à la place.
   *
   * Rien à faire côté serveur — les aperçus n'y sont pas résolus, l'ensemble reste vide et le
   * découpage est donc identique à celui que produira l'hydratation.
   */
  onPreviewResolved(url: string, shown: boolean): void {
    const current = this.shownPreviews();
    if (current.has(url) === shown) return;

    const next = new Set(current);
    if (shown) next.add(url);
    else next.delete(url);

    this.shownPreviews.set(next);
  }

  /**
   * Liens externes cités par l'article, ancres de l'auteur comme URL tapées en texte brut.
   *
   * Contrairement aux publications de l'application, la présence d'une image de couverture
   * n'empêche pas les aperçus : la couverture illustre l'article entier, la carte illustre un
   * lien précis au fil du texte — les deux ne se font pas concurrence.
   */
  private pickPreviewUrls(html: string): string[] {
    if (!html) return [];

    const picked: string[] = [];

    for (const url of collectUrls(html, this.document)) {
      if (this.isInternal(url)) continue;

      picked.push(url);
    }

    return picked;
  }

  /**
   * Un lien vers le site lui-même n'est pas une source externe à prévisualiser : le lecteur y est
   * déjà.
   *
   * `environment.siteUrl` et non `window.location` : le rendu serveur n'a pas de `window`, or les
   * deux côtés doivent découper l'article exactement de la même façon — sans quoi l'hydratation
   * trouverait un DOM différent de celui qu'elle a reçu.
   */
  private isInternal(url: string): boolean {
    try {
      return new URL(url).host === SITE_HOST;
    } catch {
      // URL que le navigateur lui-même refuse d'analyser : rien de bon à en tirer.
      return true;
    }
  }

  /**
   * Découpe le contenu en segments, en plaçant chaque carte après le bloc de premier niveau qui
   * cite son lien.
   *
   * L'ordre des opérations compte : on relève d'abord quels aperçus chaque bloc porte, **puis**
   * on retire les ancres remplacées. L'inverse perdrait la trace du lien au moment de décider où
   * poser sa carte.
   */
  private buildBlocks(
    html: string,
    previewUrls: readonly string[],
    shown: ReadonlySet<string>,
  ): ContentBlock[] {
    if (!html) return [];

    const container = this.document.createElement('div');
    container.innerHTML = html;

    const context: SegmentContext = {
      eligible: new Set(previewUrls),
      placed: new Set<string>(),
      shown,
    };

    const blocks = this.segment(Array.from(container.childNodes), context);

    // Un aperçu dont l'ancre n'a pas été retrouvée (contenu inattendu) ferme la marche plutôt que
    // de disparaître.
    for (const url of context.eligible) {
      if (context.placed.has(url)) continue;
      blocks.push({ kind: 'preview', url });
    }

    return blocks;
  }

  /**
   * Découpe une liste de nœuds frères, en posant chaque carte après le nœud qui cite son lien.
   *
   * Descend dans un élément qui *englobe* des liens sans en être un, dès lors qu'il contient
   * plusieurs lignes : sans cela, un contenu collé d'un seul tenant — que l'éditeur enferme alors
   * dans un unique `<div>` — ne formerait qu'un bloc, et toutes ses cartes s'empileraient à la
   * fin au lieu de suivre leur lien.
   *
   * La descente s'arrête aux éléments purement en ligne (un paragraphe de texte courant) : y
   * insérer une carte couperait la phrase en deux.
   */
  private segment(nodes: Node[], context: SegmentContext): ContentBlock[] {
    const blocks: ContentBlock[] = [];
    let buffer = '';

    const flushText = () => {
      if (buffer.trim()) blocks.push({ kind: 'html', html: buffer });
      buffer = '';
    };

    for (const node of nodes) {
      const here = this.previewUrlsIn(node, context.eligible);

      if (node.nodeType !== ELEMENT_NODE) {
        buffer += this.escape(node.textContent ?? '');
        continue;
      }

      const element = node as Element;

      if (here.length && !this.isAnchor(element) && this.spansSeveralLines(element)) {
        flushText();
        for (const inner of this.segment(Array.from(element.childNodes), context)) {
          blocks.push(
            inner.kind === 'html'
              ? { kind: 'html', html: this.wrapLike(element, inner.html) }
              : inner,
          );
        }
        continue;
      }

      this.stripAnchors(element, context.shown);
      // `stripAnchors` a pu retirer l'élément lui-même, quand le nœud *est* l'ancre remplacée par
      // sa carte. Détaché, il ne doit pas être réinjecté : son `textContent` reste pourtant
      // renseigné, d'où le test sur le parent et non sur le seul contenu.
      if (element.parentNode && this.keepsContent(element)) {
        buffer += element.outerHTML;
      }

      if (!here.length) continue;

      flushText();
      for (const url of here) {
        blocks.push({ kind: 'preview', url });
        context.placed.add(url);
      }
    }

    flushText();

    return blocks;
  }

  /**
   * Réencode un texte avant de l'ajouter au tampon HTML : `textContent` le rend décodé, et une
   * esperluette laissée telle quelle serait relue comme le début d'une entité.
   */
  private escape(value: string): string {
    const holder = this.document.createElement('span');
    holder.textContent = value;
    return holder.innerHTML;
  }

  private isAnchor(element: Element): boolean {
    return element.tagName === 'A' && element.hasAttribute('href');
  }

  /** Vrai si l'élément porte plusieurs lignes : une carte peut s'y glisser sans couper de phrase. */
  private spansSeveralLines(element: Element): boolean {
    return !!element.querySelector('br, p, div, li, blockquote, h1, h2, h3, h4, h5, h6');
  }

  /**
   * Réenveloppe un tronçon dans une copie sans enfants de l'élément d'origine : la balise et ses
   * attributs (donc le style) sont conservés, seul le contenu change.
   */
  private wrapLike(element: Element, html: string): string {
    const clone = element.cloneNode(false) as Element;
    clone.innerHTML = html;
    return clone.outerHTML;
  }

  /**
   * Vrai si l'élément apporte encore quelque chose au texte.
   *
   * Le seul contenu textuel ne suffit pas : un `<br>` n'a ni texte ni média mais porte le retour à
   * la ligne. L'écarter collerait la ligne suivante à la précédente.
   */
  private keepsContent(element: Element): boolean {
    if (element.textContent?.trim()) return true;

    const carriers = 'br, hr, img, video, iframe';
    return element.matches(carriers) || !!element.querySelector(carriers);
  }

  /**
   * Les URL prévisualisables que ce nœud cite, dans l'ordre du document.
   *
   * Une même URL citée deux fois donne deux entrées : chaque occurrence reçoit sa carte, à sa
   * place dans le texte.
   */
  private previewUrlsIn(node: Node, eligible: ReadonlySet<string>): string[] {
    if (node.nodeType !== ELEMENT_NODE) return [];

    const found: string[] = [];

    for (const anchor of this.anchorsOf(node as Element)) {
      const href = anchor.getAttribute('href')?.trim();
      if (href && eligible.has(href)) found.push(href);
    }

    return found;
  }

  /**
   * Retire d'un bloc les ancres remplacées par une carte.
   *
   * Le retrait n'a lieu que si le lien s'affiche sous forme d'URL brute : c'est exactement ce que
   * la carte reproduit, donc le doublon est inutile. Dès que l'auteur a saisi un libellé
   * (« voir l'article »), le lien fait partie de la phrase et le supprimer l'amputerait — on garde
   * alors le lien *et* sa carte.
   *
   * Chaque ancre est jugée pour elle-même : dans un article citant deux liens, l'un peut
   * disparaître au profit de sa carte pendant que l'autre reste dans la phrase.
   */
  private stripAnchors(root: Element, urls: ReadonlySet<string>): void {
    for (const anchor of this.anchorsOf(root)) {
      const href = anchor.getAttribute('href')?.trim();
      if (!href || !urls.has(href)) continue;
      if (!this.isRawUrlLabel(anchor, href)) continue;

      // `root` peut être l'ancre elle-même, quand l'éditeur n'enveloppe pas la ligne dans un
      // bloc. Elle est alors détachée sans que son `textContent` change : c'est le test sur
      // `parentNode` côté appelant qui empêche de la réinjecter.
      anchor.remove();
    }
  }

  /** L'élément lui-même s'il est une ancre, plus ses ancres descendantes. */
  private anchorsOf(root: Element): Element[] {
    return [
      ...(this.isAnchor(root) ? [root] : []),
      ...Array.from(root.querySelectorAll('a[href]')),
    ];
  }

  /**
   * Vrai si l'ancre se contente d'afficher son URL, à la présentation près (cf. `sameUrl`) : du
   * point de vue du lecteur, il s'agit d'une URL brute — exactement ce que la carte reproduit.
   */
  private isRawUrlLabel(anchor: Element, url: string): boolean {
    const label = anchor.textContent?.trim() ?? '';
    if (!label) return true; // ancre sans texte : aucune phrase à préserver

    return sameUrl(label, url);
  }
}
