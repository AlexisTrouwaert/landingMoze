import { ChangeDetectionStrategy, Component, OnDestroy, OnInit, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { Meta } from '@angular/platform-browser';
import { FloatingDockComponent } from '../../components/floating-dock/floating-dock.component';
import { FooterComponent } from '../home/footer/footer.component';
import { APP_LOGIN_URL, NAV_GROUPS } from '../../config/nav-groups';
import { ContactPanelService } from '../../services/contact-panel.service';
import { MetaPixelService } from '../../services/meta-pixel.service';
import { SeoService, SOCIAL_IMAGE_ALT } from '../../services/seo.service';

/** Une formule, telle qu'affichée en carte. */
interface Offre {
  readonly id: string;
  readonly nom: string;
  readonly accroche: string;
  readonly prix: string;
  readonly suffixe: string;
  /** Précision sous le prix (composition, TTC…). Vide si le prix se suffit. */
  readonly detail: string;
  readonly points: readonly string[];
  readonly miseEnAvant: boolean;
  readonly trackingLabel: string;
}

/**
 * Une option : elle s'ajoute à une formule payante, jamais seule. Pas de `miseEnAvant` ni de
 * bouton — on n'achète pas une option depuis cette page, on découvre ce qu'elle coûte.
 */
interface OptionTarif {
  readonly id: string;
  readonly nom: string;
  readonly accroche: string;
  readonly prix: string;
  readonly suffixe: string;
  readonly detail: string;
  readonly points: readonly string[];
}

/**
 * Une ligne du comparatif. `valeurs` suit l'ordre des colonnes : Freemium, Indép +, À la demande.
 * `true` = inclus, `false` = absent, une chaîne = mention particulière.
 */
interface LigneComparatif {
  readonly libelle: string;
  readonly valeurs: readonly (boolean | string)[];
}

interface FaqItem {
  readonly question: string;
  readonly answer: string;
}

/**
 * Page « Tarifs » — deuxième page du silo thématique (cf. `/facturation-electronique`).
 *
 * Elle ne reprend pas la section `#offres` de l'accueil, elle la prolonge : celle-ci reste un
 * résumé à deux cartes, celle-ci détaille la composition de chaque formule, le comparatif ligne
 * à ligne, les frais variables et les cas d'usage. Recopier la section aurait créé deux URL au
 * contenu identique, dont Google n'aurait gardé qu'une — probablement pas celle qu'on veut.
 *
 * Deux informations n'apparaissent nulle part sur l'accueil et sont pourtant décisives à l'achat :
 * ce que cache le « à partir de 9,90 € » (les options, en dessous des formules) et les 3,9 % HT
 * prélevés sur l'apport d'affaires et la facturation collaborative. Une page tarifs qui les tait
 * envoie le visiteur chercher la réponse ailleurs.
 *
 * **Trois formules, puis deux options**, dans cet ordre et pas mélangées : une option ne se
 * souscrit pas seule, et la poser sur la même ligne que les formules laisserait croire le
 * contraire — c'est la disposition de l'application, qui fait foi.
 *
 * Aucun `@defer` : le contenu doit partir dans le HTML servi.
 */
@Component({
  selector: 'app-tarifs',
  imports: [FloatingDockComponent, FooterComponent, RouterLink],
  templateUrl: './tarifs.component.html',
  styleUrl: './tarifs.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TarifsComponent implements OnInit, OnDestroy {

  private readonly router = inject(Router);
  private readonly meta = inject(Meta);
  private readonly seo = inject(SeoService);
  private readonly metaPixel = inject(MetaPixelService);
  private readonly contactPanel = inject(ContactPanelService);

  readonly navGroups = NAV_GROUPS;
  readonly appLoginUrl = APP_LOGIN_URL;

  readonly offres: readonly Offre[] = [
    {
      id: 'freemium',
      nom: 'Freemium',
      accroche: 'Rejoignez la communauté et développez votre activité par le réseau.',
      prix: '0 €',
      suffixe: '/mois',
      detail: 'Gratuit, sans limite de durée',
      points: [
        'Réseau social des indépendants',
        'Groupes et communautés par métier',
        'Messagerie et mise en relation',
        'Actualités des entrepreneurs',
        'Veille légale et réglementaire',
      ],
      miseEnAvant: false,
      trackingLabel: 'tarifs_freemium',
    },
    {
      id: 'indep-plus',
      nom: 'Indép +',
      accroche: 'Pour facturer, collaborer et développer votre chiffre d\'affaires.',
      prix: '9,90 €',
      suffixe: 'HT/mois',
      detail: 'Soit 11,88 € TTC au taux normal de 20 %',
      points: [
        'Tout le Freemium',
        'Devis et factures illimités',
        'Facturation électronique Factur-X',
        'Suivi des factures en temps réel jusqu\'à l\'encaissement',
        'Apport d\'affaires intégré',
        'Facturation collaborative',
      ],
      miseEnAvant: true,
      trackingLabel: 'tarifs_indep_plus',
    },
    {
      id: 'a-la-demande',
      nom: 'À la demande',
      accroche: 'Pour un besoin ponctuel : une mission, un remplacement, une reprise d\'activité.',
      prix: '14,90 €',
      suffixe: 'HT / 30 jours',
      detail: 'Soit 17,88 € TTC. S\'arrête tout seul au bout de 30 jours.',
      points: [
        'Tout Indép +, pendant 30 jours',
        'Devis et factures illimités',
        'Apport d\'affaires intégré',
        'Facturation collaborative',
        'Aucune reconduction automatique',
      ],
      miseEnAvant: false,
      trackingLabel: 'tarifs_a_la_demande',
    },
  ];

  /**
   * Les options, en dessous des formules.
   *
   * L'adhésion à la coopérative se paie **une fois** (10 €), l'abonnement **tous les mois**
   * (20 € HT) : deux natures différentes, que la carte doit distinguer — sans quoi le visiteur
   * découvre le second au moment de payer.
   */
  readonly options: readonly OptionTarif[] = [
    {
      id: 'cooperative',
      nom: 'Coopérative SAP',
      accroche: 'Pour les prestations éligibles au crédit d\'impôt services à la personne.',
      prix: '20 €',
      suffixe: 'HT/mois',
      detail: '+ 10 € d\'adhésion à la coopérative, une seule fois. Avec Indép +, 29,90 € HT par mois.',
      points: [
        'Accès au numéro SAP, sans exclusivité',
        'Avance immédiate du crédit d\'impôt pour vos clients',
        'Prestations éligibles au crédit d\'impôt de 50 %',
        'Adhésion à la coopérative obligatoire pour en bénéficier',
      ],
    },
    {
      id: 'expert-comptable',
      nom: 'Expert-comptable',
      accroche: 'Pour déléguer vos déclarations de TVA.',
      prix: '30 €',
      suffixe: 'HT/mois',
      detail: 'Soit 36 € TTC au taux normal de 20 %.',
      points: ['Déclarations de TVA prises en charge'],
    },
  ];

  /**
   * Comparatif ligne à ligne — c'est lui qui justifie l'existence de la page : la section de
   * l'accueil se limite à quatre puces par formule, sans dire ce qui manque à celle du dessous.
   */
  readonly comparatif: readonly LigneComparatif[] = [
    { libelle: 'Réseau social des indépendants', valeurs: [true, true, true] },
    { libelle: 'Groupes et communautés par métier', valeurs: [true, true, true] },
    { libelle: 'Messagerie et mise en relation', valeurs: [true, true, true] },
    { libelle: 'Actualités et veille réglementaire', valeurs: [true, true, true] },
    { libelle: 'Devis et factures illimités', valeurs: [false, true, true] },
    { libelle: 'Facturation électronique (Factur-X)', valeurs: [false, true, true] },
    { libelle: 'Suivi des factures jusqu\'à l\'encaissement', valeurs: [false, true, true] },
    { libelle: 'Apport d\'affaires intégré', valeurs: [false, true, true] },
    { libelle: 'Facturation collaborative', valeurs: [false, true, true] },
    { libelle: 'Numéro SAP, sans exclusivité', valeurs: [false, 'En option', 'En option'] },
    {
      libelle: 'Avance immédiate du crédit d\'impôt',
      valeurs: [false, 'En option', 'En option'],
    },
    { libelle: 'Déclarations de TVA déléguées', valeurs: [false, 'En option', 'En option'] },
    { libelle: 'Engagement', valeurs: ['Aucun', 'Aucun', '30 jours, sans reconduction'] },
  ];

  /** Profils types — répond à « laquelle je prends ? », la vraie question du visiteur. */
  readonly profils: readonly { titre: string; texte: string; offre: string }[] = [
    {
      titre: 'Vous démarrez, ou vous voulez juste le réseau',
      texte:
        'Vous cherchez des contacts, des missions et de quoi rester au courant de vos obligations, ' +
        'mais vous facturez encore ailleurs. Le Freemium suffit, et rien ne vous oblige à en sortir.',
      offre: 'Freemium',
    },
    {
      titre: 'Vous facturez, seul ou à plusieurs',
      texte:
        'Devis, factures, relances, et parfois des missions partagées avec d\'autres indépendants. ' +
        'C\'est la formule qui couvre l\'activité courante, réforme de la facturation électronique comprise.',
      offre: 'Indép +',
    },
    {
      titre: 'Vous intervenez chez des particuliers',
      texte:
        'Ménage, jardinage, garde d\'enfants, cours à domicile : la coopérative vous ouvre le numéro SAP ' +
        'sans exclusivité et l\'avance immédiate du crédit d\'impôt, un argument commercial décisif face au particulier. ' +
        'Elle s\'ajoute en option à Indép +.',
      offre: 'Indép + et option coopérative',
    },
  ];

  readonly faq: readonly FaqItem[] = [
    {
      question: 'Y a-t-il un engagement ou des frais de résiliation ?',
      answer:
        'Non. Les formules sont sans engagement et résiliables à tout moment. Aucune carte bancaire ' +
        'n\'est demandée à l\'inscription.',
    },
    {
      question: 'Puis-je facturer avec l\'offre gratuite ?',
      answer:
        'Non. Le Freemium donne accès au réseau social, aux communautés et à la veille réglementaire. ' +
        'L\'édition de devis et de factures fait partie d\'Indép +, à 9,90 € HT par mois.',
    },
    {
      question: 'Que recouvrent les 3,9 % HT ?',
      answer:
        'Ce sont des frais administratifs prélevés sur les factures qui passent par l\'<strong>apport ' +
        'd\'affaires</strong> ou la <strong>facturation collaborative</strong>, calculés sur le montant ' +
        'total de la facture. Une facture que vous émettez seul, sans apporteur ni co-traitant, n\'y est ' +
        'pas soumise.',
    },
    {
      question: 'Les prix sont-ils hors taxes ?',
      answer:
        'Oui. Indép + est à 9,90 € HT par mois, soit 11,88 € TTC au taux normal de 20 %. Si vous êtes ' +
        'assujetti à la TVA, vous la récupérez.',
    },
    {
      question: 'Comment fonctionne l\'option coopérative ?',
      answer:
        'Elle s\'ajoute à Indép + pour 20 € HT par mois, soit 29,90 € HT au total, plus 10 € d\'adhésion ' +
        'à la coopérative, réglés une seule fois. Elle vous donne accès au numéro SAP sans exclusivité ' +
        'et à la gestion de l\'avance immédiate du crédit d\'impôt pour vos clients particuliers.',
    },
    {
      question: 'À quoi sert la formule « À la demande » ?',
      answer:
        'À couvrir un besoin ponctuel : 14,90 € HT pour 30 jours, soit 17,88 € TTC. Elle contient la ' +
        'même chose qu\'Indép + et s\'arrête d\'elle-même au bout des 30 jours, sans reconduction ni ' +
        'résiliation à demander.',
    },
    {
      question: 'Puis-je changer de formule en cours de route ?',
      answer:
        'Oui. Le passage du Freemium à Indép +, ou l\'ajout de la coopérative, se fait depuis votre ' +
        'compte, sans engagement ni frais de changement.',
    },
  ];

  ngOnInit(): void {
    const description =
      'Freemium gratuit, Indép + à 9,90 € HT/mois, formule à la demande à 14,90 € HT les 30 jours. ' +
      'Options coopérative et expert-comptable, comparatif détaillé, frais réels et sans engagement.';
    const title = 'Tarifs Moze : nos formules pour indépendants';

    this.meta.updateTag({ name: 'description', content: description });
    this.meta.updateTag({ property: 'og:title', content: title });
    this.meta.updateTag({ property: 'og:description', content: description });
    this.seo.setSocialImage(SeoService.DEFAULT_SOCIAL_IMAGE, SOCIAL_IMAGE_ALT);

    /**
     * `SoftwareApplication` et non `Product` : Moze est une application métier, et c'est ce type
     * qui porte des `offers` compréhensibles par les moteurs pour un service en ligne.
     *
     * `valueAddedTaxIncluded: false` est explicite — les prix affichés sont hors taxes, et un
     * `price` sans cette précision est lu comme TTC.
     */
    this.seo.setJsonLd('offers-tarifs', {
      '@context': 'https://schema.org',
      '@type': 'SoftwareApplication',
      name: 'Moze',
      applicationCategory: 'BusinessApplication',
      operatingSystem: 'Web, iOS, Android',
      url: 'https://www.moze.fr/tarifs',
      offers: this.offres.map((offre) => ({
        '@type': 'Offer',
        name: offre.nom,
        price: offre.prix.replace(/[^\d,]/g, '').replace(',', '.'),
        priceCurrency: 'EUR',
        valueAddedTaxIncluded: false,
        url: 'https://www.moze.fr/tarifs',
      })),
    });

    this.seo.setJsonLd('faq-tarifs', {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: this.faq.map((item) => ({
        '@type': 'Question',
        name: item.question,
        acceptedAnswer: { '@type': 'Answer', text: item.answer },
      })),
    });

    this.seo.setJsonLd('breadcrumb-tarifs', {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Accueil', item: 'https://www.moze.fr/' },
        { '@type': 'ListItem', position: 2, name: 'Tarifs', item: 'https://www.moze.fr/tarifs' },
      ],
    });
  }

  ngOnDestroy(): void {
    this.seo.removeJsonLd('offers-tarifs');
    this.seo.removeJsonLd('faq-tarifs');
    this.seo.removeJsonLd('breadcrumb-tarifs');
  }

  /** Vrai si la cellule décrit une inclusion (et non une mention libre). */
  estBooleen(valeur: boolean | string): boolean {
    return typeof valeur === 'boolean';
  }

  goToFunnel(trackingLabel = 'tarifs_generic'): void {
    this.metaPixel.trackLeadCTA(trackingLabel);
    this.router.navigate(['/commencer']);
  }

  onDockAction(action: string): void {
    if (action === 'support') this.contactPanel.open();
  }
}
