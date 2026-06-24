import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';

import {
  FunnelService,
  UtilisateurInscriptionDTO,
} from './funnel.service';
import { MetaPixelService } from './meta-pixel.service';

describe('FunnelService', () => {
  let service: FunnelService;
  let httpMock: HttpTestingController;
  let pixel: jasmine.SpyObj<MetaPixelService>;

  beforeEach(() => {
    pixel = jasmine.createSpyObj<MetaPixelService>('MetaPixelService', [
      'trackFunnelStep1Completed',
      'trackFunnelStep2Completed',
      'trackFunnelAbandoned',
    ]);

    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: MetaPixelService, useValue: pixel },
      ],
    });
    service = TestBed.inject(FunnelService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('should be created with default state', () => {
    expect(service).toBeTruthy();
    expect(service.currentStep()).toBe(1);
    expect(service.selectedSector()).toBeNull();
    expect(service.userInfo()).toBeNull();
    expect(service.wantsTaxCredit()).toBeNull();
    expect(service.hasSapNumber()).toBeNull();
  });

  it('finalOfferPrice should default to 9.90', () => {
    expect(service.finalOfferPrice()).toBe(9.9);
  });

  it('finalOfferPrice should be 29.90 when wantsTaxCredit is true', () => {
    service.setWantsTaxCredit(true);
    expect(service.finalOfferPrice()).toBe(29.9);
  });

  it('finalOfferPrice should stay 9.90 when wantsTaxCredit is false', () => {
    service.setWantsTaxCredit(false);
    expect(service.finalOfferPrice()).toBe(9.9);
  });

  it('setSector should store sector, fire pixel and advance to next step', () => {
    service.setSector('SAP');
    expect(service.selectedSector()).toBe('SAP');
    expect(pixel.trackFunnelStep1Completed).toHaveBeenCalledWith('SAP');
    expect(service.currentStep()).toBe(2);
  });

  it('setHasSapNumber should store value, fire pixel and advance', () => {
    service.setHasSapNumber(true);
    expect(service.hasSapNumber()).toBe(true);
    expect(pixel.trackFunnelStep2Completed).toHaveBeenCalledWith(true);
    expect(service.currentStep()).toBe(2);
  });

  it('setWantsTaxCredit should store value and advance step (no pixel)', () => {
    service.setWantsTaxCredit(true);
    expect(service.wantsTaxCredit()).toBe(true);
    expect(service.currentStep()).toBe(2);
    expect(pixel.trackFunnelStep2Completed).not.toHaveBeenCalled();
  });

  it('setUserInfo should store user without advancing step', () => {
    const dto: UtilisateurInscriptionDTO = {
      nom: 'Doe',
      prenom: 'John',
      pseudo: 'JohnDoe123',
      email: 'john@doe.fr',
      telephonePersonnel: '0600000000',
      communication: { secteur: 'SAP' },
    };
    service.setUserInfo(dto);
    expect(service.userInfo()).toEqual(dto);
    expect(service.currentStep()).toBe(1);
  });

  it('nextStep should increment step', () => {
    service.nextStep();
    service.nextStep();
    expect(service.currentStep()).toBe(3);
  });

  it('previousStep should decrement, fire abandon and clamp to 1', () => {
    service.nextStep();
    service.nextStep();
    service.previousStep();
    expect(service.currentStep()).toBe(2);
    expect(pixel.trackFunnelAbandoned).toHaveBeenCalledWith(3, 'back_button');

    service.previousStep();
    service.previousStep();
    service.previousStep();
    expect(service.currentStep()).toBe(1);
  });

  it('submitInscription should POST to /mozeapp/inscription with the DTO and text response', () => {
    const dto: UtilisateurInscriptionDTO = {
      nom: 'A',
      prenom: 'B',
      pseudo: 'AB123',
      email: 'a@b.fr',
      telephonePersonnel: '0600000000',
      communication: { secteur: 'AUTRE' },
    };
    service.submitInscription(dto).subscribe();
    const req = httpMock.expectOne(
      'https://app.mozeconnect.fr/mozeapp/inscription'
    );
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(dto);
    expect(req.request.responseType).toBe('text');
    req.flush('OK');
  });

  it('subscribePremium should POST to /mozeapp/abonnements/public/subscribe/custom with origine moze.fr', () => {
    service.subscribePremium('user@x.fr', true, false, 'ignored').subscribe();
    const req = httpMock.expectOne(
      'https://app.mozeconnect.fr/mozeapp/abonnements/public/subscribe/custom'
    );
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({
      email: 'user@x.fr',
      withSap: true,
      withCoop: false,
      origine: 'moze.fr',
    });
    req.flush('OK');
  });

  it('subscribeCustom should POST to /mozeapp/abonnements/public/subscribe/custom with origine moze.fr', () => {
    service.subscribeCustom('u@x.fr', false, true, 'ignored').subscribe();
    const req = httpMock.expectOne(
      'https://app.mozeconnect.fr/mozeapp/abonnements/public/subscribe/custom'
    );
    expect(req.request.body).toEqual({
      email: 'u@x.fr',
      withSap: false,
      withCoop: true,
      origine: 'moze.fr',
    });
    req.flush('OK');
  });

  it('requestPasswordReset should POST to /mozeapp/mot-de-passe-oublie with the email', () => {
    service.requestPasswordReset('user@x.fr').subscribe();
    const req = httpMock.expectOne(
      'https://app.mozeconnect.fr/mozeapp/mot-de-passe-oublie'
    );
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ email: 'user@x.fr' });
    expect(req.request.responseType).toBe('text');
    req.flush('OK');
  });

  it('useTestServer(true) should route the inscription POST to the test server', () => {
    service.useTestServer(true);
    service.submitInscription({
      nom: 'A', prenom: 'B', pseudo: 'AB1', email: 'a@b.fr',
      telephonePersonnel: '0600000000', communication: { secteur: 'AUTRE' },
    }).subscribe();
    const req = httpMock.expectOne('https://nico.by-moze.fr/mozeapp/inscription');
    expect(req.request.method).toBe('POST');
    req.flush('OK');
  });
});
