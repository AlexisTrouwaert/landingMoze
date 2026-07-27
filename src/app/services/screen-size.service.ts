import { isPlatformBrowser } from '@angular/common';
import { inject, Injectable, PLATFORM_ID } from '@angular/core';
import { BehaviorSubject, fromEvent, Observable } from 'rxjs';

/** Largeur supposée au rendu serveur : il n'y a pas de fenêtre à mesurer. */
const SSR_WIDTH = 1200;

@Injectable({
  providedIn: 'root'
})
export class ScreenSizeService {

  private readonly platformId = inject(PLATFORM_ID);

  private screenSizeSubject = new BehaviorSubject<number>(0);
  public screenSize$: Observable<number> = this.screenSizeSubject.asObservable();

  constructor() {
    // Le service est instancié pendant le prérendu de `/`, où ni `window` ni
    // ses événements n'existent : on émet une largeur de repli et on n'écoute
    // rien. Le client recalcule la vraie valeur dès l'hydratation.
    if (!isPlatformBrowser(this.platformId)) {
      this.screenSizeSubject.next(SSR_WIDTH);
      return;
    }

    this.calculateScreenSize();

    fromEvent(window, 'resize').subscribe(() => {
      this.calculateScreenSize();
    })
  }

  calculateScreenSize() {
    this.screenSizeSubject.next(window.innerWidth)
  }
}
