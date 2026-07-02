import { Injectable, computed, signal, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import {environment} from "../../environements/environment.prod";
import { MetaPixelService } from './meta-pixel.service';
import { BrevoService } from './brevo.service';

export interface UtilisateurInscriptionDTO {
  nom: string;
  prenom: string;
  pseudo: string;
  email: string;
  telephonePersonnel: string;
  communication: {
    secteur: string;
  };
}

export type SectorType = 'SANTE' | 'SAP' | 'BTP' | 'CREATIF' | 'CONSEIL' | 'IMMO' | 'AUTRE';

export interface FunnelState {
  step: number;
  sector: SectorType | null;
  wantsTaxCredit: boolean | null; // Étape 2
  hasSapNumber: boolean | null;   // Étape 3
  userInfo: UtilisateurInscriptionDTO | null; // Étape 4
}

@Injectable({
  providedIn: 'root'
})
export class FunnelService {

  private http = inject(HttpClient);
  private readonly metaPixel = inject(MetaPixelService);
  private readonly brevo = inject(BrevoService);
  /** Bases d'API — bascule prod / test (test activé via /commencer?test). */
  private readonly PROD_API = 'https://app.mozeconnect.fr';
  private readonly TEST_API = 'https://nico.by-moze.fr';
  private apiUrl = this.PROD_API;

  private state = signal<FunnelState>({
    step: 1,
    sector: null,
    userInfo: null,
    hasSapNumber: null,
    wantsTaxCredit: null
  });

  // --- Selectors ---
  readonly currentStep = computed(() => this.state().step);
  readonly selectedSector = computed(() => this.state().sector);
  readonly finalOfferPrice = computed(() => { if (this.state().wantsTaxCredit === true) { return 29.90; } return 9.90; });
  readonly userInfo = computed(() => this.state().userInfo);
  readonly wantsTaxCredit = computed(() => this.state().wantsTaxCredit);
  readonly hasSapNumber = computed(() => this.state().hasSapNumber);

  // --- Nouvelles Actions (Appels HTTP) ---
  // Getters : recalculés à chaque appel pour suivre la bascule prod/test de `apiUrl`.
  private get inscriptionApiUrl() { return `${this.apiUrl}/mozeapp/inscription`; }
  private get abonnementsApiUrl() { return `${this.apiUrl}/mozeapp/abonnements/public/subscribe`; }
  private get motDePasseOublieUrl() { return `${this.apiUrl}/mozeapp/mot-de-passe-oublie`; }

  /** Bascule les appels du funnel vers les serveurs de test (nico.by-moze.fr). */
  useTestServer(enabled: boolean): void {
    this.apiUrl = enabled ? this.TEST_API : this.PROD_API;
  }

  // --- Actions ---
  setSector(sector: SectorType) {
    this.state.update(s => ({ ...s, sector }));
    this.metaPixel.trackFunnelStep1Completed(sector);
    this.brevo.trackFunnelStep1Completed(sector);
    this.nextStep();
  }

  setUserInfo(info: UtilisateurInscriptionDTO) {
    this.state.update(s => ({ ...s, userInfo: info }));
  }

  setHasSapNumber(hasSap: boolean) {
    this.state.update(s => ({ ...s, hasSapNumber: hasSap }));
    // Sémantiquement le step 2 demande "veux-tu le crédit d'impôt immédiat ?" — on tracke avec ce nom business.
    this.metaPixel.trackFunnelStep2Completed(hasSap);
    this.brevo.trackFunnelStep2Completed(hasSap);
    this.nextStep();
  }

  setWantsTaxCredit(wants: boolean) {
    this.state.update(s => ({ ...s, wantsTaxCredit: wants }));
    this.nextStep();
  }

  nextStep() {
    this.state.update(s => ({ ...s, step: s.step + 1 }));
  }

  previousStep() {
    const currentStep = this.state().step;
    this.metaPixel.trackFunnelAbandoned(currentStep, 'back_button');
    this.brevo.trackFunnelAbandoned(currentStep, 'back_button');
    this.state.update(s => ({ ...s, step: Math.max(1, s.step - 1) }));
  }

  submitInscription(dto: UtilisateurInscriptionDTO) {
    return this.http.post(this.inscriptionApiUrl, dto, { responseType: 'text' });
  }

  /**
   * Demande l'envoi d'un lien de réinitialisation de mot de passe.
   * Réponse volontairement neutre côté back (anti-énumération de comptes).
   */
  requestPasswordReset(email: string) {
    return this.http.post(this.motDePasseOublieUrl, { email }, { responseType: 'text' });
  }

  subscribePremium(email: string, withSap: boolean, withCoop: boolean, origine: string) {
    return this.http.post(`${this.abonnementsApiUrl}/custom`, {
      email: email,
      withSap: withSap,
      withCoop: withCoop,
      origine: 'moze.fr'
    }, { responseType: 'text' });
  }

  subscribeCustom(email: string, withSap: boolean, withCoop: boolean, origine: string) {
    return this.http.post(`${this.abonnementsApiUrl}/custom`, {
      email: email,
      withSap: withSap,
      withCoop: withCoop,
      origine: 'moze.fr'
    }, { responseType: 'text' });
  }
}
