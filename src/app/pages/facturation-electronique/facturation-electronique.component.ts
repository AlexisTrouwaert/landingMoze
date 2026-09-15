import { ChangeDetectionStrategy, Component, OnDestroy, OnInit, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { Meta } from '@angular/platform-browser';
import { FloatingDockComponent } from '../../components/floating-dock/floating-dock.component';
import { CountUpDirective } from '../../directives/count-up.directive';
import { FooterComponent } from '../home/footer/footer.component';
import { APP_LOGIN_URL, NAV_GROUPS } from '../../config/nav-groups';
import { ContactPanelService } from '../../services/contact-panel.service';
import { MetaPixelService } from '../../services/meta-pixel.service';
import { SeoService, SOCIAL_IMAGE_ALT } from '../../services/seo.service';

/** Une ligne du calendrier officiel. */
interface Echeance {
  readonly date: string;
  readonly qui: string;
  readonly quoi: string;
  /** Échéance déjà passée → présentée comme en vigueur, et non comme à venir. */
  readonly enVigueur: boolean;
}

/** Une question du bloc FAQ — sert à l'affichage ET au JSON-LD. */
interface FaqItem {
  readonly question: string;
  /** HTML restreint aux balises admises par Google dans une `Answer`. */
  readonly answer: string;
}

/**
 * Page « Facturation électronique » — première page du silo thématique.
 *
 * Elle existe parce que l'accueil ne peut pas concourir sur cette requête : une URL ne se
 * positionne que sur une intention, et l'accueil porte déjà celle de la marque. Le sujet est
 * traité ici en profondeur, l'accueil s'y relie.
 *
 * **Aucun `@defer` dans le template, et c'est délibéré.** Les sections de l'accueil sont en
 * `@defer (on idle)` : faute de trigger `hydrate`, le serveur n'en rend que le placeholder, si
 * bien que le HTML servi de `/` ne contient ni les tarifs, ni la FAQ, ni le JSON-LD qui en
 * découle. Sur une page dont l'indexation est la raison d'être, tout doit partir dans la
 * réponse — a fortiori pour les robots qui n'exécutent pas de JavaScript (crawlers IA, aperçus
 * sociaux).
 */
@Component({
  selector: 'app-facturation-electronique',
  imports: [FloatingDockComponent, FooterComponent, RouterLink, CountUpDirective],
  templateUrl: './facturation-electronique.component.html',
  styleUrl: './facturation-electronique.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FacturationElectroniqueComponent implements OnInit, OnDestroy {

  private readonly router = inject(Router);
  private readonly meta = inject(Meta);
  private readonly seo = inject(SeoService);
  private readonly metaPixel = inject(MetaPixelService);
  private readonly contactPanel = inject(ContactPanelService);

  readonly navGroups = NAV_GROUPS;
  readonly appLoginUrl = APP_LOGIN_URL;

  /**
   * Calendrier officiel de la réforme.
   *
   * Les deux premières lignes sont **déjà en vigueur** (1er septembre 2026). La page est écrite
   * depuis ce point du temps : elle constate, elle n'annonce pas — c'est ce qui la distingue des
   * pages rédigées en 2024 qui encombrent encore la requête.
   */
  readonly echeances: readonly Echeance[] = [
    {
      date: '1er septembre 2026',
      qui: 'Toutes les entreprises assujetties à la TVA',
      quoi: 'Obligation de <strong>recevoir</strong> des factures électroniques',
      enVigueur: true,
    },
    {
      date: '1er septembre 2026',
      qui: 'Grandes entreprises et ETI',
      quoi: "Obligation d'<strong>émettre</strong> des factures électroniques et de transmettre l'e-reporting",
      enVigueur: true,
    },
    {
      date: '1er septembre 2027',
      qui: 'PME, TPE, micro-entreprises et indépendants',
      quoi: "Obligation d'<strong>émettre</strong> des factures électroniques et de transmettre l'e-reporting",
      enVigueur: false,
    },
  ];

  /** Étapes de préparation — volontairement courtes et vérifiables. */
  readonly etapes: readonly { titre: string; texte: string }[] = [
    {
      titre: 'Vérifiez que vous pouvez recevoir',
      texte:
        "C'est l'obligation déjà en vigueur. Vos clients grands comptes et ETI émettent leurs " +
        "factures au format électronique depuis le 1er septembre 2026 : il vous faut une " +
        'plateforme capable de les réceptionner.',
    },
    {
      titre: 'Mettez vos mentions légales à jour',
      texte:
        'Quatre mentions deviennent obligatoires sur les factures : le numéro SIREN du client, ' +
        "l'adresse de livraison si elle diffère de l'adresse de facturation, la nature de " +
        "l'opération (biens, services ou les deux) et le paiement de la TVA sur les débits le " +
        'cas échéant.',
    },
    {
      titre: 'Abandonnez le PDF libre et le tableur',
      texte:
        'Une facture rédigée sous Word, Excel ou exportée en PDF simple ne répondra plus à ' +
        "l'obligation. Il faut un format structuré — pour un indépendant, Factur-X est le plus " +
        'confortable.',
    },
    {
      titre: 'Choisissez votre plateforme sans attendre 2027',
      texte:
        "Rien n'oblige à attendre l'échéance pour émettre en électronique. Basculer maintenant, " +
        "c'est étaler l'effort au lieu de le subir en septembre 2027, quand tout le monde s'y " +
        'mettra en même temps.',
    },
  ];

  /**
   * FAQ — source unique de l'affichage et des données structurées `FAQPage`.
   *
   * Les questions sont celles réellement tapées dans un moteur, pas celles qui arrangent le
   * discours commercial : c'est la condition pour que la page réponde à l'intention et, le cas
   * échéant, décroche un résultat enrichi.
   */
  readonly faq: readonly FaqItem[] = [
    {
      question: 'Un PDF envoyé par e-mail est-il une facture électronique ?',
      answer:
        "Non, et c'est le malentendu le plus répandu. Une facture électronique au sens de la " +
        'réforme est un fichier <strong>structuré</strong>, dont les données sont lisibles par ' +
        'une machine, et qui transite par une plateforme agréée. Un PDF classique envoyé en ' +
        "pièce jointe reste une facture papier dématérialisée : il ne répondra pas à l'obligation.",
    },
    {
      question: 'Je suis micro-entrepreneur en franchise en base de TVA. Suis-je concerné ?',
      answer:
        'Oui. La franchise en base dispense de <em>facturer</em> la TVA, pas d\'y être ' +
        "<em>assujetti</em>. L'obligation vise toutes les entreprises assujetties établies en " +
        'France, micro-entrepreneurs et franchise en base compris, sans report lié à la taille ' +
        'pour la réception.',
    },
    {
      question: 'Et mes factures à des clients particuliers ?',
      answer:
        'Elles ne sont pas concernées par la facture électronique, qui ne vise que les échanges ' +
        "entre professionnels établis en France. En revanche, elles entrent dans l'<strong>" +
        'e-reporting</strong> : vous devrez transmettre périodiquement à l\'administration les ' +
        "données de ces transactions, à la même échéance que l'obligation d'émettre.",
    },
    {
      question: 'Quelle est la différence entre le PPF et une PDP ?',
      answer:
        'La <strong>PDP</strong> (Plateforme de Dématérialisation Partenaire) est immatriculée ' +
        'par l\'État et transmet réellement vos factures. Le <strong>PPF</strong> (Portail ' +
        "Public de Facturation) a été recentré en 2024 sur un rôle d'annuaire et de " +
        'concentrateur des données : il ne propose pas de service gratuit d\'émission de ' +
        'factures. Passer par une plateforme partenaire n\'est donc pas une option parmi ' +
        "d'autres, c'est le chemin prévu.",
    },
    {
      question: "Que risque-t-on si l'on n'est pas en règle ?",
      answer:
        "Une facture qui aurait dû être émise au format électronique expose à une amende de " +
        '50&nbsp;€ par facture, plafonnée à 15&nbsp;000&nbsp;€ par an. Un manquement à ' +
        "l'e-reporting coûte 500&nbsp;€ par transmission, sous le même plafond annuel. " +
        "L'absence de plateforme pour recevoir déclenche d'abord une mise en demeure, puis " +
        "500&nbsp;€ si la situation n'est pas régularisée sous trois mois.",
    },
    {
      question: 'Faut-il attendre septembre 2027 pour s\'équiper ?',
      answer:
        "Non — d'autant que l'obligation de <em>réception</em>, elle, court depuis le 1er " +
        'septembre 2026. Passer au format structuré avant l\'échéance d\'émission permet de ' +
        'roder ses habitudes sur des factures ordinaires, plutôt que de découvrir l\'outil le ' +
        'mois où il devient obligatoire.',
    },
  ];

  ngOnInit(): void {
    const description =
      'Réception obligatoire depuis le 1er septembre 2026, émission au 1er septembre 2027 ' +
      "pour les indépendants : calendrier, formats et comment s'y préparer.";
    const title = 'Facturation électronique 2026-2027 : le guide des indépendants';

    this.meta.updateTag({ name: 'description', content: description });
    this.meta.updateTag({ property: 'og:title', content: title });
    this.meta.updateTag({ property: 'og:description', content: description });
    this.meta.updateTag({ property: 'og:type', content: 'article' });
    this.seo.setSocialImage(SeoService.DEFAULT_SOCIAL_IMAGE, SOCIAL_IMAGE_ALT);

    // Données structurées générées depuis `this.faq` — le même tableau que l'affichage, comme
    // l'exige Google : le balisage doit décrire ce que le visiteur voit à l'écran.
    this.seo.setJsonLd('faq-facture-electronique', {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: this.faq.map((item) => ({
        '@type': 'Question',
        name: item.question,
        acceptedAnswer: { '@type': 'Answer', text: item.answer },
      })),
    });

    // Fil d'Ariane : le balisage double le fil visible en haut de page — l'un ne va pas sans
    // l'autre, un `BreadcrumbList` sans équivalent affiché est un motif de rejet.
    this.seo.setJsonLd('breadcrumb-facture-electronique', {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Accueil', item: 'https://www.moze.fr/' },
        {
          '@type': 'ListItem',
          position: 2,
          name: 'Facturation électronique',
          item: 'https://www.moze.fr/facturation-electronique',
        },
      ],
    });
  }

  ngOnDestroy(): void {
    // Ces blocs décrivent CETTE page : partis ailleurs, ils n'ont plus lieu d'être.
    this.seo.removeJsonLd('faq-facture-electronique');
    this.seo.removeJsonLd('breadcrumb-facture-electronique');
    // `og:type` retrouve sa valeur d'`index.html`, faute de quoi l'accueil resterait annoncé
    // comme un article après un passage par cette page.
    this.meta.updateTag({ property: 'og:type', content: 'website' });
  }

  goToFunnel(): void {
    this.metaPixel.trackLeadCTA('facturation_electronique');
    this.router.navigate(['/commencer']);
  }

  onDockAction(action: string): void {
    if (action === 'support') this.contactPanel.open();
  }
}
