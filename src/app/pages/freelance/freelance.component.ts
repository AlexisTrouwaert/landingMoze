import { ChangeDetectionStrategy, Component, OnDestroy, OnInit, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { Meta } from '@angular/platform-browser';
import { FloatingDockComponent } from '../../components/floating-dock/floating-dock.component';
import { FooterComponent } from '../home/footer/footer.component';
import { APP_LOGIN_URL, NAV_GROUPS } from '../../config/nav-groups';
import { ContactPanelService } from '../../services/contact-panel.service';
import { MetaPixelService } from '../../services/meta-pixel.service';
import { SeoService, SOCIAL_IMAGE_ALT } from '../../services/seo.service';

/** Un lien sortant d'un thème : article de blog ou page du silo. */
interface Ressource {
  readonly libelle: string;
  readonly route: string;
  /** `true` pour une page du silo, `false` pour un article — change la pastille affichée. */
  readonly estPage: boolean;
}

/** Un problème vécu, et ce qu'on y répond. */
interface Theme {
  readonly id: string;
  /**
   * Étiquette de catégorie posée au-dessus du titre, comme sur les autres pages du silo.
   * Elle nomme le sujet ; le titre, lui, énonce le problème. Jamais le même mot dans les deux,
   * sans quoi la ligne verte ne fait que répéter ce qu'on va lire.
   */
  readonly surtitre: string;
  readonly titre: string;
  /**
   * La part du titre à surligner en vert — doit en être un extrait exact.
   * Le reste est du contexte : c'est lui qu'on lit en diagonale.
   */
  readonly accent: string;
  readonly probleme: string;
  readonly reponse: string;
  readonly ressources: readonly Ressource[];
}

interface FaqItem {
  readonly question: string;
  readonly answer: string;
}

/**
 * Page « Freelance » — cinquième page du silo, et la première de type **persona**.
 *
 * Elle ne reprend pas l'argumentaire produit de l'accueil, et c'est délibéré : l'accueil s'adresse
 * déjà aux freelances. Deux URL qui vendent le même outil au même public se disputent la même
 * requête, et Google n'en garde qu'une. Cette page est donc construite **par problème vécu**, pas
 * par fonctionnalité, et sert de plaque tournante vers les articles du blog et les pages du silo.
 *
 * C'est aussi ce qui fait enfin travailler le blog : jusqu'ici, aucun lien interne ne pointait
 * vers les articles en dehors de la liste `/blog`. Un article qu'on n'atteint que par la liste
 * n'accumule aucune autorité.
 *
 * **Périmètre à tenir** : le métier et l'activité. Tout ce qui relève du *statut* — plafonds de
 * chiffre d'affaires, cotisations, franchise en base de TVA — appartient à la future page
 * `/auto-entrepreneur`, et ne doit pas être traité ici sous peine de refaire le même découpage à
 * deux endroits.
 *
 * Aucun `@defer` : le contenu doit partir dans le HTML servi.
 */
@Component({
  selector: 'app-freelance',
  imports: [FloatingDockComponent, FooterComponent, RouterLink],
  templateUrl: './freelance.component.html',
  styleUrl: './freelance.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FreelanceComponent implements OnInit, OnDestroy {

  private readonly router = inject(Router);
  private readonly meta = inject(Meta);
  private readonly seo = inject(SeoService);
  private readonly metaPixel = inject(MetaPixelService);
  private readonly contactPanel = inject(ContactPanelService);

  readonly navGroups = NAV_GROUPS;
  readonly appLoginUrl = APP_LOGIN_URL;

  /**
   * Les six thèmes couvrent l'intégralité des articles publiés et des quatre pages du silo.
   *
   * Les articles **archivés** en sont volontairement absents : « un client ne vous paie pas »,
   * « le devis n'est pas une formalité », « augmenter ses tarifs » et « voiture et
   * micro-entreprise » colleraient pourtant parfaitement. Les republier serait le moyen le plus
   * rapide d'enrichir cette page.
   */
  readonly themes: readonly Theme[] = [
    {
      id: 'se-faire-payer',
      surtitre: 'La trésorerie',
      titre: 'Se faire payer, et savoir où vous en êtes',
      accent: 'et savoir où vous en êtes',
      probleme:
        'Le vrai sujet du freelance n\'est pas de facturer, c\'est d\'encaisser — et de savoir, à tout ' +
        'moment, ce qui est parti, ce qui est dû et ce qui est arrivé.',
      reponse:
        'Un devis clair, une facture conforme envoyée sans délai, un statut suivi jusqu\'à ' +
        'l\'encaissement. Et surtout, une règle pour décider combien vous vous versez : le chiffre ' +
        'd\'affaires ne dit pas si l\'activité va bien.',
      ressources: [
        { libelle: 'Combien vous verser ? La méthode des enveloppes', route: '/blog/combien-vous-verser-methode-enveloppes', estPage: false },
        { libelle: 'Le chiffre d\'affaires ne dit pas si votre activité va bien', route: '/blog/chiffre-affaires-ne-dit-pas-si-activite-va-bien', estPage: false },
      ],
    },
    {
      id: 'trouver-des-clients',
      surtitre: 'La prospection',
      titre: 'Trouver des clients sans y passer vos journées',
      accent: 'sans y passer vos journées',
      probleme:
        'Prospecter prend le temps que vous ne facturez pas, et beaucoup d\'indépendants détestent ça ' +
        'au point de ne le faire qu\'en creux de charge — c\'est-à-dire trop tard.',
      reponse:
        'Le réseau fait une partie du travail : recommandations entre indépendants, missions ' +
        'proposées à votre réseau, apport d\'affaires avec commission gérée automatiquement. Vous ' +
        'ne vendez pas, vous êtes recommandé.',
      ressources: [
        { libelle: 'Trouver des clients quand on déteste prospecter', route: '/blog/trouver-clients-sans-prospecter-independant', estPage: false },
        { libelle: 'Pourquoi refuser une mission est parfois la bonne décision', route: '/blog/pourquoi-refuser-mission-freelance-meilleure-decision-2', estPage: false },
      ],
    },
    {
      id: 'travailler-a-plusieurs',
      surtitre: 'Le collectif',
      titre: 'Prendre des projets trop gros pour vous seul',
      accent: 'trop gros pour vous seul',
      probleme:
        'La mission intéressante dépasse votre périmètre. Vous la refusez, ou vous sous-traitez et ' +
        'vous portez alors la responsabilité — et la trésorerie — du travail des autres.',
      reponse:
        'La facturation collaborative permet de mener le projet à plusieurs sans créer de structure ' +
        'et sans solidarité : une facture globale pour le client, un bordereau qui détaille la part ' +
        'de chacun, et un paiement réparti automatiquement.',
      ressources: [
        { libelle: 'Comment fonctionne la facturation collaborative', route: '/facturation-collaborative', estPage: true },
      ],
    },
    {
      id: 'rester-en-regle',
      surtitre: 'La conformité',
      titre: 'Rester en règle sans y penser tous les jours',
      accent: 'sans y penser tous les jours',
      probleme:
        'Les obligations changent, et personne ne vous prévient. La facturation électronique en est ' +
        'l\'exemple du moment : l\'obligation d\'émettre tombe le 1er septembre 2027 pour les ' +
        'indépendants, celle de recevoir court déjà.',
      reponse:
        'Des factures générées au bon format sans que vous ayez à y penser, et une veille ' +
        'réglementaire incluse jusque dans l\'offre gratuite. Le reste — assurances, mentions ' +
        'obligatoires — se règle une fois et se vérifie une fois par an.',
      ressources: [
        // Renvoi vers la page statut : ce qui touche aux plafonds, à la TVA et aux cotisations
        // n'est délibérément pas traité ici, pour que les deux pages ne se recouvrent pas.
        { libelle: 'Auto-entrepreneur : plafonds, TVA et cotisations', route: '/auto-entrepreneur', estPage: true },
        { libelle: 'Facturation électronique : le calendrier 2026-2027', route: '/facturation-electronique', estPage: true },
        { libelle: 'Bien choisir son outil, sans se faire avoir', route: '/blog/facturation-electronique-pour-les-nuls-4-bien-choisir-son-outil-sans-se-faire', estPage: false },
        { libelle: 'Les assurances de l\'indépendant : lesquelles sont obligatoires', route: '/blog/assurances-independant-rc-pro-obligatoire-ou-non', estPage: false },
      ],
    },
    {
      id: 'tenir-dans-la-duree',
      surtitre: 'L\'usure',
      titre: 'Tenir dans la durée',
      accent: 'dans la durée',
      probleme:
        'Pas de collègues, pas d\'arrêt maladie qui va de soi, pas de congés payés, et une charge ' +
        'mentale qui ne s\'arrête pas au vendredi soir. C\'est ce qui use, bien avant le manque de ' +
        'clients.',
      reponse:
        'Anticiper ce qui peut l\'être, et accepter que le reste ne se planifie pas. Une communauté ' +
        'd\'indépendants qui traversent les mêmes choses y aide plus qu\'un outil.',
      ressources: [
        { libelle: 'Tomber malade quand on est à son compte', route: '/blog/tomber-malade-independant-arret-travail-anticiper', estPage: false },
        { libelle: 'La journée type du freelance n\'existe pas', route: '/blog/journee-type-freelance-existe-pas', estPage: false },
        { libelle: 'Décrocher en vacances sans perdre ses clients', route: '/blog/vacances-ete-independant-deconnecter-sans-perdre-clients', estPage: false },
      ],
    },
    {
      id: 'elargir-son-offre',
      surtitre: 'Le crédit d\'impôt',
      titre: 'Élargir son offre vers les particuliers',
      accent: 'vers les particuliers',
      probleme:
        'Facturer des particuliers, c\'est un marché entier — mais votre prix affiché paraît deux ' +
        'fois plus cher que celui d\'un concurrent qui fait bénéficier ses clients du crédit d\'impôt.',
      reponse:
        'Le crédit d\'impôt de 50 % suppose un organisme déclaré. Passer par la coopérative vous en ' +
        'ouvre l\'accès sans obtenir votre propre déclaration.',
      ressources: [
        { libelle: 'Services à la personne : proposer le crédit d\'impôt', route: '/services-a-la-personne', estPage: true },
        { libelle: 'Le guide 2026 du crédit d\'impôt de 50 %', route: '/blog/credit-impot-services-a-la-personne-2026', estPage: false },
      ],
    },
  ];

  /**
   * Les thèmes tels qu'ils s'affichent : le titre découpé une fois pour toutes autour du
   * mot-clé à surligner.
   *
   * Trois interpolations plutôt qu'un `[innerHTML]` : le titre reste une donnée textuelle,
   * pas du balisage stocké — et la table des matières continue de lire `titre` tel quel,
   * sans avoir à en retirer des balises.
   *
   * Un `accent` qui ne serait pas un extrait exact du titre ne casse rien : le titre
   * s'affiche alors entier, simplement sans vert.
   */
  readonly themesAffiches = this.themes.map(theme => {
    const debut = theme.titre.indexOf(theme.accent);
    if (debut === -1) return { ...theme, avant: theme.titre, accent: '', apres: '' };
    return {
      ...theme,
      avant: theme.titre.slice(0, debut),
      apres: theme.titre.slice(debut + theme.accent.length),
    };
  });

  readonly faq: readonly FaqItem[] = [
    {
      question: 'Moze est-il une plateforme de missions comme les places de marché freelance ?',
      answer:
        'Non, et la nuance compte. Moze ne vend pas de missions à ses membres&nbsp;: c\'est un réseau ' +
        'entre indépendants, où les opportunités circulent par <strong>recommandation et apport ' +
        'd\'affaires</strong> entre membres, avec une commission gérée automatiquement. Vous n\'y ' +
        'trouverez pas un flux d\'offres publié par des clients.',
    },
    {
      question: 'Faut-il un logiciel de facturation quand on est freelance ?',
      answer:
        'À partir du 1<sup>er</sup> septembre 2027, oui&nbsp;: les factures entre professionnels ' +
        'devront être émises dans un format structuré et transiter par une plateforme agréée. Un ' +
        'devis rédigé sous Word ou un PDF envoyé par e-mail ne répondront plus à l\'obligation.',
    },
    {
      question: 'Peut-on vraiment facturer à plusieurs sur un même projet ?',
      answer:
        'Oui. C\'est la facturation collaborative&nbsp;: le client reçoit une facture globale, un ' +
        'bordereau détaille la part de chaque intervenant, et chacun reste seul responsable de sa ' +
        'prestation, <strong>sans solidarité</strong> avec les autres.',
    },
    {
      question: 'Combien ça coûte pour un freelance ?',
      answer:
        'Le réseau, les communautés et la veille réglementaire sont gratuits, sans limite de durée. ' +
        'La facturation fait partie de l\'offre Indép +, à 9,90 € HT par mois, sans engagement et ' +
        'sans carte bancaire à l\'inscription.',
    },
  ];

  ngOnInit(): void {
    const description =
      'Se faire payer, trouver des clients, travailler à plusieurs, rester en règle : ce qui ' +
      'occupe vraiment un freelance au quotidien, et comment s\'en sortir.';
    const title = 'Freelance : gérer son activité au quotidien';

    this.meta.updateTag({ name: 'description', content: description });
    this.meta.updateTag({ property: 'og:title', content: title });
    this.meta.updateTag({ property: 'og:description', content: description });
    this.seo.setSocialImage(SeoService.DEFAULT_SOCIAL_IMAGE, SOCIAL_IMAGE_ALT);

    this.seo.setJsonLd('faq-freelance', {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: this.faq.map((item) => ({
        '@type': 'Question',
        name: item.question,
        acceptedAnswer: { '@type': 'Answer', text: item.answer },
      })),
    });

    this.seo.setJsonLd('breadcrumb-freelance', {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Accueil', item: 'https://www.moze.fr/' },
        { '@type': 'ListItem', position: 2, name: 'Freelance', item: 'https://www.moze.fr/freelance' },
      ],
    });
  }

  ngOnDestroy(): void {
    this.seo.removeJsonLd('faq-freelance');
    this.seo.removeJsonLd('breadcrumb-freelance');
  }

  goToFunnel(trackingLabel = 'freelance'): void {
    this.metaPixel.trackLeadCTA(trackingLabel);
    this.router.navigate(['/commencer']);
  }

  onDockAction(action: string): void {
    if (action === 'support') this.contactPanel.open();
  }
}
