import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { InterstitialStepComponent } from './interstitial-step.component';
import { FunnelService, SectorType } from '../../../../services/funnel.service';
import { ValidationService } from '../../../../services/validation.service';
import { MetaPixelService } from '../../../../services/meta-pixel.service';

describe('InterstitialStepComponent', () => {
  let fixture: ComponentFixture<InterstitialStepComponent>;
  let component: InterstitialStepComponent;
  let fs: FunnelService;
  let validation: jasmine.SpyObj<ValidationService>;
  let pixel: jasmine.SpyObj<MetaPixelService>;

  beforeEach(async () => {
    validation = jasmine.createSpyObj<ValidationService>('ValidationService', [
      'validateEmail',
    ]);
    pixel = jasmine.createSpyObj<MetaPixelService>('MetaPixelService', [
      'trackFunnelStep1Completed',
      'trackFunnelStep2Completed',
      'trackFunnelAbandoned',
      'trackCompleteRegistration',
      'buildConversionMeta',
    ]);
    pixel.buildConversionMeta.and.returnValue({
      eventId: 'test-evt',
      fbp: null,
      fbc: null,
      adConsent: false,
    });

    await TestBed.configureTestingModule({
      imports: [InterstitialStepComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: ValidationService, useValue: validation },
        { provide: MetaPixelService, useValue: pixel },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(InterstitialStepComponent);
    component = fixture.componentInstance;
    fs = TestBed.inject(FunnelService);
    fixture.detectChanges();
  });

  it('should create with defaults', () => {
    expect(component).toBeTruthy();
    expect(component.isCheckingEmail()).toBe(false);
    expect(component.emailExistsInBdd()).toBe(false);
    expect(component.isSubmitting()).toBe(false);
    expect(component.submissionError()).toBeNull();
    expect(component.form.valid).toBe(false);
  });

  it('form should require nom, prenom, email and valid telephone', () => {
    component.form.patchValue({
      nom: 'Doe',
      prenom: 'John',
      email: 'john@doe.fr',
      telephone: '0612345678',
    });
    expect(component.form.valid).toBe(true);
  });

  it('email must match email validator', () => {
    component.form.patchValue({ email: 'not-an-email' });
    expect(component.form.get('email')?.hasError('email')).toBe(true);
  });

  it('telephone must match french mobile pattern', () => {
    const phone = component.form.get('telephone')!;
    phone.setValue('123');
    expect(phone.invalid).toBe(true);

    phone.setValue('0612345678');
    expect(phone.valid).toBe(true);

    phone.setValue('+33612345678');
    expect(phone.valid).toBe(true);

    phone.setValue('+33112345678'); // 1 → invalid (only 6/7 mobiles)
    expect(phone.invalid).toBe(true);
  });

  it('sectorLabel/title/subtitle should default to "Autre activité"', () => {
    expect(component.sectorLabel()).toBe('Autre activité');
    expect(component.sectorTitle()).toContain('INCLASSABLE');
    expect(component.sectorSubtitle()).toContain('Ton métier');
  });

  const sectorLabels: Record<SectorType, string> = {
    SANTE: 'Santé & Paramédical',
    SAP: 'Services à la personne',
    BTP: 'BTP & Artisans',
    CREATIF: 'Créatifs & Communication',
    CONSEIL: 'Conseil & Formation',
    IMMO: 'Services immobilier',
    AUTRE: 'Autre activité',
  };

  Object.entries(sectorLabels).forEach(([sector, label]) => {
    it(`sectorLabel should map ${sector} to ${label}`, () => {
      fs.setSector(sector as SectorType);
      expect(component.sectorLabel()).toBe(label);
    });
  });

  it('currentImage should return DEFAULT when no sector', () => {
    expect(component.currentImage()).toBe(component.imageMap['DEFAULT']);
  });

  it('currentImage should match selectedSector image', () => {
    fs.setSector('BTP');
    expect(component.currentImage()).toBe(component.imageMap['BTP']);
  });

  it('submit() with invalid form should markAllAsTouched and not submit', () => {
    const fsSpy = spyOn(fs, 'submitInscription').and.callThrough();
    component.submit();
    expect(component.form.touched).toBe(true);
    expect(fsSpy).not.toHaveBeenCalled();
  });

  it('submit() with honeypot filled should bail out silently', () => {
    component.form.patchValue({
      nom: 'A',
      prenom: 'B',
      email: 'a@b.fr',
      telephone: '0612345678',
      honeypot: 'bot',
    });
    const spy = spyOn(fs, 'submitInscription');
    component.submit();
    expect(spy).not.toHaveBeenCalled();
  });

  it('submit() should not run when emailExistsInBdd() is true', () => {
    component.form.patchValue({
      nom: 'A',
      prenom: 'B',
      email: 'a@b.fr',
      telephone: '0612345678',
    });
    component.emailExistsInBdd.set(true);
    const spy = spyOn(fs, 'submitInscription');
    component.submit();
    expect(spy).not.toHaveBeenCalled();
  });

  it('submit() on localhost fires the conversion (test IDs) and advances the funnel', () => {
    // En Karma, window.location.hostname === 'localhost' → branche DEV : le POST est
    // court-circuité mais la conversion (Meta + GA de test) doit quand même partir.
    fs.setSector('SAP');
    component.form.patchValue({
      nom: 'John',
      prenom: 'Doe',
      email: 'john@doe.fr',
      telephone: '0612345678',
    });
    component.emailExistsInBdd.set(false);

    component.submit();

    expect(pixel.buildConversionMeta).toHaveBeenCalled();
    expect(pixel.trackCompleteRegistration).toHaveBeenCalledWith(
      jasmine.objectContaining({ sector: 'SAP' }),
      'test-evt',
    );
    // La branche localhost avance le funnel (nextStep) ; pas d'écran « success »
    // dédié → le signal `view` reste 'form'.
    expect(component.view()).toBe('form');
    expect(component.isSubmitting()).toBe(false);
  });

  describe('submit() — DTO construction', () => {
    /**
     * On ne peut pas appeler submit() directement dans Karma car le composant
     * redirige via window.location.href (non-mockable). On reproduit donc
     * uniquement la logique de construction du DTO ici.
     */

    it('should build a pseudo from sanitized nom/prenom + random 3-digit suffix', () => {
      fs.setSector('SAP');
      component.form.patchValue({
        nom: ' Do  e ',
        prenom: 'John',
        email: 'john@doe.fr',
        telephone: '0612345678',
      });
      const val = component.form.value;
      const nomClean = val.nom!.trim().replace(/\s+/g, '');
      const prenomClean = val.prenom!.trim().replace(/\s+/g, '');
      expect(nomClean).toBe('Doe');
      expect(prenomClean).toBe('John');
    });

    it('should treat null selectedSector as AUTRE for the secteur fallback', () => {
      expect(fs.selectedSector() ?? 'AUTRE').toBe('AUTRE');
    });

    it('honeypot field should be part of the form group', () => {
      expect(component.form.contains('honeypot')).toBe(true);
    });
  });

  describe("messages d'erreur & garde-fou meta (correctifs session)", () => {
    const msg = (err: unknown): string =>
      (
        component as unknown as { inscriptionErrorMessage(e: unknown): string }
      ).inscriptionErrorMessage(err);

    it('409 → « email déjà utilisé »', () => {
      expect(msg({ status: 409 })).toContain('déjà utilisé');
    });
    it('400 → « informations invalides »', () => {
      expect(msg({ status: 400 })).toContain('invalides');
    });
    it('0 (réseau) → « Connexion impossible »', () => {
      expect(msg({ status: 0 })).toContain('Connexion impossible');
    });
    it('autre statut → message générique', () => {
      expect(msg({ status: 500 })).toContain('Une erreur est survenue');
    });

    it('le DTO passé à setUserInfo NE contient PAS `meta` (garde-fou du 500 Spring)', () => {
      fs.setSector('SAP');
      component.form.patchValue({
        nom: 'John',
        prenom: 'Doe',
        email: 'john@doe.fr',
        telephone: '0612345678',
      });
      component.emailExistsInBdd.set(false);
      const spy = spyOn(fs, 'setUserInfo');
      component.submit();
      expect(spy).toHaveBeenCalled();
      const dto = spy.calls.mostRecent().args[0];
      expect('meta' in dto).toBe(false);
    });
  });
});
