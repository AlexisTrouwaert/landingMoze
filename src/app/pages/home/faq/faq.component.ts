import { afterNextRender, ChangeDetectionStrategy, Component, ElementRef, inject, OnDestroy, signal } from '@angular/core';
import { ScrollRevealDirective } from '../../../directives/scroll-reveal.directive';
import { MetaPixelService } from '../../../services/meta-pixel.service';
import { SeoService } from '../../../services/seo.service';

interface FaqItem { title: string; answer: string; }

@Component({
    selector: 'app-faq',
    imports: [ScrollRevealDirective],
    templateUrl: './faq.component.html',
    styleUrl: './faq.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class FaqComponent implements OnDestroy {

  private readonly metaPixel = inject(MetaPixelService);
  private readonly seo = inject(SeoService);
  private readonly host: ElementRef<HTMLElement> = inject(ElementRef);

  selectedQ = signal<number | null>(null);

  /** Décalage entre deux « lignes » lors de la révélation au scroll. */
  private static readonly STAGGER_MS = 85;
  private revealObserver: IntersectionObserver | null = null;

  constructor() {
    // Révélation au scroll pilotée ici (et non via un [delay] statique par
    // colonne) : on trie les cartes qui entrent par leur position visuelle réelle
    // (boundingClientRect.top). L'ordre d'apparition est donc toujours correct —
    // en 2 colonnes (desktop), les 2 cartes d'une même ligne ont le même top et
    // se révèlent ensemble ; en 1 colonne (mobile/tablette), elles se suivent.
    afterNextRender(() => this.setupReveal());

    // Données structurées FAQPage — générées depuis le MÊME tableau que
    // l'affichage : le balisage décrit exactement ce qui est à l'écran, comme
    // l'exigent les règles de Google. Seules les vraies questions/réponses
    // (`commonQuestions`) y figurent — les cartes fonctionnalités du dessus
    // n'ont pas la forme question → réponse. Posé au rendu serveur aussi,
    // c'est ce qui le met dans le HTML que lisent les robots.
    this.seo.setJsonLd('faq', {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: this.commonQuestions.map((q) => ({
        '@type': 'Question',
        name: q.title,
        acceptedAnswer: {
          '@type': 'Answer',
          // Les <span> ne servent qu'au style de l'accordéon ; le reste
          // (liens, listes, <br>) fait partie des balises admises par Google.
          text: q.answer.replace(/<\/?span>/g, ''),
        },
      })),
    });
  }

  ngOnDestroy(): void {
    this.revealObserver?.disconnect();
    // Le bloc décrit CETTE section : parti ailleurs, il n'a plus lieu d'être.
    this.seo.removeJsonLd('faq');
  }

  private setupReveal(): void {
    const cards = Array.from(
      this.host.nativeElement.querySelectorAll<HTMLElement>('.question-container')
    );
    if (!cards.length) return;

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduceMotion || typeof IntersectionObserver === 'undefined') {
      cards.forEach(c => c.classList.add('is-revealed'));
      return;
    }

    this.revealObserver = new IntersectionObserver((entries) => {
      const entering = entries
        .filter(e => e.isIntersecting)
        .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);

      let rank = -1;
      let prevTop = Number.NEGATIVE_INFINITY;
      for (const entry of entering) {
        const el = entry.target as HTMLElement;
        // Saut de plus de 8px = nouvelle ligne → on incrémente le rang du stagger.
        // Même ligne (desktop) → même rang → révélation simultanée.
        if (entry.boundingClientRect.top - prevTop > 8) rank++;
        prevTop = entry.boundingClientRect.top;
        el.style.transitionDelay = `${rank * FaqComponent.STAGGER_MS}ms`;
        el.classList.add('is-revealed');
        this.revealObserver!.unobserve(el);
      }
    }, { threshold: 0.15, rootMargin: '0px 0px -10% 0px' });

    cards.forEach(c => this.revealObserver!.observe(c));
  }

  changeSelectedQ(q: number) {
    this.selectedQ.update(current => current === q ? null : q);
  }

  /** Délégation : capte les clics sur les liens injectés via [innerHTML] dans les réponses */
  onAnswerLinkClick(event: MouseEvent): void {
    const link = (event.target as HTMLElement).closest('a');
    if (!link) return;
    const href = link.getAttribute('href') ?? '';

    if (href.includes('GIayqf7tRGk')) {
      this.metaPixel.trackCustomEvent('VideoPlay', {
        content_name: 'facturation_collaborative_explainer',
        content_id: 'GIayqf7tRGk',
      });
    }
  }

  readonly leftQuestions: FaqItem[] = [
    {
      title: 'CRÉER ET ENVOYER UNE FACTURE',
      answer: `Edite et <span>envoie une facture en quelques minutes</span> seulement. Vérifie ensuite son statut <span>en temps réel</span> jusqu'à l'encaissement pour une <span>gestion simple</span> et <span>rapide.</span>`
    },
    {
      title: "CALCUL COMMISSION APPORTS D'AFFAIRES",
      answer: `<span>Gère automatiquement</span> la commission liée à chaque apport d'affaires. <span>Visualise</span> le montant généré, la <span>répartition et le statut</span> du paiement pour un suivi clair, structuré et sécurisé.`
    },
    {
      title: 'CONNEXION ET MISE EN RÉSEAU',
      answer: `<span>Connecte-toi</span> à d'autres professionnels, crée des <span>synergies</span> et <span>développe</span> ton réseau directement depuis la plateforme. <span>Collabore</span> sur des missions, <span>échange des opportunités</span> et fais grandir ton activité au sein d'un <span>écosystème structuré.</span>`
    },
    {
      title: 'FACTURATION ELECTRONIQUE',
      answer: `Moze Connect intègre le format <span>Factur-X</span>, conforme aux exigences de la facturation électronique en France. Toutes tes factures sont ainsi générées dans un format structuré et reconnu par l'administration. Pour garantir une transmission sécurisée et conforme, Moze est adossé à une <span>Plateforme Agréée (Super PDP) certifiée</span>, immatriculée par l'État. Tu factures simplement, Moze s'occupe de la conformité.`
    }
  ];

  readonly rightQuestions: FaqItem[] = [
    {
      title: 'LA FACTURATION COLLABORATIVE',
      answer: `Crée une facture <span>à plusieurs</span> en quelques clics et répartis <span>automatiquement</span> les montants entre chaque intervenant. <span>Centralise</span> les informations, <span>sécurise</span> la répartition et garde une vision <span>claire</span> de chaque mission collaborative.<br>Chaque co-facturant reste indépendant et pleinement responsable de sa mission, sans engager les autres. <a href="https://www.youtube.com/watch?v=GIayqf7tRGk" target="_blank">Voir la vidéo explicative sur la facturation collaborative</a>.`
    },
    {
      title: 'COOPÉRATIVE ET SAP',
      answer: `Propose des prestations éligibles au <span>crédit d'impôt</span> grâce à la <span>coopérative</span> et au numéro SAP. <span>Développe</span> ton offre, <span>sécurise</span> ton cadre administratif et ouvre de nouvelles <span>opportunités</span> auprès des clients particuliers.`
    },
    {
      title: 'COMPTABILITÉ',
      answer: `<span>Centralise</span> tes données comptables et garde une vision <span>claire</span> de ton activité en temps réel. <span>Exporte facilement</span> tes éléments vers ton expert-comptable et <span>sécurise</span> tes obligations administratives au quotidien.`
    },
    {
      title: 'PARRAINER DES FUTURS MOZEURS',
      answer: `Invite de nouveaux Mozeurs à rejoindre la plateforme afin de <span>développer</span> ton réseau.`
    }
  ];

  /** Bloc « Questions fréquentes » — distinct des sujets/fonctionnalités ci-dessus. */
  readonly commonQuestions: FaqItem[] = [
    {
      title: 'Quel nom apparaît sur la facture ?',
      answer: `La facture est émise au nom de l'entreprise (ou du micro-entrepreneur) qui <span>réalise la prestation</span>&nbsp;: votre <span>nom commercial</span> et vos <span>informations légales</span> y figurent.<br>Sur une <span>facture collaborative</span>, si vous êtes le <span>mandataire administratif</span> (celui qui édite le bordereau récapitulatif), ce sont les vôtres qui apparaissent sur le bordereau&nbsp;; vos <span>co-traitants</span>, eux, figurent dans le corps du document.`
    },
    {
      title: 'Les autres co-traitants doivent-ils eux aussi souscrire à Moze ?',
      answer: `<span>Oui.</span> Pour toute collaboration via la plateforme (partage de mission, apport d'affaires, collaboration commerciale…), <span>chaque intervenant doit avoir un compte Moze</span>&nbsp;: c'est ce qui sécurise et automatise les échanges, contrats, factures et paiements.`
    },
    {
      title: 'Quel est le prix du service ?',
      answer: `Le <span>freemium</span> est gratuit&nbsp;:<ul><li>réseau social des indépendants&nbsp;;</li><li>échanges avec la communauté&nbsp;;</li><li>veille légale et réglementaire.</li></ul>Les fonctionnalités complètes sont à <span>9,90&nbsp;€ HT / mois</span> — <a href="#offres">voir le détail des offres</a>.<br>Seuls les paiements qui transitent par <span>Stripe</span> (compte séquestre) ajoutent <span>3,9&nbsp;% HT</span> de frais de transaction.`
    }
  ];
}
