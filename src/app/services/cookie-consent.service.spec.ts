import { TestBed } from '@angular/core/testing';

import { CookieConsentService } from './cookie-consent.service';

const STORAGE_KEY = 'moze_consent_v2';

describe('CookieConsentService', () => {
  beforeEach(() => {
    localStorage.removeItem(STORAGE_KEY);
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({});
  });

  afterEach(() => {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* spy may still be active on certain tests, ignore */
    }
  });

  function makeService(): CookieConsentService {
    return TestBed.inject(CookieConsentService);
  }

  it('should be created', () => {
    const service = makeService();
    expect(service).toBeTruthy();
  });

  it('should default to not-decided + no advertising consent on first load', () => {
    const service = makeService();
    expect(service.consentDecided()).toBe(false);
    expect(service.advertisingConsent()).toBe(false);
  });

  it('acceptAll() should persist advertising:true and mark consent decided', () => {
    const service = makeService();
    service.acceptAll();

    expect(service.consentDecided()).toBe(true);
    expect(service.advertisingConsent()).toBe(true);
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!)).toEqual({
      advertising: true,
    });
  });

  it('refuseAll() should persist advertising:false and mark consent decided', () => {
    const service = makeService();
    service.refuseAll();

    expect(service.consentDecided()).toBe(true);
    expect(service.advertisingConsent()).toBe(false);
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!)).toEqual({
      advertising: false,
    });
  });

  it('reset() should clear storage and reset both signals', () => {
    const service = makeService();
    service.acceptAll();
    service.reset();

    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
    expect(service.consentDecided()).toBe(false);
    expect(service.advertisingConsent()).toBe(false);
  });

  it('should rehydrate advertisingConsent from localStorage on construction', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ advertising: true }));
    const service = makeService();
    expect(service.consentDecided()).toBe(true);
    expect(service.advertisingConsent()).toBe(true);
  });

  it('should rehydrate as decided=true even when advertising=false', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ advertising: false }));
    const service = makeService();
    expect(service.consentDecided()).toBe(true);
    expect(service.advertisingConsent()).toBe(false);
  });

  it('should gracefully ignore malformed JSON in localStorage', () => {
    localStorage.setItem(STORAGE_KEY, 'not-json');
    const service = makeService();
    expect(service.consentDecided()).toBe(true);
    expect(service.advertisingConsent()).toBe(false);
  });

  it('should not throw if localStorage.setItem fails', () => {
    const service = makeService();
    spyOn(localStorage, 'setItem').and.throwError('quota');
    expect(() => service.acceptAll()).not.toThrow();
    expect(service.advertisingConsent()).toBe(true);
  });

  it('should not throw if localStorage.removeItem fails on reset', () => {
    const service = makeService();
    spyOn(localStorage, 'removeItem').and.throwError('locked');
    expect(() => service.reset()).not.toThrow();
    expect(service.consentDecided()).toBe(false);
  });
});
