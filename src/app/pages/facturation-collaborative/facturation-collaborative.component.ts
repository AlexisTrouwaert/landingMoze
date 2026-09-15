import { ChangeDetectionStrategy, Component, OnDestroy, OnInit, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { Meta } from '@angular/platform-browser';
import { FloatingDockComponent } from '../../components/floating-dock/floating-dock.component';
import { FooterComponent } from '../home/footer/footer.component';
import { APP_LOGIN_URL, NAV_GROUPS } from '../../config/nav-groups';
import { ContactPanelService } from '../../services/contact-panel.service';
import { MetaPixelService } from '../../services/meta-pixel.service';
import { SeoService, SOCIAL_IMAGE_ALT } from '../../services/seo.service';

/** Une des façons de facturer à plusieurs, comparée aux autres. */
interface Approche {
  readonly nom: string;
  readonly recu: string;
  readonly responsabilite: string;
  readonly tresorerie: string;
  /** La ligne Moze est mise en valeur — c'est la réponse que la page défend. */
  readonly estMoze: boolean;
}

interface Etape {
  readonly titre: string;
  readonly texte: string;
}

interface FaqItem {
  readonly question: string;
  readonly answer: string;
}

/**
 * Page « Facturation collaborative » — troisième page du silo.
 *
 * C'est la requête la moins disputée des trois, et de loin : le mécanisme est présenté comme
 * unique en France, si bien que la concurrence sur ces mots-clés se réduit à des articles
 * généralistes sur la sous-traitance. Une page qui décrit le mécanisme réel a peu d'équivalents
 * à battre.
 *
 * **La matière vient des CGV, section 11.5**, et non du discours commercial : groupement
 * momentané d'entreprises de fait, non solidaire, mandataire administratif, bordereau
 * récapitulatif valant document contractuel, répartition par Stripe Connect. C'est ce niveau de
 * précision qui distingue la page d'une plaquette — et c'est aussi ce qui la rend vérifiable.
 * Toute reformulation doit être repassée au texte des CGV, qui fait foi.
 *
 * Aucun `@defer` : le contenu doit partir dans le HTML servi.
 */
@Component({
  selector: 'app-facturation-collaborative',
  imports: [FloatingDockComponent, FooterComponent, RouterLink],
  templateUrl: './facturation-collaborative.component.html',
  styleUrl: './facturation-collaborative.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FacturationCollaborativeComponent implements OnInit, OnDestroy {

  private readonly router = inject(Router);
  private readonly meta = inject(Meta);
  private readonly seo = inject(SeoService);
  private readonly metaPixel = inject(MetaPixelService);
  private readonly contactPanel = inject(ContactPanelService);

  readonly navGroups = NAV_GROUPS;
  readonly appLoginUrl = APP_LOGIN_URL;

  /** Vidéo explicative — déjà utilisée sur l'accueil, on réutilise la même référence. */
  readonly videoUrl = 'https://www.youtube.com/watch?v=GIayqf7tRGk';

  /**
   * Les trois façons de facturer un même projet à plusieurs.
   *
   * La comparaison est le cœur de la page : personne ne cherche « facturation collaborative »
   * sans avoir d'abord buté sur la sous-traitance ou sur l'empilement de factures séparées.
   */
  readonly approches: readonly Approche[] = [
    {
      nom: 'Sous-traitance',
      recu: 'Une facture unique, émise par le donneur d\'ordre',
      responsabilite: 'Le donneur d\'ordre répond de tout, y compris du travail des autres',
      tresorerie: 'Il avance les paiements de ses sous-traitants',
      estMoze: false,
    },
    {
      nom: 'Factures séparées',
      recu: 'Autant de factures, de devis et d\'interlocuteurs que d\'intervenants',
      responsabilite: 'Chacun pour soi',
      tresorerie: 'Aucune avance, mais aucune coordination non plus',
      estMoze: false,
    },
    {
      nom: 'Facturation collaborative Moze',
      recu: 'Une facture globale, accompagnée d\'un bordereau détaillant chaque intervenant',
      responsabilite: 'Chacun pour soi, sans solidarité entre les intervenants',
      tresorerie: 'Aucune avance : Stripe Connect répartit automatiquement',
      estMoze: true,
    },
  ];

  readonly etapes: readonly Etape[] = [
    {
      titre: 'Vous désignez un mandataire administratif',
      texte:
        'C\'est l\'un de vous, choisi par les autres. Son rôle est strictement administratif : établir ' +
        'les devis et factures globaux, centraliser les informations et les reporter sur le bordereau. ' +
        'Cette désignation n\'emporte aucun mandat de représentation juridique ni aucune solidarité financière.',
    },
    {
      titre: 'Chacun déclare sa ligne',
      texte:
        'Chaque intervenant renseigne son identité, la nature de sa prestation et le montant correspondant. ' +
        'Il est seul responsable de sa ligne, de son contenu comme de ses montants, et en garantit l\'exactitude.',
    },
    {
      titre: 'Chacun valide le bordereau récapitulatif',
      texte:
        'Le bordereau reprend les lignes de tous les intervenants. Sa validation électronique sur la ' +
        'plateforme vaut consentement contractuel : c\'est le document de référence de la collaboration, ' +
        'et il est accepté par chacun avant émission.',
    },
    {
      titre: 'Le paiement se répartit tout seul',
      texte:
        'Les sommes encaissées sont ventilées automatiquement par Stripe Connect, conformément au ' +
        'bordereau. Personne n\'avance l\'argent d\'un autre, et Moze ne conserve à aucun moment les fonds : ' +
        'la plateforme n\'intervient qu\'en tiers technique.',
    },
  ];

  /** Ce dont chacun répond — la question qui décide de l'adoption, ou du refus. */
  readonly responsabilites: readonly string[] = [
    'Sa prestation',
    'Sa ligne de facturation',
    'Ses obligations fiscales, sociales et assurantielles',
  ];

  readonly faq: readonly FaqItem[] = [
    {
      question: 'Est-ce que je deviens responsable du travail des autres ?',
      answer:
        'Non. La collaboration constitue un groupement momentané d\'entreprises <strong>de fait, non ' +
        'solidaire</strong> : sans création de société et sans personnalité morale. Chaque intervenant ' +
        'demeure seul responsable de sa prestation, de sa ligne de facturation et de ses obligations ' +
        'fiscales, sociales et assurantielles. Aucun intervenant ne peut être tenu responsable des ' +
        'manquements d\'un autre.',
    },
    {
      question: 'Faut-il créer une société ou un groupement ?',
      answer:
        'Non. Le groupement est « de fait » : aucune structure à immatriculer, aucune personnalité ' +
        'morale. Un contrat de partenariat distinct reste possible si vous le souhaitez, mais il n\'est ' +
        'pas nécessaire pour utiliser la fonctionnalité.',
    },
    {
      question: 'Le mandataire administratif a-t-il un pouvoir sur les autres ?',
      answer:
        'Non, et c\'est explicite : sa désignation n\'emporte <strong>aucun mandat de représentation ' +
        'juridique ni aucune solidarité financière</strong>. Son rôle se limite à établir les documents ' +
        'globaux, centraliser les informations transmises et les reporter sur le bordereau.',
    },
    {
      question: 'Qui apparaît sur les documents ?',
      answer:
        'La facture est émise au nom de l\'entreprise qui réalise la prestation. Sur une facture ' +
        'collaborative, les informations du mandataire administratif figurent sur le bordereau, et les ' +
        'co-traitants apparaissent dans le corps du document, chacun avec son identité, la nature de sa ' +
        'prestation et son montant.',
    },
    {
      question: 'Qui encaisse l\'argent du client ?',
      answer:
        'Ni le mandataire, ni Moze. Les flux sont encaissés et ventilés par <strong>Stripe Connect</strong>, ' +
        'prestataire de services de paiement agréé, selon la répartition inscrite au bordereau. Moze ne ' +
        'conserve à aucun moment les fonds pour compte de tiers.',
    },
    {
      question: 'Les autres intervenants doivent-ils avoir un compte Moze ?',
      answer:
        'Oui. Chaque intervenant doit disposer d\'un compte : c\'est ce qui permet de sécuriser et ' +
        'd\'automatiser les échanges, les documents, la validation du bordereau et la répartition des ' +
        'paiements. Chacun retrouve ensuite sur son compte les devis et factures de la transaction à ' +
        'laquelle il a participé.',
    },
    {
      question: 'Combien coûte la facturation collaborative ?',
      answer:
        'Elle fait partie de l\'offre Indép +, à 9,90 € HT par mois. S\'y ajoutent <strong>3,9 % HT</strong> ' +
        'de frais administratifs sur le montant total des factures qui passent par la facturation ' +
        'collaborative ou l\'apport d\'affaires.',
    },
  ];

  ngOnInit(): void {
    const description =
      'Facturez à plusieurs sur un même projet sans sous-traitance ni solidarité : ' +
      'bordereau récapitulatif, responsabilités séparées et répartition automatique des paiements.';
    const title = 'Facturation collaborative : facturer à plusieurs sur un même projet';

    this.meta.updateTag({ name: 'description', content: description });
    this.meta.updateTag({ property: 'og:title', content: title });
    this.meta.updateTag({ property: 'og:description', content: description });
    this.seo.setSocialImage(SeoService.DEFAULT_SOCIAL_IMAGE, SOCIAL_IMAGE_ALT);

    this.seo.setJsonLd('faq-collaborative', {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: this.faq.map((item) => ({
        '@type': 'Question',
        name: item.question,
        acceptedAnswer: { '@type': 'Answer', text: item.answer },
      })),
    });

    this.seo.setJsonLd('breadcrumb-collaborative', {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Accueil', item: 'https://www.moze.fr/' },
        {
          '@type': 'ListItem',
          position: 2,
          name: 'Facturation collaborative',
          item: 'https://www.moze.fr/facturation-collaborative',
        },
      ],
    });
  }

  ngOnDestroy(): void {
    this.seo.removeJsonLd('faq-collaborative');
    this.seo.removeJsonLd('breadcrumb-collaborative');
  }

  /** Clic sur la vidéo explicative — même événement que celui posé sur l'accueil. */
  onVideoClick(): void {
    this.metaPixel.trackLeadCTA('facturation_collaborative_explainer');
  }

  goToFunnel(trackingLabel = 'facturation_collaborative'): void {
    this.metaPixel.trackLeadCTA(trackingLabel);
    this.router.navigate(['/commencer']);
  }

  onDockAction(action: string): void {
    if (action === 'support') this.contactPanel.open();
  }
}
