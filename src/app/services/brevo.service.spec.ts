import { TestBed } from '@angular/core/testing';
import { signal, WritableSignal } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { Subject } from 'rxjs';

import { BrevoService } from './brevo.service';
import { CookieConsentService } from './cookie-consent.service';

declare global {
  // eslint-disable-next-line no-var
  var sendinblue: any;
}

describe('BrevoService', () => {
  let events$: Subject<any>;
  let advertisingConsentSignal: WritableSignal<boolean>;
  let sbMock: { page: jasmine.Spy; identify: jasmine.Spy; track: jasmine.Spy };

  beforeEach(() => {
    events$ = new Subject<any>();
    advertisingConsentSignal = signal(false);

    const consentMock = { advertisingConsent: advertisingConsentSignal };
    const routerMock = { events: events$.asObservable() };

    TestBed.configureTestingModule({
      providers: [
        { provide: Router, useValue: routerMock },
        { provide: CookieConsentService, useValue: consentMock },
      ],
    });

    // sendinblue mocké en objet (le vrai global expose des méthodes, pas une fonction).
    sbMock = {
      page: jasmine.createSpy('page'),
      identify: jasmine.createSpy('identify'),
      track: jasmine.createSpy('track'),
    };
    (window as any).sendinblue = sbMock;
  });

  afterEach(() => {
    delete (window as any).sendinblue;
  });

  it('should be created', () => {
    expect(TestBed.inject(BrevoService)).toBeTruthy();
  });

  it('trackPage should call sendinblue.page', () => {
    const svc = TestBed.inject(BrevoService);
    svc.trackPage('Accueil');
    expect(sbMock.page).toHaveBeenCalledWith('Accueil', {});
  });

  it('trackPage should be a no-op if sendinblue is undefined', () => {
    delete (window as any).sendinblue;
    const svc = TestBed.inject(BrevoService);
    expect(() => svc.trackPage()).not.toThrow();
  });

  it('identify should forward email and attributes', () => {
    const svc = TestBed.inject(BrevoService);
    svc.identify('a@b.fr', { PRENOM: 'Jean' });
    expect(sbMock.identify).toHaveBeenCalledWith('a@b.fr', { PRENOM: 'Jean' });
  });

  it('track should send event name with data nested under { data }', () => {
    const svc = TestBed.inject(BrevoService);
    svc.track('funnel_started', { foo: 1 });
    expect(sbMock.track).toHaveBeenCalledWith('funnel_started', {}, { data: { foo: 1 } });
  });

  it('track should be a no-op when sendinblue is undefined', () => {
    delete (window as any).sendinblue;
    const svc = TestBed.inject(BrevoService);
    expect(() => svc.track('x')).not.toThrow();
  });

  it('trackFunnelStarted should fire funnel_started', () => {
    const svc = TestBed.inject(BrevoService);
    svc.trackFunnelStarted();
    expect(sbMock.track).toHaveBeenCalledWith('funnel_started', {}, { data: {} });
  });

  it('trackFunnelStep1Completed should include sector', () => {
    const svc = TestBed.inject(BrevoService);
    svc.trackFunnelStep1Completed('SAP');
    expect(sbMock.track).toHaveBeenCalledWith('funnel_step1_completed', {}, { data: { sector: 'SAP' } });
  });

  it('trackFunnelStep2Completed should include wants_tax_credit', () => {
    const svc = TestBed.inject(BrevoService);
    svc.trackFunnelStep2Completed(true);
    expect(sbMock.track).toHaveBeenCalledWith('funnel_step2_completed', {}, { data: { wants_tax_credit: true } });
  });

  it('trackCompleteRegistration should fire inscription_complete with data', () => {
    const svc = TestBed.inject(BrevoService);
    svc.trackCompleteRegistration({ sector: 'BTP' });
    expect(sbMock.track).toHaveBeenCalledWith('inscription_complete', {}, { data: { sector: 'BTP' } });
  });

  it('trackFunnelDestination should include destination', () => {
    const svc = TestBed.inject(BrevoService);
    svc.trackFunnelDestination('mozeconnect');
    expect(sbMock.track).toHaveBeenCalledWith('funnel_destination', {}, { data: { destination: 'mozeconnect' } });
  });

  it('trackFunnelAbandoned should include from_step and reason', () => {
    const svc = TestBed.inject(BrevoService);
    svc.trackFunnelAbandoned(3, 'logo');
    expect(sbMock.track).toHaveBeenCalledWith('funnel_abandoned', {}, { data: { from_step: 3, reason: 'logo' } });
  });

  it('should track a page on each NavigationEnd', () => {
    TestBed.inject(BrevoService);
    events$.next(new NavigationEnd(1, '/a', '/a'));
    events$.next(new NavigationEnd(2, '/b', '/b'));
    expect(sbMock.page.calls.count()).toBe(2);
  });
});
