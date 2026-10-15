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

interface PointLoi {
  readonly titre: string;
  /** HTML : certains points portent un lien interne. */
  readonly texte: string;
}

interface FaqItem {
  readonly question: string;
  readonly answer: string;
}

/**
 * Page « Apport d'affaires » — page du silo créée pour la soirée de lancement du 5 novembre 2026.
 *
 * Textes repris de `textes-pages-co-traitance-apport-affaires.md`, passés aux règles du cahier de
 * modifications : un seul bouton d'inscription, aucun nom de prestataire de paiement, aucun prix
 * (la page renvoie vers /tarifs).
 *
 * Masqué tant que MOZE ne les a pas fournis : le modèle de contrat à télécharger (la page
 * /modeles n'existe pas) et le témoignage — on ne publie pas de faux témoignage.
 *
 * Styles partagés avec /facturation-collaborative, dont la page reprend la structure.
 */
@Component({
  selector: 'app-apport-d-affaires',
  imports: [FloatingDockComponent, FooterComponent, RouterLink],
  templateUrl: './apport-d-affaires.component.html',
  styleUrls: [
    '../facturation-collaborative/facturation-collaborative.component.scss',
    './apport-d-affaires.component.scss',
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ApportDAffairesComponent implements OnInit, OnDestroy {

  private readonly router = inject(Router);
  private readonly meta = inject(Meta);
  private readonly seo = inject(SeoService);
  private readonly metaPixel = inject(MetaPixelService);
  private readonly contactPanel = inject(ContactPanelService);

  readonly navGroups = NAV_GROUPS;
  readonly appLoginUrl = APP_LOGIN_URL;

  readonly etapes: readonly Etape[] = [
    {
      titre: 'L\'apporteur transmet le client.',
      texte:
        'Dans MozeConnect, il présente le client au bénéficiaire, l\'indépendant qui réalisera la prestation.',
    },
    {
      titre: 'Vous fixez la commission ensemble.',
      texte:
        'L\'apporteur et le bénéficiaire fixent et négocient librement la commission : montant fixe ou ' +
        'part de la prestation, c\'est votre choix.',
    },
    {
      titre: 'Le bénéficiaire facture le client.',
      texte: 'Il réalise la prestation et facture le client en son nom, comme d\'habitude.',
    },
    {
      titre: 'La commission est payée automatiquement.',
      texte:
        'Quand le client paie, la facture de commission de l\'apporteur est générée puis payée, grâce au ' +
        'rapprochement automatique des paiements par notre prestataire de paiement agréé. Personne n\'a à ' +
        'relancer personne.',
    },
  ];

  readonly pointsLoi: readonly PointLoi[] = [
    {
      titre: 'L\'apport d\'affaires est un contrat libre.',
      texte:
        'Aucun statut particulier : c\'est un accord entre l\'apporteur et le bénéficiaire (articles 1101 ' +
        'et suivants du Code civil). Un écrit n\'est pas imposé, mais il est vivement conseillé.',
    },
    {
      titre: 'La commission se fixe librement',
      texte:
        'entre l\'apporteur et le bénéficiaire : montant, mode de calcul, moment où elle est due (de ' +
        'préférence au paiement effectif du client), durée pendant laquelle les commandes suivantes y ' +
        'ouvrent droit.',
    },
    {
      titre: 'La commission se facture.',
      texte:
        'L\'apporteur facture le bénéficiaire, jamais le client final, avec les mentions obligatoires et ' +
        'bientôt au format de la <a href="/facturation-electronique">facture électronique</a>. Entre ' +
        'professionnels, un paiement sans facture expose à une amende.',
    },
    {
      titre: 'L\'apporteur présente, il ne vend pas.',
      texte:
        'S\'il négocie et signe au nom du bénéficiaire de façon régulière, la relation peut être ' +
        'requalifiée en contrat d\'agent commercial, avec d\'autres obligations.',
    },
    {
      titre: 'Pas de lien de subordination.',
      texte:
        'L\'apporteur et le bénéficiaire restent indépendants l\'un de l\'autre : ni horaires imposés, ni ' +
        'ordres, ni contrôle. Sinon, un juge peut requalifier la relation en contrat de travail.',
    },
    {
      titre: 'Côté bénéficiaire,',
      texte:
        'les commissions versées à un même bénéficiaire au-delà de 2 400 € par an se déclarent en principe ' +
        'sur la déclaration DAS2.',
    },
    {
      titre: 'Certains métiers sont encadrés :',
      texte:
        'immobilier, assurance, crédit, professions de santé. Pour l\'artisanat et les services à la ' +
        'personne, pas de restriction de ce type.',
    },
  ];

  readonly faq: readonly FaqItem[] = [
    {
      question: 'Comment rémunérer un apporteur d\'affaires ?',
      answer:
        'Par une commission, que l\'apporteur et le bénéficiaire fixent librement : montant fixe ou part de ' +
        'la prestation. L\'apporteur facture cette commission au bénéficiaire, jamais au client final. Avec ' +
        'MozeConnect, la facture de commission est générée puis payée automatiquement quand le client règle ' +
        'le bénéficiaire. Personne n\'a à relancer, et tout est tracé dans vos livres de recettes et de dépenses.',
    },
    {
      // La dernière phrase du texte source renvoyait au modèle à télécharger : retirée tant que
      // la page /modeles n'existe pas.
      question: 'Un contrat d\'apporteur d\'affaires est-il obligatoire ?',
      answer:
        'La loi n\'impose pas d\'écrit, mais il est vivement conseillé. Un contrat évite les malentendus : qui ' +
        'est le client apporté, quel montant de commission, à quel moment elle est due, et pendant combien ' +
        'de temps les commandes suivantes y ouvrent droit.',
    },
    {
      question: 'Faut-il un statut particulier pour être apporteur d\'affaires ?',
      answer:
        'Non, aucun statut spécifique. Si vous êtes déjà indépendant, la commission s\'ajoute à vos recettes. ' +
        'Si l\'apport d\'affaires devient régulier, c\'est une activité à part entière qu\'il faut déclarer. ' +
        'Attention aux métiers encadrés, comme l\'immobilier, l\'assurance, le crédit ou la santé, où la ' +
        'rémunération d\'une mise en relation est réglementée ou interdite.',
    },
    {
      question: 'Quelle différence entre apporteur d\'affaires et agent commercial ?',
      answer:
        'L\'apporteur présente un client, ponctuellement, sans négocier ni signer au nom du bénéficiaire. ' +
        'L\'agent commercial agit en vertu d\'un mandat permanent : il négocie, parfois conclut, au nom d\'un ' +
        'professionnel, et bénéficie d\'un statut protecteur. Si l\'apporteur se met à prospecter en continu ' +
        'et à négocier les prix, la relation risque d\'être requalifiée en agence commerciale. Pour aller ' +
        'plus loin : <a href="/blog/facturer-a-plusieurs-1-ce-que-la-loi-permet-ce-qu-elle-interdit">ce ' +
        'que la loi permet, ce qu\'elle interdit</a>.',
    },
    {
      question: 'L\'apporteur d\'affaires peut-il être considéré comme un salarié ?',
      answer:
        'Pas tant qu\'il reste indépendant. L\'apporteur choisit librement quand et comment il recommande, ' +
        'sans ordres, sans horaires imposés et sans contrôle du bénéficiaire. S\'il travaille en fait sous ' +
        'un lien de subordination juridique permanent, un juge peut requalifier la relation en contrat de ' +
        'travail. Seul le juge peut prononcer cette requalification, au cas par cas.',
    },
    {
      question: 'Le client paie-t-il plus cher quand il est recommandé ?',
      answer:
        'Non. Le client reçoit une seule facture, celle du bénéficiaire, au prix convenu avec lui. La ' +
        'commission est une charge du bénéficiaire, qui la paie à l\'apporteur. Le bénéficiaire décide ' +
        'librement de la place qu\'il lui donne dans ses prix. Pour le client, la recommandation reste un ' +
        'service rendu, pas un supplément sur sa facture.',
    },
  ];

  ngOnInit(): void {
    const description =
      'Transmettez un client à un autre indépendant et touchez votre commission sans relance : ' +
      'facture générée et payée au paiement du client.';
    const title = 'Apport d\'affaires entre indépendants : recommandez, soyez payé';

    this.meta.updateTag({ name: 'description', content: description });
    this.meta.updateTag({ property: 'og:title', content: title });
    this.meta.updateTag({ property: 'og:description', content: description });
    this.seo.setSocialImage(SeoService.DEFAULT_SOCIAL_IMAGE, SOCIAL_IMAGE_ALT);

    this.seo.setJsonLd('faq-apport', {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: this.faq.map((item) => ({
        '@type': 'Question',
        name: item.question,
        acceptedAnswer: { '@type': 'Answer', text: item.answer },
      })),
    });

    this.seo.setJsonLd('breadcrumb-apport', {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Accueil', item: 'https://www.moze.fr/' },
        {
          '@type': 'ListItem',
          position: 2,
          name: 'Apport d\'affaires',
          item: 'https://www.moze.fr/apport-d-affaires',
        },
      ],
    });
  }

  ngOnDestroy(): void {
    this.seo.removeJsonLd('faq-apport');
    this.seo.removeJsonLd('breadcrumb-apport');
  }

  goToFunnel(trackingLabel = 'apport_d_affaires'): void {
    this.metaPixel.trackLeadCTA(trackingLabel);
    this.router.navigate(['/commencer']);
  }

  onDockAction(action: string): void {
    if (action === 'support') this.contactPanel.open();
  }
}
