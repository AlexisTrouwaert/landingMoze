import { Injectable, computed, signal, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import {environment} from "../../environements/environment.prod";

export interface UtilisateurInscriptionDTO {
  nom: string;
  prenom: string;
  email: string;
  telephonePersonnel: string;
  professionnel: {
    siret: string;
  };
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
  private apiUrl = `${environment.apiUrl}/mozeapp/inscription`;

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
  readonly finalOfferPrice = computed(() => {
    if (this.state().wantsTaxCredit === true) {
      return 29.90;
    }
    return 9.90;
  });

  // --- Actions ---
  setSector(sector: SectorType) {
    this.state.update(s => ({ ...s, sector }));
    this.nextStep();
  }

  setUserInfo(info: UtilisateurInscriptionDTO) {
    this.state.update(s => ({ ...s, userInfo: info }));
  }

  setHasSapNumber(hasSap: boolean) {
    this.state.update(s => ({ ...s, hasSapNumber: hasSap }));
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
    this.state.update(s => ({ ...s, step: Math.max(1, s.step - 1) }));
  }

  submitInscription(dto: UtilisateurInscriptionDTO) {
    return this.http.post(this.apiUrl, dto);
  }
}
