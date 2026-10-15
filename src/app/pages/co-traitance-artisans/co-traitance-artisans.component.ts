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
  /** HTML : certaines étapes portent un lien interne. */
  readonly texte: string;
}

interface PointLoi {
  readonly titre: string;
  readonly texte: string;
}

interface LigneDevis {
  readonly coequipier: string;
  readonly prestation: string;
  readonly ht: string;
  readonly tva: string;
  readonly ttc: string;
}

interface FaqItem {
  readonly question: string;
  readonly answer: string;
}

/**
 * Page « Co-traitance entre artisans ».
 *
 * Seule page du site où l'on écrit « chantier » et « co-traitants » : c'est le vocabulaire des
 * artisans, et celui qu'ils tapent dans Google (« facture co-traitance », « devis commun plusieurs
 * artisans »).
 *
 * Textes repris de `textes-pages-co-traitance-apport-affaires.md`, passés aux règles du cahier de
 * modifications (chef de file, aucun nom de prestataire de paiement, un seul bouton d'inscription).
 * Masqués tant que MOZE ne les a pas fournis : le modèle de facture à télécharger et le témoignage.
 *
 * Styles partagés avec /facturation-collaborative, dont la page reprend la structure.
 */
@Component({
  selector: 'app-co-traitance-artisans',
  imports: [FloatingDockComponent, FooterComponent, RouterLink],
  templateUrl: './co-traitance-artisans.component.html',
  styleUrls: [
    '../facturation-collaborative/facturation-collaborative.component.scss',
    '../apport-d-affaires/apport-d-affaires.component.scss',
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CoTraitanceArtisansComponent implements OnInit, OnDestroy {

  private readonly router = inject(Router);
  private readonly meta = inject(Meta);
  private readonly seo = inject(SeoService);
  private readonly metaPixel = inject(MetaPixelService);
  private readonly contactPanel = inject(ContactPanelService);

  readonly navGroups = NAV_GROUPS;
  readonly appLoginUrl = APP_LOGIN_URL;

  readonly etapes: readonly Etape[] = [
    {
      titre: 'Le chef de file crée le devis commun.',
      texte:
        'Dans MozeConnect, il ajoute ses coéquipiers et la part de chacun. Le devis présente au client ' +
        'toutes les prestations, artisan par artisan.',
    },
    {
      titre: 'Le client accepte l\'ensemble.',
      texte:
        'Il signe un seul devis, qui l\'engage avec chaque artisan pour sa part. Le chef de file lui ' +
        'transmet aussi le bordereau récapitulatif du chantier.',
    },
    {
      titre: 'Chaque coéquipier reçoit SA facture.',
      texte:
        'Elle est générée automatiquement, à son nom, avec ses mentions et sa TVA. Rien à saisir, et elle ' +
        'est <a href="/facturation-electronique">conforme à la facture électronique</a>.',
    },
    {
      titre: 'Le client paie, chacun est payé de sa part.',
      texte:
        'Le rapprochement automatique des paiements par notre prestataire de paiement agréé répartit les ' +
        'sommes. Chacun voit sa recette arriver dans son livre des recettes.',
    },
  ];

  /** Exemple fictif du texte source : 9 000 € HT, trois artisans. */
  readonly devis: readonly LigneDevis[] = [
    {
      coequipier: 'Julien, plombier (chef de file)',
      prestation: 'Dépose, douche à l\'italienne, raccordements',
      ht: '4 200 €',
      tva: '10 % : 420 €',
      ttc: '4 620 €',
    },
    {
      coequipier: 'Nadia, carreleuse',
      prestation: 'Faïence murale et sol',
      ht: '3 100 €',
      tva: '10 % : 310 €',
      ttc: '3 410 €',
    },
    {
      coequipier: 'Hugo, électricien en franchise de TVA',
      prestation: 'Mise aux normes, éclairage, sèche-serviettes',
      ht: '1 700 €',
      tva: 'Non applicable (art. 293 B du CGI)',
      ttc: '1 700 €',
    },
  ];

  readonly pointsLoi: readonly PointLoi[] = [
    {
      titre: 'La co-traitance repose sur un contrat.',
      texte:
        'Entre particuliers et professionnels, c\'est la liberté contractuelle qui s\'applique : un contrat ' +
        'est un accord de volontés qui crée des obligations (articles 1101 et suivants du Code civil). Le ' +
        'devis commun accepté par le client en est la trace.',
    },
    {
      titre: 'Chacun s\'engage pour sa part.',
      texte:
        'Chaque artisan est lié directement au client pour les travaux qu\'il réalise, et il facture en son ' +
        'nom. C\'est la différence avec la sous-traitance, où un seul artisan détient le marché et facture tout.',
    },
    {
      titre: 'Le chef de file représente le groupe.',
      texte:
        'Il coordonne et représente le groupe auprès du client (le droit parle de « mandataire commun »). ' +
        'Il ne facture pas le travail des autres à leur place.',
    },
    {
      titre: 'La solidarité ne se présume pas.',
      texte:
        'Sauf clause qui la prévoit, aucun artisan n\'a à payer pour la faute d\'un autre (article 1310 du ' +
        'Code civil). Lisez bien le contrat du client : il peut demander que le chef de file soit solidaire. ' +
        'Si le marché renvoie à la norme NF P03-001, vérifiez ce qu\'elle prévoit.',
    },
    {
      titre: 'Chacun garde ses assurances.',
      texte:
        'Chaque artisan reste assuré pour ses propres travaux, garantie décennale comprise. Échangez vos ' +
        'attestations avant le chantier.',
    },
    {
      titre: 'Les factures restent des factures normales,',
      texte: 'avec toutes les mentions obligatoires, y compris celles de la facture électronique.',
    },
  ];

  readonly faq: readonly FaqItem[] = [
    {
      question: 'Quelle différence entre co-traitance et sous-traitance ?',
      answer:
        'En <a href="/blog/facturer-a-plusieurs-2-la-sous-traitance-le-cadre-le-plus-courant">sous-traitance</a>, ' +
        'un seul artisan signe avec le client et facture tout. Il paie ensuite ses sous-traitants, qui le ' +
        'facturent. En co-traitance, chaque artisan est lié directement au client pour sa part et lui adresse ' +
        'sa propre facture. Le chiffre d\'affaires de chacun reflète son travail réel, et la TVA ne s\'empile ' +
        'pas d\'une facture à l\'autre.',
    },
    {
      question: 'Faut-il créer une société pour faire de la co-traitance ?',
      answer:
        'Non. Un groupement de co-traitants n\'a pas de personnalité juridique et pas de SIRET. Il existe par ' +
        'l\'accord entre les artisans et par le devis commun accepté par le client. Chacun garde son statut, y ' +
        'compris en micro-entreprise. Un écrit entre vous reste conseillé : qui fait quoi, pour quel montant, ' +
        'et que se passe-t-il si l\'un ne peut pas finir.',
    },
    {
      question: 'Le chef de file est-il responsable du travail des autres ?',
      answer:
        'Pas automatiquement. La solidarité ne se présume pas : sauf clause qui la prévoit, chaque artisan ' +
        'répond de ses propres travaux. Le chef de file coordonne le chantier et représente le groupe auprès ' +
        'du client. Vérifiez toutefois le contrat ou le cahier des charges du client, qui peut demander que ' +
        'le chef de file soit solidaire des autres.',
    },
    {
      question: 'Le client doit-il payer chaque artisan séparément ?',
      answer:
        'Non. Le client accepte un seul devis et règle en une fois. Le rapprochement automatique des paiements ' +
        'par notre prestataire de paiement agréé affecte ensuite à chaque artisan la somme qui correspond à sa ' +
        'facture. Le client garde un seul interlocuteur, et chaque coéquipier voit son paiement arriver sans ' +
        'attendre qu\'un collègue le reverse.',
    },
    {
      question: 'Comment est gérée la TVA quand un artisan est en franchise ?',
      answer:
        'Chaque facture suit la situation de celui qui l\'émet. Un artisan redevable de la TVA applique le taux ' +
        'qui convient à ses travaux. Un artisan en franchise porte la mention « TVA non applicable, art. 293 B ' +
        'du CGI ». Le devis commun affiche ces différences, ligne par ligne, et le client voit clairement le ' +
        'total à payer.',
    },
    {
      question: 'Les factures générées sont-elles conformes à la facture électronique ?',
      answer:
        'Oui. Chaque facture est produite au format Factur-X, avec les mentions obligatoires. MozeConnect est ' +
        'raccordé à Super PDP, Plateforme Agréée immatriculée par la DGFiP. Vous êtes donc prêt pour ' +
        'l\'obligation d\'émettre des <a href="/facturation-electronique">factures électroniques</a>, qui ' +
        's\'appliquera aux micro-entreprises et aux PME à partir du 1er septembre 2027.',
    },
  ];

  ngOnInit(): void {
    const description =
      'Un devis commun, une facture par artisan, un paiement réparti automatiquement. La co-traitance ' +
      'entre artisans, simple et dans les règles.';
    const title = 'Co-traitance entre artisans : un devis commun, chacun sa facture';

    this.meta.updateTag({ name: 'description', content: description });
    this.meta.updateTag({ property: 'og:title', content: title });
    this.meta.updateTag({ property: 'og:description', content: description });
    this.seo.setSocialImage(SeoService.DEFAULT_SOCIAL_IMAGE, SOCIAL_IMAGE_ALT);

    this.seo.setJsonLd('faq-co-traitance', {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: this.faq.map((item) => ({
        '@type': 'Question',
        name: item.question,
        acceptedAnswer: { '@type': 'Answer', text: item.answer },
      })),
    });

    this.seo.setJsonLd('breadcrumb-co-traitance', {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Accueil', item: 'https://www.moze.fr/' },
        {
          '@type': 'ListItem',
          position: 2,
          name: 'Facturer à plusieurs',
          item: 'https://www.moze.fr/facturation-collaborative',
        },
        {
          '@type': 'ListItem',
          position: 3,
          name: 'Co-traitance entre artisans',
          item: 'https://www.moze.fr/co-traitance-artisans',
        },
      ],
    });
  }

  ngOnDestroy(): void {
    this.seo.removeJsonLd('faq-co-traitance');
    this.seo.removeJsonLd('breadcrumb-co-traitance');
  }

  goToFunnel(trackingLabel = 'co_traitance_artisans'): void {
    this.metaPixel.trackLeadCTA(trackingLabel);
    this.router.navigate(['/commencer']);
  }

  onDockAction(action: string): void {
    if (action === 'support') this.contactPanel.open();
  }
}
