import { isPlatformBrowser } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  PLATFORM_ID,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { LinkPreview } from '../../model/link-preview.model';
import { LinkPreviewService } from '../../services/link-preview.service';

/**
 * Hôtes dont on écarte l'image, même quand le back en propose une.
 *
 * YouTube ne répond aux robots que par sa page de consentement : aucun titre à afficher, et la
 * seule vignette récupérable (`hqdefault.jpg`, en 4/3 avec ses bandes noires) arrive recadrée de
 * travers dans le gabarit 1200x630 de la carte. La carte compacte dit la même chose — la source
 * et l'adresse — sans le montrer de travers.
 *
 * À reprendre le jour où l'on saura obtenir titre et miniature propres (l'API oEmbed de YouTube
 * les donne sans clé, mais c'est un appel de plus, côté back).
 */
const HOSTS_WITHOUT_IMAGE = ['youtube.com', 'youtu.be', 'youtube-nocookie.com'];

/** Vrai pour l'hôte lui-même comme pour ses sous-domaines (`m.`, `music.`, `consent.`…). */
function isImagelessHost(url: string | null | undefined): boolean {
  if (!url) return false;

  try {
    const host = new URL(url).hostname.replace(/^www\./, '');
    return HOSTS_WITHOUT_IMAGE.some((h) => host === h || host.endsWith(`.${h}`));
  } catch {
    return false;
  }
}

/**
 * Carte d'aperçu d'un lien externe : en-tête (titre de la page + domaine), image en dessous,
 * l'ensemble cliquable vers la source.
 *
 * Le composant ne rend rien tant que l'aperçu n'est pas arrivé — pas de cadre vide ni de bloc
 * réservé qui ferait sauter la mise en page.
 */
@Component({
  selector: 'app-link-preview',
  templateUrl: './link-preview.component.html',
  styleUrl: './link-preview.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LinkPreviewComponent {
  /** URL à prévisualiser. `null` désactive le composant. */
  readonly url = input.required<string | null>();

  /**
   * Émis dès que le sort de l'aperçu est connu : `true` si la carte est affichée, `false` sinon
   * (lien refusé, échec réseau, rendu serveur).
   *
   * C'est ce qui permet au parent de ne retirer l'URL du texte QUE si la carte la remplace
   * réellement — sinon le lien disparaîtrait sans rien à la place.
   */
  readonly resolved = output<boolean>();

  private readonly linkPreviewService = inject(LinkPreviewService);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  private readonly loaded = signal<LinkPreview | null>(null);
  /** Une image annoncée mais non chargeable (404, hotlink bloqué) : on passe en compact. */
  private readonly imageFailed = signal(false);

  /**
   * L'aperçu reste affiché même sans image : seul le format change (compact au lieu d'illustré).
   * Il n'est retiré que si l'URL est absente ou refusée, cas où le service ne renvoie rien.
   */
  readonly preview = computed(() => this.loaded());

  /**
   * Où mène la carte : **l'adresse écrite dans l'article**, jamais celle que le back renvoie.
   *
   * Le back suit les redirections pour lire les métadonnées ; l'adresse qu'il renvoie peut donc
   * être celle d'arrivée (page de consentement, domaine de suivi). La carte doit envoyer le
   * lecteur là où l'auteur l'a dit — un lien YouTube mène sur YouTube, point.
   */
  readonly destination = computed(() => this.url() ?? '');

  /**
   * Format illustré seulement si une image est annoncée, qu'elle se charge, et que la source
   * n'est pas de celles dont la vignette dessert l'aperçu (cf. `HOSTS_WITHOUT_IMAGE`).
   */
  readonly showImage = computed(() => {
    const data = this.loaded();
    if (!data?.imageUrl || this.imageFailed()) return false;

    // Les deux adresses sont examinées : celle demandée (le `href` de l'article) et celle que le
    // back a finalement atteinte. Une redirection — YouTube renvoie vers sa page de consentement —
    // ne doit pas faire repasser la vignette par la fenêtre, ni dans un sens ni dans l'autre.
    return !isImagelessHost(this.url()) && !isImagelessHost(data.url);
  });

  constructor() {
    effect((onCleanup) => {
      const target = this.url();
      this.imageFailed.set(false);
      this.loaded.set(null);

      // Rien côté serveur, volontairement. Le back interroge le site cible en direct, sans
      // cache et avec 5 s de délai d'attente : résoudre les aperçus pendant le rendu SSR de
      // l'article retarderait d'autant le HTML servi au lecteur — et aux crawlers — pour un
      // contenu purement décoratif. Les liens, eux, sont bien dans le HTML initial : c'est la
      // carte qui apparaît après l'hydratation, pas la destination.
      if (!target || !this.isBrowser) {
        this.resolved.emit(false);
        return;
      }

      const subscription = this.linkPreviewService.get(target).subscribe((result) => {
        this.loaded.set(result);
        this.resolved.emit(result !== null);
      });

      // L'URL change (ou le composant disparaît) : la réponse en vol ne concerne plus personne.
      onCleanup(() => subscription.unsubscribe());
    });
  }

  onImageError(): void {
    // Image annoncée mais non chargeable : on bascule en format compact. Pas de `resolved(false)`
    // ici — une carte reste affichée, elle continue donc de remplacer l'URL dans le texte.
    this.imageFailed.set(true);
  }
}
