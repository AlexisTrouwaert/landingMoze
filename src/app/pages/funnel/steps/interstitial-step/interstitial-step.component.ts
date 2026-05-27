import { Component, computed, DestroyRef, inject, signal, isDevMode } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { debounceTime, distinctUntilChanged, filter, switchMap, catchError, finalize, tap, map } from 'rxjs/operators';
import { of } from 'rxjs';
import { FunnelService, UtilisateurInscriptionDTO } from "../../../../services/funnel.service";
import { ValidationService } from '../../../../services/validation.service';
import { MetaPixelService } from "../../../../services/meta-pixel.service";

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
  private destroyRef = inject(DestroyRef);
  private validationService = inject(ValidationService);
  private metaPixelService = inject(MetaPixelService);

  // --- SIGNAUX D'ÉTAT (Vérifications et Soumission) ---
  isCheckingEmail = signal(false);
  emailExistsInBdd = signal(false);

  isSubmitting = signal(false);
  submissionError = signal<string | null>(null);

  // --- GESTION DE L'IMAGE DYNAMIQUE ---
  imageMap: Record<string, string> = {
    DEFAULT: 'assets/images/tunnel/ACTIVITE.webp',
    SANTE: 'assets/images/tunnel/SANTE.webp',
    SAP: 'assets/images/tunnel/SAP.webp',
    BTP: 'assets/images/tunnel/BTP.webp',
    CREATIF: 'assets/images/tunnel/COM.webp',
    CONSEIL: 'assets/images/tunnel/FORMATION.webp',
    IMMO: 'assets/images/tunnel/IMMOBILIER.webp',
    AUTRE: 'assets/images/tunnel/AUTRES ACTIVITES.webp',
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
    optIn: [false],
    honeypot: ['']
  });

  constructor() {
    this.setupEmailListener();
  }

  // --- LISTENERS DE VÉRIFICATION ---

  private setupEmailListener(): void {
    const emailCtrl = this.form.get('email');

    emailCtrl?.valueChanges.pipe(
      tap(email => {
        if (email && email !== email.toLowerCase()) {
          emailCtrl.setValue(email.toLowerCase(), { emitEvent: false });
        }
      }),
      map(email => email?.toLowerCase() || ''),
      debounceTime(500),
      distinctUntilChanged(),
      filter((email): email is string => !!email && emailCtrl?.valid === true),
      switchMap(email => {
        if (window.location.hostname === 'localhost') {
          return of(false);
        }
        this.isCheckingEmail.set(true);
        return this.validationService.validateEmail(email).pipe(
          catchError(() => of(false)),
          finalize(() => this.isCheckingEmail.set(false))
        );
      }),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe(exists => {
      this.emailExistsInBdd.set(exists);

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

  // --- SOUMISSION ---

  submit() {
    if (this.form.valid && !this.emailExistsInBdd()) {

      if (this.form.value.honeypot) {
        console.warn('Bot détecté.');
        return;
      }

      this.submissionError.set(null);
      this.isSubmitting.set(true);

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
        communication: {
          secteur: secteurChoisi || 'AUTRE'
        }
      };

      if (isDevMode()) {
        console.log('Payload Inscription (JSON):', JSON.stringify(dto, null, 2));
      }
      this.fs.setUserInfo(dto);

      if (window.location.hostname === 'localhost') {
        console.log('[DEV] Soumission ignorée sur localhost.');
        this.isSubmitting.set(false);
        window.location.href = 'https://nico.by-moze.fr/dashboard';
        return;
      }

      this.fs.submitInscription(dto).subscribe({
        next: (response) => {
          this.metaPixelService.trackCompleteRegistration({
            sector: secteurChoisi || 'AUTRE',
            wants_tax_credit: this.fs.hasSapNumber() ?? false,
            opt_in_newsletter: val.optIn ?? false,
          });
          if (val.optIn) {
            this.subscribeToBrevo(val.email!);
          }

          this.isSubmitting.set(false);

          // Redirection directe vers l'application
          window.location.href = 'https://app.mozeconnect.fr/';
        },
        error: (err) => {
          if (isDevMode()) {
            console.error('Erreur lors de l\'inscription :', err);
          }
          this.isSubmitting.set(false);
          this.submissionError.set("Une erreur est survenue, veuillez réessayer ultérieurement.");
        }
      });
    } else {
      this.form.markAllAsTouched();
    }
  }

  // --- LOGIQUE BREVO ---
  private subscribeToBrevo(email: string) {
    const bodyParams = new URLSearchParams();
    bodyParams.append('EMAIL', email);
    bodyParams.append('OPT_IN', '1');
    bodyParams.append('email_address_check', '');
    bodyParams.append('locale', 'fr');

    const brevoUrl = 'https://c1020106.sibforms.com/serve/MUIFAPCu8l9auir9gfCkLC5J0P0Mxj8KhfZ67iKAc2LnMz7BXxGM_c_jsIyHtnsNJBq6CJ8ZdY2El0-p6nEhayeC1hFc7uRilk0KUJVj3l_l7WBFdoyNKlJbYaux9c2MEM6-RkODXtF3QKfKEj4uVIZB-7PjNvHorEYZUetyaJGlRyjlX0pxWj82chrO3PbomQVHxEZk6PA2wBY6';

    fetch(brevoUrl, {
      method: 'POST',
      body: bodyParams,
      mode: 'no-cors'
    }).catch(err => console.error('Erreur silencieuse Brevo:', err));
  }

  // --- HELPERS TEXTE ---
  readonly sectorLabel = computed(() => {
    switch (this.fs.selectedSector()) {
      case 'SANTE':  return 'Santé & Paramédical';
      case 'SAP':    return 'Services à la personne';
      case 'BTP':    return 'BTP & Artisans';
      case 'CREATIF': return 'Créatifs & Communication';
      case 'CONSEIL': return 'Conseil & Formation';
      case 'IMMO':   return 'Services immobilier';
      default:       return 'Autre activité';
    }
  });

  readonly sectorTitle = computed(() => {
    switch (this.fs.selectedSector()) {
      case 'SANTE':  return "ON S'OCCUPE AVEC SOIN DE TA GESTION.";
      case 'SAP':    return "ON MET TON ACTIVITÉ AU CLAIR.";
      case 'BTP':    return "ON STRUCTURE LE CHANTIER ADMINISTRATIF.";
      case 'CREATIF': return "ON POSE LE CADRE.";
      case 'CONSEIL': return "ON STRUCTURE POUR QUE TU PUISSES TOUT SUIVRE.";
      case 'IMMO':   return "ON CADRE TES TRANSACTIONS.";
      default:       return "INCLASSABLE ? ON AIME ÇA.";
    }
  });

  readonly sectorSubtitle = computed(() => {
    switch (this.fs.selectedSector()) {
      case 'SANTE':  return "Tes patients sont déjà entre de bonnes mains. Confie-nous la partie administrative.";
      case 'SAP':    return "Tu simplifies la vie des autres. On va simplifier ta gestion.";
      case 'BTP':    return "Tu gères le terrain. On gère le cadre.";
      case 'CREATIF': return "Promis, aucun tableau Excel ne te jugera ici.";
      case 'CONSEIL': return "Tu transmets ton savoir aux autres. On s'assure que ta gestion soit à la hauteur.";
      case 'IMMO':   return "Du mandat à l'encaissement, ta gestion reste carrée.";
      default:       return "Ton métier est unique. Ta gestion peut l'être aussi. Et simplement.";
    }
  });
}
