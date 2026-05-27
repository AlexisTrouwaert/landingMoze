import { TestBed } from '@angular/core/testing';
import { signal, WritableSignal } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { Subject } from 'rxjs';

import { MetaPixelService } from './meta-pixel.service';
import { CookieConsentService } from './cookie-consent.service';

declare global {
  // eslint-disable-next-line no-var
  var fbq: any;
}

describe('MetaPixelService', () => {
  let events$: Subject<any>;
  let advertisingConsentSignal: WritableSignal<boolean>;
  let fbqSpy: jasmine.Spy;

  function flush() {
    const tb = TestBed as any;
    if (typeof tb.flushEffects === 'function') tb.flushEffects();
    else if (typeof tb.tick === 'function') tb.tick();
  }

  beforeEach(() => {
    events$ = new Subject<any>();
    advertisingConsentSignal = signal(false);

    const consentMock = {
      advertisingConsent: advertisingConsentSignal,
    };

    const routerMock = {
      events: events$.asObservable(),
    };

    TestBed.configureTestingModule({
      providers: [
        { provide: Router, useValue: routerMock },
        { provide: CookieConsentService, useValue: consentMock },
      ],
    });

    // Définit fbq comme spy par défaut
    fbqSpy = jasmine.createSpy('fbq');
    (window as any).fbq = fbqSpy;
  });

  afterEach(() => {
    delete (window as any).fbq;
    // nettoie tout script injecté
    document.head.querySelectorAll('script').forEach((s) => {
      if ((s.textContent || '').includes("fbq('init'")) {
        s.remove();
      }
    });
  });

  it('should be created', () => {
    expect(TestBed.inject(MetaPixelService)).toBeTruthy();
  });

  it('trackPageView should call fbq with PageView when fbq exists', () => {
    const svc = TestBed.inject(MetaPixelService);
    svc.trackPageView();
    expect(fbqSpy).toHaveBeenCalledWith('track', 'PageView');
  });

  it('trackPageView should be a no-op if fbq is undefined', () => {
    delete (window as any).fbq;
    const svc = TestBed.inject(MetaPixelService);
    expect(() => svc.trackPageView()).not.toThrow();
  });

  it('trackPurchase should fire exactly once (dedup)', () => {
    const svc = TestBed.inject(MetaPixelService);
    svc.trackPurchase();
    svc.trackPurchase();
    const purchaseCalls = fbqSpy.calls
      .allArgs()
      .filter((args) => args[1] === 'Purchase');
    expect(purchaseCalls.length).toBe(1);
  });

  it('trackViewContent should fire exactly once until reset', () => {
    const svc = TestBed.inject(MetaPixelService);
    svc.trackViewContent();
    svc.trackViewContent();
    let calls = fbqSpy.calls
      .allArgs()
      .filter((a) => a[1] === 'ViewContent');
    expect(calls.length).toBe(1);

    svc.resetViewContent();
    svc.trackViewContent();
    calls = fbqSpy.calls.allArgs().filter((a) => a[1] === 'ViewContent');
    expect(calls.length).toBe(2);
  });

  it('trackLeadCTA should pass button_label', () => {
    const svc = TestBed.inject(MetaPixelService);
    svc.trackLeadCTA('cta_top');
    expect(fbqSpy).toHaveBeenCalledWith('track', 'Lead', {
      button_label: 'cta_top',
    });
  });

  it('trackSubscribe should default to empty data', () => {
    const svc = TestBed.inject(MetaPixelService);
    svc.trackSubscribe();
    expect(fbqSpy).toHaveBeenCalledWith('track', 'Subscribe', {});
  });

  it('trackSubscribe should forward data', () => {
    const svc = TestBed.inject(MetaPixelService);
    svc.trackSubscribe({ source: 'footer' });
    expect(fbqSpy).toHaveBeenCalledWith('track', 'Subscribe', {
      source: 'footer',
    });
  });

  it('trackFunnelStarted should fire a custom event', () => {
    const svc = TestBed.inject(MetaPixelService);
    svc.trackFunnelStarted();
    expect(fbqSpy).toHaveBeenCalledWith('trackCustom', 'FunnelStarted');
  });

  it('trackFunnelStep1Completed should include sector', () => {
    const svc = TestBed.inject(MetaPixelService);
    svc.trackFunnelStep1Completed('SAP');
    expect(fbqSpy).toHaveBeenCalledWith('trackCustom', 'FunnelStep1Completed', {
      sector: 'SAP',
    });
  });

  it('trackFunnelStep2Completed should include wants_tax_credit', () => {
    const svc = TestBed.inject(MetaPixelService);
    svc.trackFunnelStep2Completed(true);
    expect(fbqSpy).toHaveBeenCalledWith('trackCustom', 'FunnelStep2Completed', {
      wants_tax_credit: true,
    });
  });

  it('trackCompleteRegistration should fire with data', () => {
    const svc = TestBed.inject(MetaPixelService);
    svc.trackCompleteRegistration({ sector: 'BTP' });
    expect(fbqSpy).toHaveBeenCalledWith('track', 'CompleteRegistration', {
      sector: 'BTP',
    });
  });

  it('trackFunnelAbandoned should include from_step and reason', () => {
    const svc = TestBed.inject(MetaPixelService);
    svc.trackFunnelAbandoned(3, 'logo');
    expect(fbqSpy).toHaveBeenCalledWith('trackCustom', 'FunnelAbandoned', {
      from_step: 3,
      reason: 'logo',
    });
  });

  it('trackEvent should pass eventID option when provided', () => {
    const svc = TestBed.inject(MetaPixelService);
    svc.trackEvent('Custom', { foo: 1 }, 'evt-123');
    expect(fbqSpy).toHaveBeenCalledWith('track', 'Custom', { foo: 1 }, {
      eventID: 'evt-123',
    });
  });

  it('trackEvent should omit options when no eventId', () => {
    const svc = TestBed.inject(MetaPixelService);
    svc.trackEvent('Custom', { foo: 1 });
    expect(fbqSpy).toHaveBeenCalledWith('track', 'Custom', { foo: 1 });
  });

  it('trackEvent should be a no-op when fbq is undefined', () => {
    delete (window as any).fbq;
    const svc = TestBed.inject(MetaPixelService);
    expect(() => svc.trackEvent('X')).not.toThrow();
  });

  it('trackCustomEvent should pass eventID when provided', () => {
    const svc = TestBed.inject(MetaPixelService);
    svc.trackCustomEvent('MyCustom', { a: 1 }, 'eid');
    expect(fbqSpy).toHaveBeenCalledWith('trackCustom', 'MyCustom', { a: 1 }, {
      eventID: 'eid',
    });
  });

  it('trackCustomEvent should omit options when no eventId', () => {
    const svc = TestBed.inject(MetaPixelService);
    svc.trackCustomEvent('MyCustom', { a: 1 });
    expect(fbqSpy).toHaveBeenCalledWith('trackCustom', 'MyCustom', { a: 1 });
  });

  it('should track PageView on each NavigationEnd', () => {
    TestBed.inject(MetaPixelService);
    events$.next(new NavigationEnd(1, '/a', '/a'));
    events$.next(new NavigationEnd(2, '/b', '/b'));
    const pvCalls = fbqSpy.calls
      .allArgs()
      .filter((a) => a[1] === 'PageView');
    expect(pvCalls.length).toBe(2);
  });

  it('should load the pixel script when advertisingConsent becomes true', () => {
    advertisingConsentSignal.set(true);
    TestBed.inject(MetaPixelService);
    flush();
    const scripts = Array.from(document.head.querySelectorAll('script'));
    const pixelScript = scripts.find((s) =>
      (s.textContent || '').includes("fbq('init'")
    );
    expect(pixelScript).toBeTruthy();
  });

  it('should call fbq("consent","revoke") when consent is withdrawn after load', () => {
    advertisingConsentSignal.set(true);
    const svc = TestBed.inject(MetaPixelService);
    flush();
    advertisingConsentSignal.set(false);
    flush();
    // Le pixel a été "chargé" donc revoke devrait être appelé
    expect(fbqSpy).toHaveBeenCalledWith('consent', 'revoke');
  });

  it('should call fbq("consent","grant") when consent is re-granted', () => {
    advertisingConsentSignal.set(true);
    TestBed.inject(MetaPixelService);
    flush();
    advertisingConsentSignal.set(false);
    flush();
    advertisingConsentSignal.set(true);
    flush();
    expect(fbqSpy).toHaveBeenCalledWith('consent', 'grant');
  });
});
