import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { ScrollRevealDirective } from '../../../directives/scroll-reveal.directive';

interface FaqItem { title: string; answer: string; }

@Component({
  selector: 'app-faq',
  standalone: true,
  imports: [ScrollRevealDirective],
  templateUrl: './faq.component.html',
  styleUrl: './faq.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class FaqComponent {

  selectedQ = signal<number | null>(null);

  changeSelectedQ(q: number) {
    this.selectedQ.update(current => current === q ? null : q);
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
}
