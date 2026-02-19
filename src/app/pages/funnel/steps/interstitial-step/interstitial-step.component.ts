import { Component, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import {FunnelService, UtilisateurInscriptionDTO} from "../../../../services/funnel.service";

@Component({
  selector: 'app-interstitial-step',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './interstitial-step.component.html',
  styleUrl: './interstitial-step.component.scss'
})
export class InterstitialStepComponent {
  fs = inject(FunnelService);
  private fb = inject(FormBuilder);

  // --- GESTION DE L'IMAGE DYNAMIQUE ---
  // Mapping identique à l'étape précédente (SANS ACCENTS)
  imageMap: Record<string, string> = {
    DEFAULT: 'assets/images/tunnel/ACTIVITE.png',
    SANTE: 'assets/images/tunnel/SANTE.png',
    SAP: 'assets/images/tunnel/SAP.png',
    BTP: 'assets/images/tunnel/BTP.png',
    CREATIF: 'assets/images/tunnel/COM.png',
    CONSEIL: 'assets/images/tunnel/FORMATION.png',
    IMMO: 'assets/images/tunnel/IMMOBILIER.png',
    AUTRE: 'assets/images/tunnel/AUTRES ACTIVITES.png',
  };

  // Image calculée selon le secteur sélectionné dans le service
  currentImage = computed(() => {
    const s = this.fs.selectedSector(); // Récupère le secteur du state
    if (s && this.imageMap[s]) {
      return this.imageMap[s];
    }
    return this.imageMap['DEFAULT'];
  });

  // --- FORMULAIRE ---
  form = this.fb.group({
    nom: ['', Validators.required],
    prenom: ['', Validators.required],
    email: ['', [Validators.required, Validators.email]],
    telephone: ['', [Validators.required, Validators.pattern(/^(0|\+33)[6-7]([0-9]{2}){4}$/)]],
    siret: ['', [Validators.required, Validators.pattern(/^[0-9]{14}$/)]]
  });

  submit() {
    if (this.form.valid) {
      const val = this.form.value;
      const secteurChoisi = this.fs.selectedSector();
      const dto: UtilisateurInscriptionDTO = {
        nom: val.nom!,
        prenom: val.prenom!,
        email: val.email!,
        telephonePersonnel: val.telephone!,
        professionnel: {
          siret: val.siret!
        },
        communication: {
          secteur: secteurChoisi || 'AUTRE'
        }
      };
      console.log('Payload Inscription (JSON):', JSON.stringify(dto, null, 2));
      this.fs.setUserInfo(dto);
      this.fs.submitInscription(dto).subscribe({
        next: (response) => {
          console.log('Inscription réussie !', response);
          this.fs.nextStep();
        },
        error: (err) => {
          console.error('Erreur lors de l\'inscription :', err);
          this.fs.nextStep();
        }
      });
    } else {
      this.form.markAllAsTouched();
    }
  }

  // --- HELPERS TEXTE ---
  getSectorLabel(): string {
    const s = this.fs.selectedSector();
    switch(s) {
      case 'SANTE': return 'Santé & Paramédical';
      case 'SAP': return 'Services à la personne';
      case 'BTP': return 'BTP & Artisans';
      case 'CREATIF': return 'Créatifs & Communication';
      case 'CONSEIL': return 'Conseil & Formation';
      case 'IMMO': return 'Services immobilier';
      default: return 'Autre activité';
    }
  }

  getTitle(): string {
    const s = this.fs.selectedSector();
    switch(s) {
      case 'SANTE': return "ON S'OCCUPE AVEC SOIN DE TA GESTION.";
      case 'SAP': return "ON MET TON ACTIVITÉ AU CLAIR.";
      case 'BTP': return "ON STRUCTURE LE CHANTIER ADMINISTRATIF.";
      case 'CREATIF': return "ON POSE LE CADRE.";
      case 'CONSEIL': return "ON STRUCTURE POUR QUE TU PUISSES TOUT SUIVRE.";
      case 'IMMO': return "ON CADRE TES TRANSACTIONS.";
      default: return "INCLASSABLE ? ON AIME ÇA.";
    }
  }

  getSubtitle(): string {
    const s = this.fs.selectedSector();
    switch(s) {
      case 'SANTE': return "Tes patients sont déjà entre de bonnes mains. Confie-nous la partie administrative.";
      case 'SAP': return "Tu simplifies la vie des autres. On va simplifier ta gestion.";
      case 'BTP': return "Tu gères le terrain. On gère le cadre.";
      case 'CREATIF': return "Promis, aucun tableau Excel ne te jugera ici.";
      case 'CONSEIL': return "Tu transmets ton savoir aux autres. On s'assure que ta gestion soit à la hauteur.";
      case 'IMMO': return "Du mandat à l'encaissement, ta gestion reste carrée.";
      default: return "Ton métier est unique. Ta gestion peut l'être aussi. Et simplement.";
    }
  }
}
