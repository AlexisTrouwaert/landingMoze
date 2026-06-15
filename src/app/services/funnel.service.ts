import { Injectable, computed, signal, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import {environment} from "../../environements/environment.prod";
import { MetaPixelService } from './meta-pixel.service';

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

/**
 * Type de tunnel d'inscription :
 * - 'facturation' : parcours historique (cartes Freemium / Indép +) → /commencer
 * - 'reseau'      : parcours dédié à la carte Réseau social → /rejoindre
 * Détermine les étapes affichées et la destination finale.
 */
export type FunnelType = 'facturation' | 'reseau';

/**
 * Sphère (communauté MozePlace) proposée dans le funnel réseau, entre le secteur
 * et l'inscription. Données saisies à la main pour l'instant ; `inviteLink` est le
 * lien d'invitation qui sert de destination finale après inscription.
 */
export interface Sphere {
  id: string;
  name: string;
  emoji?: string;            // emoji/icône optionnel ; à défaut, une pastille (initiales + dégradé) est générée
  description: string;        // accroche courte (rail)
  longDescription?: string;   // description détaillée affichée quand la sphère est sélectionnée (vedette)
  location: string;       // localisation (texte libre pour l'instant — version limitée à venir)
  tags: string[];         // compétences / thématiques
  memberCount?: number;
  inviteLink: string;     // lien d'invitation MozePlace (fourni à la main)
}

export interface FunnelState {
  step: number;
  maxStep: number;                // Étape la plus avancée atteinte (pour le fil d'Ariane cliquable)
  sector: SectorType | null;
  wantsTaxCredit: boolean | null; // Étape 2
  hasSapNumber: boolean | null;   // Étape 3
  userInfo: UtilisateurInscriptionDTO | null; // Étape 4
  selectedSphere: Sphere | null;  // Funnel réseau : sphère choisie (sert de destination finale)
  funnelType: FunnelType;
}

@Injectable({
  providedIn: 'root'
})
export class FunnelService {

  private http = inject(HttpClient);
  private readonly metaPixel = inject(MetaPixelService);
  // private apiUrl = `https://nico.by-moze.fr`;
  private apiUrl = `https://app.mozeconnect.fr`;

  private state = signal<FunnelState>({
    step: 1,
    maxStep: 1,
    sector: null,
    userInfo: null,
    hasSapNumber: null,
    wantsTaxCredit: null,
    selectedSphere: null,
    funnelType: 'facturation'
  });

  // --- Selectors ---
  readonly currentStep = computed(() => this.state().step);
  readonly maxStep = computed(() => this.state().maxStep);
  readonly selectedSector = computed(() => this.state().sector);
  readonly selectedSphere = computed(() => this.state().selectedSphere);
  readonly finalOfferPrice = computed(() => { if (this.state().wantsTaxCredit === true) { return 29.90; } return 9.90; });
  readonly userInfo = computed(() => this.state().userInfo);
  readonly wantsTaxCredit = computed(() => this.state().wantsTaxCredit);
  readonly hasSapNumber = computed(() => this.state().hasSapNumber);
  readonly funnelType = computed(() => this.state().funnelType);

  /**
   * Démarre (ou redémarre) un tunnel : réinitialise tout l'état à l'étape 1 et
   * fixe son type. Appelé à l'entrée de chaque funnel pour éviter qu'un état
   * résiduel (parcours précédent) ne fausse l'étape de départ ou la destination.
   */
  startFunnel(type: FunnelType = 'facturation') {
    this.state.set({
      step: 1,
      maxStep: 1,
      sector: null,
      userInfo: null,
      hasSapNumber: null,
      wantsTaxCredit: null,
      selectedSphere: null,
      funnelType: type
    });
  }

  /**
   * Navigation directe via le fil d'Ariane. Autorisée uniquement vers une étape
   * déjà atteinte (≤ maxStep) — interdit de sauter en avant des étapes non
   * complétées (secteur/formulaire requis). Ne re-déclenche aucun event de
   * complétion ni de soumission : c'est une simple navigation d'affichage.
   */
  goToStep(target: number) {
    this.state.update(s => {
      if (target < 1 || target > s.maxStep) return s;
      return { ...s, step: target };
    });
  }

  // --- Nouvelles Actions (Appels HTTP) ---
  private inscriptionApiUrl = `${this.apiUrl}/mozeapp/inscription`;
  private abonnementsApiUrl = `${this.apiUrl}/mozeapp/abonnements/public/subscribe`;

  // --- Actions ---
  setSector(sector: SectorType) {
    this.state.update(s => ({ ...s, sector }));
    this.metaPixel.trackFunnelStep1Completed(sector, this.state().funnelType);
    this.nextStep();
  }

  /** Funnel réseau : sélection d'une sphère (étape 2) → on avance vers l'inscription. */
  setSphere(sphere: Sphere) {
    this.state.update(s => ({ ...s, selectedSphere: sphere }));
    // NB: pas de pixel ici pour l'instant (à instrumenter si besoin, cf. conventions Meta).
    this.nextStep();
  }

  setUserInfo(info: UtilisateurInscriptionDTO) {
    this.state.update(s => ({ ...s, userInfo: info }));
  }

  setHasSapNumber(hasSap: boolean) {
    this.state.update(s => ({ ...s, hasSapNumber: hasSap }));
    // Sémantiquement le step 2 demande "veux-tu le crédit d'impôt immédiat ?" — on tracke avec ce nom business.
    this.metaPixel.trackFunnelStep2Completed(hasSap);
    this.nextStep();
  }

  setWantsTaxCredit(wants: boolean) {
    this.state.update(s => ({ ...s, wantsTaxCredit: wants }));
    this.nextStep();
  }

  nextStep() {
    this.state.update(s => {
      const step = s.step + 1;
      return { ...s, step, maxStep: Math.max(s.maxStep, step) };
    });
  }

  /** Recul d'une étape — navigation intra-funnel, ce n'est PAS un abandon. */
  previousStep() {
    this.state.update(s => ({ ...s, step: Math.max(1, s.step - 1) }));
  }

  submitInscription(dto: UtilisateurInscriptionDTO) {
    return this.http.post(this.inscriptionApiUrl, dto, { responseType: 'text' });
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
