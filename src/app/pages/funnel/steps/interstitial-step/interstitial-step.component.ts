import { Component, computed, DestroyRef, inject, signal, isDevMode } from '@angular/core';

import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { debounceTime, distinctUntilChanged, filter, switchMap, catchError, finalize, tap, map } from 'rxjs/operators';
import { of } from 'rxjs';
import { FunnelService, UtilisateurInscriptionDTO } from "../../../../services/funnel.service";
import { ValidationService } from '../../../../services/validation.service';
import { MetaPixelService } from "../../../../services/meta-pixel.service";
import { BrevoService } from "../../../../services/brevo.service";
import { GoogleAnalyticsService } from "../../../../services/google-analytics.service";

@Component({
    selector: 'app-interstitial-step',
    imports: [ReactiveFormsModule],
    templateUrl: './interstitial-step.component.html',
    styleUrl: './interstitial-step.component.scss'
})
export class InterstitialStepComponent {
  fs = inject(FunnelService);
  private fb = inject(FormBuilder);
  private destroyRef = inject(DestroyRef);
  private validationService = inject(ValidationService);
  private metaPixelService = inject(MetaPixelService);
  private brevoService = inject(BrevoService);
  private googleAnalyticsService = inject(GoogleAnalyticsService);

  // --- SIGNAUX D'ÉTAT ---
  isCheckingEmail = signal(false);
  emailExistsInBdd = signal(false);
  isSubmitting = signal(false);
  submissionError = signal<string | null>(null);

  // Horodatage d'affichage du formulaire — utilisé conjointement au honeypot pour
  // distinguer un vrai bot (remplissage quasi instantané) d'un autofill légitime
  // (utilisateur humain dont le password manager a rempli le honeypot après plusieurs secondes).
  private readonly formRenderedAt = Date.now();
  private readonly minHumanFillMs = 2000;

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
    pixelConsent: [false],
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

      const honeypotFilled = !!this.form.value.honeypot;
      const elapsedMs = Date.now() - this.formRenderedAt;
      const tooFast = elapsedMs < this.minHumanFillMs;

      if (honeypotFilled && tooFast) {
        // Honeypot rempli + soumission quasi instantanée → vrai bot, on bloque.
        console.warn('Bot détecté (honeypot + soumission rapide).');
        this.metaPixelService.trackFunnelAbandoned(3, 'honeypot_triggered');
        this.brevoService.trackFunnelAbandoned(3, 'honeypot_triggered');
        this.googleAnalyticsService.trackFunnelAbandoned(3, 'honeypot_triggered');
        return;
      }

      if (honeypotFilled && !tooFast) {
        // Honeypot rempli mais durée plausible → autofill légitime, on laisse passer.
        console.warn('Honeypot rempli après délai humain — autofill probable, soumission autorisée.');
      }

      this.submissionError.set(null);
      this.isSubmitting.set(true);

      const val = this.form.value;
      const secteurChoisi = this.fs.selectedSector();

      // Normalisation Unicode : sur macOS/Safari, l'autocorrect peut remplacer ' par ' (U+2019),
      // " par " (U+201C/U+201D), - par – (U+2013), etc. Certains WAF (ModSecurity OWASP CRS)
      // ne reconnaissent pas ces variantes comme équivalentes et peuvent flagger le payload.
      // On normalise en NFKC + on remplace les ponctuations "smart" par leur équivalent ASCII.
      const sanitize = (s: string): string => s
        .normalize('NFKC')
        .replace(/[‘’‚‛′]/g, "'") // apostrophes typographiques → '
        .replace(/[“”„‟″]/g, '"') // guillemets typographiques → "
        .replace(/[–—−]/g, '-')             // tirets longs → -
        .replace(/…/g, '...')                          // ellipsis → ...
        .replace(/[   ]/g, ' ')              // espaces insécables → espace
        .trim();

      const nomSan = sanitize(val.nom!);
      const prenomSan = sanitize(val.prenom!);
      const emailSan = sanitize(val.email!).toLowerCase();
      const telSan = sanitize(val.telephone!).replace(/\s+/g, '');

      const nomClean = nomSan.replace(/\s+/g, '');
      const prenomClean = prenomSan.replace(/\s+/g, '');
      const randomSuffix = Math.floor(100 + Math.random() * 900);
      const pseudoGenere = `${nomClean}${prenomClean}${randomSuffix}`;

      // Données de dédup Pixel + Conversions API, jointes à l'inscription (voir META_CAPI_SPEC.md).
      const conv = this.metaPixelService.buildConversionMeta();

      const dto: UtilisateurInscriptionDTO = {
        nom: nomSan,
        prenom: prenomSan,
        pseudo: pseudoGenere,
        email: emailSan,
        telephonePersonnel: telSan,
        communication: {
          secteur: secteurChoisi || 'AUTRE'
        },
        meta: conv
      };

      if (isDevMode()) {
        console.log('Payload Inscription (JSON):', JSON.stringify(dto, null, 2));
      }
      this.fs.setUserInfo(dto);

      if (window.location.hostname === 'localhost') {
        // DEV : le POST est court-circuité, mais on fire quand même la conversion vers les
        // IDs de TEST (GA + pixel Meta de environment.ts) pour valider la chaîne en local.
        console.log('[DEV] Soumission ignorée sur localhost — conversion envoyée vers les IDs de test.');
        this.fireConversionTracking(conv.eventId, {
          sector: secteurChoisi || 'AUTRE',
          wants_tax_credit: this.fs.hasSapNumber() ?? false,
          opt_in_newsletter: val.optIn ?? false,
        });
        this.isSubmitting.set(false);
        this.fs.nextStep(); // Passage à l'étape 4
        return;
      }

      this.fs.submitInscription(dto).subscribe({
        next: (response) => {
          this.fireConversionTracking(conv.eventId, {
            sector: secteurChoisi || 'AUTRE',
            wants_tax_credit: this.fs.hasSapNumber() ?? false,
            opt_in_newsletter: val.optIn ?? false,
          });

          // Brevo tracker : on rattache tout le parcours (anonyme jusqu'ici) au contact
          // via son email (= la conversion), puis on marque l'event d'inscription.
          this.brevoService.identify(emailSan, {
            PRENOM: prenomSan,
            NOM: nomSan,
            SECTEUR: secteurChoisi || 'AUTRE',
          });
          this.brevoService.trackCompleteRegistration({
            sector: secteurChoisi || 'AUTRE',
            wants_tax_credit: this.fs.hasSapNumber() ?? false,
            opt_in_newsletter: val.optIn ?? false,
          });

          if (val.optIn) {
            this.subscribeToBrevo(val.email!);
          }

          this.isSubmitting.set(false);
          this.fs.nextStep(); // Passage à l'étape 4
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

  /**
   * Fire la conversion vers Meta (CompleteRegistration) + GA4 (sign_up), avec l'eventId de dédup.
   * Utilisé par le POST réel (prod) ET par la branche localhost (envoie vers les IDs de TEST).
   */
  private fireConversionTracking(eventId: string, params: Record<string, any>): void {
    this.metaPixelService.trackCompleteRegistration(params, eventId);
    this.googleAnalyticsService.trackSignUp('email', params);
  }

  // --- ACTIONS DES ÉCRANS RÉSULTAT ---
  /** Image 1 (succès) → bouton principal : on continue vers l'étape 4 (redirect-step). */
  continueToStep4(): void {
    this.fs.nextStep();
  }

  /**
   * Boutons « Mot de passe oublié » (image 2) et « Je n'ai pas reçu l'email » (image 1) :
   * déclenche l'envoi d'un lien de réinitialisation. Réponse neutre (anti-énumération de comptes).
   */
  requestPasswordReset(): void {
    const email = this.form.get('email')?.value;
    if (!email || this.resetSending()) return;

    this.resetMessage.set(null);

    if (window.location.hostname === 'localhost') {
      // DEV : pas d'appel API (CORS). On simule la réponse neutre.
      this.resetMessage.set('Si un compte existe avec cet email, un lien de réinitialisation a été envoyé.');
      return;
    }

    this.resetSending.set(true);
    this.fs.requestPasswordReset(email).pipe(
      finalize(() => this.resetSending.set(false)),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe({
      next: () => this.resetMessage.set('Si un compte existe avec cet email, un lien de réinitialisation a été envoyé.'),
      error: () => this.resetMessage.set('Une erreur est survenue, réessaie dans un instant.'),
    });
  }

  /** Image 2 (compte existant) → aller se connecter. */
  goToConnexion(): void {
    window.location.href = 'https://app.mozeconnect.fr/connexion';
  }

  /** Image 2 (compte existant) → revenir au formulaire pour saisir une autre adresse. */
  useAnotherEmail(): void {
    this.emailExistsInBdd.set(false);
    this.resetMessage.set(null);
    this.form.get('email')?.reset('');
    this.view.set('form');
  }

  // --- LOGIQUE BREVO ---
  private subscribeToBrevo(email: string) {
    const bodyParams = new URLSearchParams();
    bodyParams.append('EMAIL', email);
    bodyParams.append('OPT_IN', '1');
    // Consentement au pixel de suivi (CNIL) — champ _PIXEL_TRACKING_CONSENT du form Brevo. 1 = accepte, 0 = refuse.
    bodyParams.append('_PIXEL_TRACKING_CONSENT', this.form.value.pixelConsent ? '1' : '0');
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
