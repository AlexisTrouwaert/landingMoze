import {Component, inject, OnDestroy, OnInit, signal} from '@angular/core';
import {RouterLink} from '@angular/router';
import {animate, style, transition, trigger} from '@angular/animations';
import {CookieConsentService} from '../../services/cookie-consent.service';

/** pill  → pilule simple (sans boutons)
 *  pill-active → pilule avec ✕ / ✓ visibles (ouvrent le drawer)
 *  drawer      → panneau complet
 */
type CookieView = 'pill' | 'pill-active' | 'drawer';

/* Entrée / sortie de la pilule (transition pill ↔ drawer)
   Portée par .cookie-pill — utilise transform sans conflit avec
   le CSS translate du .pill-positioner (propriétés CSS distinctes) */
const PILL_ANIM = trigger('pillAnim', [
  transition(':enter', [
    style({transform: 'translateY(10px) scale(0.92)', opacity: 0}),
    animate('420ms cubic-bezier(0.16, 1, 0.3, 1)',
      style({transform: 'translateY(0) scale(1)', opacity: 1}))
  ]),
  transition(':leave', [
    animate('220ms cubic-bezier(0.4, 0, 1, 1)',
      style({transform: 'translateY(6px) scale(0.94)', opacity: 0}))
  ])
]);

/* Apparition / disparition des boutons dans la pilule (expansion latérale) */
const PILL_BTNS_ANIM = trigger('pillBtnsAnim', [
  transition(':enter', [
    style({'max-width': '0px', opacity: 0}),
    animate('450ms cubic-bezier(0.16, 1, 0.3, 1)',
      style({'max-width': '52px', opacity: 1}))
  ]),
  transition(':leave', [
    animate('300ms cubic-bezier(0.4, 0, 1, 1)',
      style({'max-width': '0px', opacity: 0}))
  ])
]);

/* Entrée / sortie du drawer
   transform-origin: bottom right (défini en CSS) → le drawer grandit
   depuis le coin où se trouve la pill, avec dissolution du flou. */
const DRAWER_ANIM = trigger('drawerAnim', [
  transition(':enter', [
    style({
      transform: 'scale(0.82) translateY(16px)',
      opacity: 0,
      filter: 'blur(10px)',
    }),
    animate('520ms cubic-bezier(0.16, 1, 0.3, 1)', style({
      transform: 'scale(1) translateY(0)',
      opacity: 1,
      filter: 'blur(0px)',
    }))
  ]),
  transition(':leave', [
    animate('240ms cubic-bezier(0.4, 0, 1, 1)', style({
      transform: 'scale(0.88) translateY(10px)',
      opacity: 0,
      filter: 'blur(6px)',
    }))
  ])
]);

@Component({
  selector: 'app-cookie-banner',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './cookie-banner.component.html',
  styleUrl: './cookie-banner.component.scss',
  animations: [PILL_ANIM, PILL_BTNS_ANIM, DRAWER_ANIM]
})
export class CookieBannerComponent implements OnInit, OnDestroy {
  consent = inject(CookieConsentService);

  viewState = signal<CookieView>('pill');

  private timer: ReturnType<typeof setTimeout> | null = null;

  ngOnInit(): void {
    const isDesktop = window.matchMedia('(min-width: 561px)').matches;

    if (isDesktop) {
      /* Desktop : drawer ouvert dès l'arrivée, se replie après 10s puis boucle.
         Le drawer auto ne s'affiche qu'une seule fois par chargement de page. */
      this.viewState.set('drawer');
      this.timer = setTimeout(() => {
        if (this.viewState() === 'drawer') {
          this.viewState.set('pill');
          this.scheduleShowButtons();
        }
      }, 10000);
    } else {
      /* Mobile : démarre directement la boucle pill */
      this.scheduleShowButtons();
    }
  }

  ngOnDestroy(): void {
    this.clearTimer();
  }

  /* ── Loop : après 5s → affiche les boutons pendant 10s → masque → attend 5s → ... ── */

  /** Les deux boutons de la pilule → ouvrent simplement le drawer */
  showDrawer(): void {
    this.clearTimer();
    this.viewState.set('drawer');
  }

  /** Fermeture du drawer → retour pill simple + relance de la loop */
  showPill(): void {
    this.clearTimer();
    this.viewState.set('pill');
    this.scheduleShowButtons();
  }

  private scheduleShowButtons(): void {
    this.timer = setTimeout(() => {
      if (this.viewState() === 'pill') {
        this.viewState.set('pill-active');
        this.scheduleHideButtons();
      }
    }, 5000);
  }

  private scheduleHideButtons(): void {
    this.timer = setTimeout(() => {
      if (this.viewState() === 'pill-active') {
        this.viewState.set('pill');
        this.scheduleShowButtons(); // repart pour un tour
      }
    }, 10000);
  }

  private clearTimer(): void {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }
}
