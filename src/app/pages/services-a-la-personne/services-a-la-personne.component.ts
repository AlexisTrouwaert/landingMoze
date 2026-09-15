import { ChangeDetectionStrategy, Component, OnDestroy, OnInit, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { Meta } from '@angular/platform-browser';
import { FloatingDockComponent } from '../../components/floating-dock/floating-dock.component';
import { FooterComponent } from '../home/footer/footer.component';
import { APP_LOGIN_URL, NAV_GROUPS } from '../../config/nav-groups';
import { ContactPanelService } from '../../services/contact-panel.service';
import { MetaPixelService } from '../../services/meta-pixel.service';
import { SeoService, SOCIAL_IMAGE_ALT } from '../../services/seo.service';

interface Etape {
  readonly titre: string;
  readonly texte: string;
}

interface Activite {
  readonly nom: string;
  readonly exemple: string;
  /** Activités relevant d'un régime d'agrément ou d'autorisation, et non de la seule déclaration. */
  readonly regimeRenforce?: boolean;
}

interface FaqItem {
  readonly question: string;
  readonly answer: string;
}

/**
 * Page « Services à la personne » — quatrième page du silo.
 *
 * Niche étroite mais intention d'achat maximale : celui qui cherche « proposer le crédit d'impôt
 * sans numéro SAP » a déjà buté sur l'obstacle et cherche précisément la solution que vend Moze
 * Coop.
 *
 * **Deux sources distinctes, à ne pas mélanger** : le régime fiscal (taux, plafonds, avance
 * immédiate) relève de la réglementation et a été recoupé hors du dépôt ; le fonctionnement de
 * l'offre (sociétariat, émission des factures, non-sollicitation) vient des CGV — articles 2, 5.2,
 * 7.1 et 11.2. La page ne doit rien affirmer qui ne vienne de l'une ou de l'autre.
 *
 * Aucun `@defer` : le contenu doit partir dans le HTML servi.
 */
@Component({
  selector: 'app-services-a-la-personne',
  imports: [FloatingDockComponent, FooterComponent, RouterLink],
  templateUrl: './services-a-la-personne.component.html',
  styleUrl: './services-a-la-personne.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ServicesALaPersonneComponent implements OnInit, OnDestroy {

  private readonly router = inject(Router);
  private readonly meta = inject(Meta);
  private readonly seo = inject(SeoService);
  private readonly metaPixel = inject(MetaPixelService);
  private readonly contactPanel = inject(ContactPanelService);

  readonly navGroups = NAV_GROUPS;
  readonly appLoginUrl = APP_LOGIN_URL;

  /** Chiffres du régime fiscal — à revoir à chaque loi de finances. */
  readonly chiffres: readonly { valeur: string; libelle: string }[] = [
    { valeur: '50 %', libelle: 'du montant de la prestation, pris en charge par le crédit d\'impôt' },
    { valeur: '12 000 €', libelle: 'de dépenses annuelles retenues, soit 6 000 € de crédit maximum' },
    { valeur: '0 €', libelle: 'le coût de l\'avance immédiate, service gratuit de l\'URSSAF' },
  ];

  readonly etapes: readonly Etape[] = [
    {
      titre: 'Vous devenez sociétaire de Moze Coop',
      texte:
        'Moze Coop est une coopérative, organisme déclaré de services à la personne. L\'adhésion se fait ' +
        'depuis la plateforme, en acceptant ses documents contractuels. Elle reste soumise à son ' +
        'acceptation.',
    },
    {
      titre: 'Vous proposez des prestations éligibles',
      texte:
        'Vos prestations relevant des services à la personne ouvrent droit au crédit d\'impôt pour vos ' +
        'clients particuliers, sans que vous ayez à obtenir votre propre déclaration.',
    },
    {
      titre: 'Le client ne paie que la moitié, tout de suite',
      texte:
        'Avec l\'avance immédiate de l\'URSSAF, le crédit d\'impôt est déduit du montant de la prestation ' +
        'au moment du paiement. Votre client n\'attend pas sa déclaration de revenus de l\'année suivante.',
    },
    {
      titre: 'La facturation passe par la coopérative',
      texte:
        'Pour ces prestations, c\'est Moze Coop qui établit les factures originales, selon ses documents ' +
        'contractuels. Les délais et modalités de paiement sont ceux qu\'elle prévoit.',
    },
  ];

  /**
   * Activités courantes. La liste officielle en compte davantage, et surtout certaines relèvent
   * d'un agrément ou d'une autorisation, et non de la seule déclaration — la nuance est signalée
   * plutôt que passée sous silence : c'est exactement ce qui ferait perdre le lecteur en confiance
   * s'il le découvrait ensuite.
   */
  readonly activites: readonly Activite[] = [
    { nom: 'Entretien de la maison', exemple: 'Ménage, repassage, travaux ménagers' },
    { nom: 'Jardinage', exemple: 'Petits travaux de jardinage, débroussaillage' },
    { nom: 'Petit bricolage', exemple: 'Travaux dits « hommes toutes mains »' },
    { nom: 'Soutien scolaire', exemple: 'Cours à domicile, accompagnement scolaire' },
    { nom: 'Assistance informatique', exemple: 'Dépannage et initiation à domicile' },
    { nom: 'Garde d\'enfants', exemple: 'À domicile, selon l\'âge des enfants', regimeRenforce: true },
    { nom: 'Assistance aux personnes âgées', exemple: 'Accompagnement, aide au quotidien', regimeRenforce: true },
  ];

  readonly faq: readonly FaqItem[] = [
    {
      question: 'Faut-il avoir son propre numéro SAP ?',
      answer:
        'Non. C\'est tout l\'intérêt du dispositif : vous proposez des prestations éligibles en devenant ' +
        'sociétaire de Moze Coop, qui est l\'organisme déclaré. Si vous disposez déjà de votre propre ' +
        'déclaration, vous pouvez évidemment continuer à l\'utiliser.',
    },
    {
      question: 'Suis-je obligé de travailler uniquement via la coopérative ?',
      answer:
        'Non, il n\'y a pas d\'exclusivité sur votre activité : vous gardez vos clients et vos autres ' +
        'missions. Une réserve existe cependant, et il vaut mieux la connaître avant d\'adhérer : pour ' +
        'les clients <strong>venant de Moze Coop</strong>, les conditions générales prévoient un ' +
        'engagement de non-sollicitation pendant la durée du contrat et <strong>deux ans après</strong> ' +
        'sa fin. Autrement dit, la coopérative n\'accapare pas votre activité, mais vous ne pouvez pas ' +
        'récupérer directement la clientèle qu\'elle vous apporte.',
    },
    {
      question: 'Qui émet la facture au client ?',
      answer:
        'Pour les prestations éligibles au crédit d\'impôt, c\'est <strong>Moze Coop</strong> qui établit ' +
        'les factures originales, conformément à ses documents contractuels. C\'est une différence avec ' +
        'la facturation habituelle sur Moze, où la facture est émise à votre nom.',
    },
    {
      question: 'L\'adhésion est-elle automatique ?',
      answer:
        'Non. Le sociétariat est soumis à l\'acceptation de Moze Coop. Un refus, un retrait ou une ' +
        'exclusion met fin à la possibilité de proposer des prestations éligibles au crédit d\'impôt — ' +
        'sans affecter votre compte Moze ni le reste de vos activités.',
    },
    {
      question: 'Combien coûte l\'option coopérative ?',
      answer:
        '20 € HT par mois, qui s\'ajoutent à l\'offre Indép + à 9,90 € HT, soit <strong>29,90 € HT par ' +
        'mois</strong>. Les frais administratifs de 3,9 % HT sur l\'apport d\'affaires et la facturation ' +
        'collaborative s\'appliquent dans les mêmes conditions qu\'ailleurs.',
    },
    {
      question: 'Toutes les activités sont-elles concernées ?',
      answer:
        'Les services à la personne couvrent une liste d\'activités définie par la réglementation. ' +
        'Certaines, comme la garde de jeunes enfants ou l\'assistance aux personnes fragiles, relèvent ' +
        'd\'un régime d\'agrément ou d\'autorisation distinct de la simple déclaration. Vérifiez votre ' +
        'situation avec la coopérative avant de vous engager auprès d\'un client.',
    },
    {
      question: 'Combien mon client économise-t-il vraiment ?',
      answer:
        'La moitié, dans la limite de 12 000 € de dépenses annuelles — soit 6 000 € de crédit d\'impôt ' +
        'au maximum. Ce plafond est majoré de 1 500 € par enfant à charge, par membre du foyer de plus ' +
        'de 65 ans ou par ascendant bénéficiaire de l\'APA, sans dépasser 15 000 €.',
    },
  ];

  ngOnInit(): void {
    const description =
      'Proposez des prestations éligibles au crédit d\'impôt de 50 % sans obtenir votre propre ' +
      'déclaration : sociétariat Moze Coop, avance immédiate URSSAF et facturation prise en charge.';
    const title = 'Services à la personne : proposer le crédit d\'impôt de 50 %';

    this.meta.updateTag({ name: 'description', content: description });
    this.meta.updateTag({ property: 'og:title', content: title });
    this.meta.updateTag({ property: 'og:description', content: description });
    this.seo.setSocialImage(SeoService.DEFAULT_SOCIAL_IMAGE, SOCIAL_IMAGE_ALT);

    this.seo.setJsonLd('faq-sap', {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: this.faq.map((item) => ({
        '@type': 'Question',
        name: item.question,
        acceptedAnswer: { '@type': 'Answer', text: item.answer },
      })),
    });

    this.seo.setJsonLd('breadcrumb-sap', {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Accueil', item: 'https://www.moze.fr/' },
        {
          '@type': 'ListItem',
          position: 2,
          name: 'Services à la personne',
          item: 'https://www.moze.fr/services-a-la-personne',
        },
      ],
    });
  }

  ngOnDestroy(): void {
    this.seo.removeJsonLd('faq-sap');
    this.seo.removeJsonLd('breadcrumb-sap');
  }

  goToFunnel(trackingLabel = 'services_a_la_personne'): void {
    this.metaPixel.trackLeadCTA(trackingLabel);
    this.router.navigate(['/commencer']);
  }

  onDockAction(action: string): void {
    if (action === 'support') this.contactPanel.open();
  }
}
