import { ChangeDetectionStrategy, Component, OnDestroy, OnInit, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { Meta } from '@angular/platform-browser';
import { FloatingDockComponent } from '../../components/floating-dock/floating-dock.component';
import { FooterComponent } from '../home/footer/footer.component';
import { APP_LOGIN_URL, NAV_GROUPS } from '../../config/nav-groups';
import { ContactPanelService } from '../../services/contact-panel.service';
import { MetaPixelService } from '../../services/meta-pixel.service';
import { SeoService, SOCIAL_IMAGE_ALT } from '../../services/seo.service';

interface Seuil {
  readonly activite: string;
  readonly montant: string;
  /** Seuil majoré, pour la TVA uniquement. */
  readonly majore?: string;
}

interface Cotisation {
  readonly activite: string;
  readonly taux: string;
  readonly precision?: string;
}

interface Obligation {
  readonly titre: string;
  readonly texte: string;
}

interface FaqItem {
  readonly question: string;
  readonly answer: string;
}

/**
 * Page « Auto-entrepreneur » — sixième page du silo, et seconde page persona.
 *
 * Angle **statut**, et lui seul : plafonds, TVA, cotisations, déclarations. Tout ce qui touche au
 * métier et à l'activité — se faire payer, trouver des clients, travailler à plusieurs — reste sur
 * `/freelance`. Ce découpage a été arrêté avant d'écrire l'une ou l'autre : deux pages persona qui
 * traitent les mêmes sujets se neutralisent.
 *
 * **Tous les chiffres de cette page sont datés et périssables.** Ils ont été recoupés hors du
 * dépôt en septembre 2026 et doivent être revus à chaque loi de finances. `MISE_A_JOUR` est
 * affichée en clair : une page réglementaire sans date ne mérite aucune confiance, et c'est la
 * première chose que vérifie un lecteur averti.
 *
 * Aucun `@defer` : le contenu doit partir dans le HTML servi.
 */
@Component({
  selector: 'app-auto-entrepreneur',
  imports: [FloatingDockComponent, FooterComponent, RouterLink],
  templateUrl: './auto-entrepreneur.component.html',
  styleUrl: './auto-entrepreneur.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AutoEntrepreneurComponent implements OnInit, OnDestroy {

  private readonly router = inject(Router);
  private readonly meta = inject(Meta);
  private readonly seo = inject(SeoService);
  private readonly metaPixel = inject(MetaPixelService);
  private readonly contactPanel = inject(ContactPanelService);

  readonly navGroups = NAV_GROUPS;
  readonly appLoginUrl = APP_LOGIN_URL;

  /** Date de dernier recoupement des chiffres. À reprendre à chaque révision. */
  readonly miseAJour = '8 septembre 2026';

  /** Plafonds de chiffre d'affaires du régime micro — revalorisés en 2026. */
  readonly plafonds: readonly Seuil[] = [
    { activite: 'Vente de marchandises, hébergement', montant: '203 100 €' },
    { activite: 'Prestations de services et professions libérales', montant: '83 600 €' },
  ];

  /** Seuils de franchise en base de TVA — inchangés en 2026. */
  readonly seuilsTva: readonly Seuil[] = [
    { activite: 'Activités commerciales et hébergement', montant: '85 000 €', majore: '93 500 €' },
    { activite: 'Prestations de services', montant: '37 500 €', majore: '41 250 €' },
    { activite: 'Avocats, auteurs, artistes-interprètes', montant: '50 000 €', majore: '55 000 €' },
  ];

  readonly cotisations: readonly Cotisation[] = [
    { activite: 'Vente de marchandises, hébergement', taux: '12,3 %' },
    { activite: 'Prestations de services commerciales ou artisanales (BIC)', taux: '21,2 %' },
    {
      activite: 'Activités libérales au régime général (BNC)',
      taux: '25,6 %',
      precision: 'Relevé de 24,6 % au 1ᵉʳ janvier 2026',
    },
    { activite: 'Professions libérales réglementées (CIPAV)', taux: '23,2 %' },
  ];

  readonly obligations: readonly Obligation[] = [
    {
      titre: 'Déclarer votre chiffre d\'affaires',
      texte:
        'Chaque mois ou chaque trimestre, selon l\'option retenue, auprès de l\'URSSAF — y compris ' +
        'lorsque le chiffre d\'affaires est nul. C\'est cette déclaration qui déclenche le calcul des ' +
        'cotisations.',
    },
    {
      titre: 'Émettre des factures conformes',
      texte:
        'Mentions légales complètes, numérotation continue, et la mention de franchise en base de TVA ' +
        'tant que vous en relevez. À partir du 1ᵉʳ septembre 2027, elles devront en plus être émises ' +
        'au format électronique structuré.',
    },
    {
      titre: 'Ouvrir un compte bancaire dédié',
      texte:
        'Obligatoire dès lors que votre chiffre d\'affaires dépasse 10 000 € deux années consécutives. ' +
        'Un compte courant ordinaire suffit&nbsp;: rien n\'impose un compte professionnel.',
    },
    {
      titre: 'Payer la CFE',
      texte:
        'La cotisation foncière des entreprises est due à partir de la deuxième année&nbsp;: l\'année ' +
        'de création en est exonérée.',
    },
  ];

  readonly faq: readonly FaqItem[] = [
    {
      question: 'Le seuil de TVA passe-t-il vraiment à 25 000 € ?',
      answer:
        'Non. Le projet de seuil unique à 25 000 €, annoncé pour mars 2025 puis suspendu, a été ' +
        '<strong>définitivement abrogé</strong> par la loi du 3 novembre 2025. La loi de finances pour ' +
        '2026 a été promulguée sans cette mesure&nbsp;: les seuils restent ceux du tableau ci-dessus.',
    },
    {
      question: 'Que se passe-t-il si je dépasse le plafond de chiffre d\'affaires ?',
      answer:
        'Le dépassement sur une seule année ne vous fait pas sortir du régime. C\'est le dépassement ' +
        '<strong>deux années civiles consécutives</strong> qui entraîne le basculement vers le régime ' +
        'réel, au 1ᵉʳ janvier de l\'année suivante.',
    },
    {
      question: 'Et si je dépasse le seuil de TVA ?',
      answer:
        'Deux cas. Au-delà du <strong>seuil majoré</strong>, la TVA s\'applique dès le premier jour du ' +
        'mois de dépassement. Entre le seuil de base et le seuil majoré, la franchise est maintenue ' +
        'l\'année en cours&nbsp;; c\'est le dépassement deux années de suite qui y met fin.',
    },
    {
      question: 'Auto-entrepreneur, micro-entreprise, freelance : est-ce la même chose ?',
      answer:
        '« Auto-entrepreneur » et « micro-entrepreneur » désignent le même régime, simplement ' +
        'renommé. « Freelance » n\'est pas un statut mais une façon de travailler&nbsp;: on peut être ' +
        'freelance en micro-entreprise, en société, ou en portage salarial.',
    },
    {
      question: 'Les cotisations se calculent-elles sur le bénéfice ?',
      answer:
        'Non, sur le <strong>chiffre d\'affaires encaissé</strong>, sans déduction de charges. C\'est ce ' +
        'qui rend le régime simple, et ce qui le rend coûteux dès que votre activité suppose des ' +
        'achats importants.',
    },
    {
      question: 'Faut-il un logiciel de facturation en micro-entreprise ?',
      answer:
        'Jusqu\'ici, non. À partir du 1ᵉʳ septembre 2027, oui&nbsp;: les factures entre professionnels ' +
        'devront être émises dans un format structuré et transiter par une plateforme agréée. Un PDF ' +
        'ou un tableur ne suffiront plus.',
    },
  ];

  ngOnInit(): void {
    const description =
      'Plafonds 2026 (203 100 € et 83 600 €), seuils de TVA inchangés — le seuil unique à ' +
      '25 000 € est abandonné — et taux de cotisations : les chiffres à jour et vos obligations.';
    const title = 'Auto-entrepreneur 2026 : plafonds, TVA et cotisations';

    this.meta.updateTag({ name: 'description', content: description });
    this.meta.updateTag({ property: 'og:title', content: title });
    this.meta.updateTag({ property: 'og:description', content: description });
    this.seo.setSocialImage(SeoService.DEFAULT_SOCIAL_IMAGE, SOCIAL_IMAGE_ALT);

    this.seo.setJsonLd('faq-auto-entrepreneur', {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: this.faq.map((item) => ({
        '@type': 'Question',
        name: item.question,
        acceptedAnswer: { '@type': 'Answer', text: item.answer },
      })),
    });

    this.seo.setJsonLd('breadcrumb-auto-entrepreneur', {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Accueil', item: 'https://www.moze.fr/' },
        {
          '@type': 'ListItem',
          position: 2,
          name: 'Auto-entrepreneur',
          item: 'https://www.moze.fr/auto-entrepreneur',
        },
      ],
    });
  }

  ngOnDestroy(): void {
    this.seo.removeJsonLd('faq-auto-entrepreneur');
    this.seo.removeJsonLd('breadcrumb-auto-entrepreneur');
  }

  goToFunnel(trackingLabel = 'auto_entrepreneur'): void {
    this.metaPixel.trackLeadCTA(trackingLabel);
    this.router.navigate(['/commencer']);
  }

  onDockAction(action: string): void {
    if (action === 'support') this.contactPanel.open();
  }
}
