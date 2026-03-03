import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {debounceTime, distinctUntilChanged, filter, switchMap, catchError, finalize, tap} from 'rxjs/operators';
import { of } from 'rxjs';

import { FunnelService, UtilisateurInscriptionDTO } from "../../../../services/funnel.service";
// Pense à vérifier le chemin d'import selon ton arborescence
import { ValidationService } from '../../../../services/validation.service';

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

  // Injection du nouveau service dédié
  private validationService = inject(ValidationService);

  // --- SIGNAUX D'ÉTAT (Vérifications) ---
  isCheckingEmail = signal(false);
  emailExistsInBdd = signal(false);

  isLoadingSiret = signal(false);
  siretCheckFailed = signal(false);

  // --- GESTION DE L'IMAGE DYNAMIQUE ---
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

  currentImage = computed(() => {
    const s = this.fs.selectedSector();
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

  constructor() {
    this.setupEmailListener();
    this.setupSiretListener();
  }

  // --- LISTENERS DE VÉRIFICATION ---

  private setupEmailListener(): void {
    this.form.get('email')?.valueChanges.pipe(
      debounceTime(500),
      distinctUntilChanged(),
      filter((email): email is string => !!email && this.form.get('email')?.valid === true),
      switchMap(email => {
        this.isCheckingEmail.set(true);
        return this.validationService.validateEmail(email).pipe(
          catchError(() => of(false)),
          finalize(() => this.isCheckingEmail.set(false))
        );
      }),
      takeUntilDestroyed()
    ).subscribe(exists => {
      this.emailExistsInBdd.set(exists);
      const emailCtrl = this.form.get('email');

      if (exists) {
        emailCtrl?.setErrors({ emailExists: true });
      } else {
        if (emailCtrl?.hasError('emailExists')) {
          const errors = { ...emailCtrl.errors };
          delete errors['emailExists'];
          emailCtrl.setErrors(Object.keys(errors).length > 0 ? errors : null);
        }
      }
    });
  }

  private setupSiretListener(): void {
    this.form.get('siret')?.valueChanges.pipe(
      debounceTime(500),
      distinctUntilChanged(),
      filter((term): term is string => !!term && term.replace(/\s/g, '').length >= 9),
      switchMap(siret => {
        this.isLoadingSiret.set(true);
        this.siretCheckFailed.set(false);

        return this.validationService.getEtablissementInfo(siret).pipe(
          tap(res => console.log('✅ RÉPONSE API SIRET :', res)), // Regarde ta console navigateur !
          catchError((err) => {
            console.error('❌ ERREUR API SIRET :', err); // S'il y a une erreur HTTP, elle sera ici
            return of(null);
          }),
          finalize(() => this.isLoadingSiret.set(false))
        );
      }),
      takeUntilDestroyed()
    ).subscribe(response => {
      const siretCtrl = this.form.get('siret');

      // Si la réponse est OK et qu'elle contient bien un champ "siret"
      if (response && response.siret) {
        this.siretCheckFailed.set(false);
        if (siretCtrl?.hasError('siretInvalidAPI')) {
          const errors = { ...siretCtrl.errors };
          delete errors['siretInvalidAPI'];
          siretCtrl.setErrors(Object.keys(errors).length > 0 ? errors : null);
        }
      } else {
        this.siretCheckFailed.set(true);
        siretCtrl?.setErrors({ siretInvalidAPI: true });
      }
    });
  }

  // --- SOUMISSION ---

  submit() {
    if (this.form.valid && !this.emailExistsInBdd() && !this.siretCheckFailed()) {
      const val = this.form.value;
      const secteurChoisi = this.fs.selectedSector();
      const nomClean = val.nom!.trim().replace(/\s+/g, '');
      const prenomClean = val.prenom!.trim().replace(/\s+/g, '');
      const randomSuffix = Math.floor(100 + Math.random() * 900);
      const pseudoGenere = `${nomClean}${prenomClean}${randomSuffix}`;

      const dto: UtilisateurInscriptionDTO = {
        nom: val.nom!,
        prenom: val.prenom!,
        pseudo: pseudoGenere,
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
