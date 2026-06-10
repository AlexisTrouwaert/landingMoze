import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { ScrollRevealDirective } from '../../../directives/scroll-reveal.directive';
import { FunnelKind, MetaPixelService } from '../../../services/meta-pixel.service';
import { LandingNavService } from '../../../services/landing-nav.service';

@Component({
  selector: 'app-tarif',
  standalone: true,
  imports: [ScrollRevealDirective],
  templateUrl: './tarif.component.html',
  styleUrl: './tarif.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TarifComponent {
  private router = inject(Router);
  private readonly metaPixel = inject(MetaPixelService);
  readonly nav = inject(LandingNavService);

  public offers = signal([
    {
      name: 'Freemium',
      subtitle: 'L\'essentiel pour démarrer et facturer efficacement',
      pricePrefix: '',
      price: '0€',
      priceSuffix: '/mois',
      isPopular: false,
      isSocial: false,
      badge: null as string | null,
      features: [
        'Facturation électronique conforme',
        'Factures illimitées, seul',
        'Réseau sociale des indépendants',
        'Tableau de bord et suivi en temps réel'
      ],
      buttonText: "Je m'inscris &rarr;",
      trackingLabel: 'inscription_freemium',
      route: '/commencer'
    },
    {
      name: 'Indép +',
      subtitle: 'Pour aller plus loin et développer ton activité',
      pricePrefix: 'À partir de ',
      price: '9,90€',
      priceSuffix: 'HT/mois',
      isPopular: true,
      isSocial: false,
      badge: 'Le plus populaire' as string | null,
      features: [
        'Freemium',
        'Apport d\'affaires intégré',
        'Factures collaboratives',
        'Accès à l\'avance immédiate SAP',
      ],
      buttonText: "Je m'inscris &rarr;",
      trackingLabel: 'inscription_indep_plus',
      route: '/commencer'
    },
    {
      name: 'Réseau social',
      subtitle: 'Rejoins la communauté et développe ton activité par le réseau',
      pricePrefix: '',
      price: '0€',
      priceSuffix: '/mois',
      isPopular: false,
      isSocial: true,
      badge: 'Le + connecté' as string | null,
      features: [
        'Réseau social des indépendants',
        'Apport d\'affaires entre membres',
        'Groupes & communautés par métier',
        'Messagerie et mise en relation'
      ],
      buttonText: "Je m'inscris &rarr;",
      trackingLabel: 'inscription_reseau_social',
      route: '/rejoindre'
    }
  ]);

  goToFunnel(buttonLabel: string = 'inscription_generic', route: string = '/commencer') {
    // La route encode le funnel ciblé : /rejoindre = réseau, sinon facturation.
    const funnel: FunnelKind = route === '/rejoindre' ? 'reseau' : 'facturation';
    this.metaPixel.trackLeadCTA(buttonLabel, funnel, () => this.router.navigate([route]));
  }
}
