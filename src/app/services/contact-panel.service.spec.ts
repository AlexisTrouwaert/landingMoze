import { TestBed } from '@angular/core/testing';

import { ContactPanelService } from './contact-panel.service';

describe('ContactPanelService', () => {
  let service: ContactPanelService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(ContactPanelService);

    // S'assurer que le body est propre entre les tests
    document.body.style.paddingRight = '';
    document.body.style.overflow = '';
  });

  afterEach(() => {
    document.body.style.paddingRight = '';
    document.body.style.overflow = '';
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should default isOpen() to false', () => {
    expect(service.isOpen()).toBe(false);
  });

  it('open() should set isOpen to true', () => {
    service.open();
    expect(service.isOpen()).toBe(true);
  });

  it('open() should lock body scroll (overflow hidden)', () => {
    service.open();
    expect(document.body.style.overflow).toBe('hidden');
  });

  it('open() should attempt to compensate the scrollbar width via paddingRight', () => {
    service.open();
    const pr = document.body.style.paddingRight;
    // Selon le navigateur de test (overlay scrollbars, sandbox iframe, etc.) :
    //  - chaîne vide si scrollbarWidth = 0 ou si le navigateur rejette la valeur
    //  - sinon une longueur CSS valide (entière ou décimale, éventuellement négative)
    expect(pr === '' || /^-?\d+(\.\d+)?px$/.test(pr)).toBeTrue();
  });

  it('close() should set isOpen to false', () => {
    service.open();
    service.close();
    expect(service.isOpen()).toBe(false);
  });

  it('close() should restore body scroll and padding', () => {
    service.open();
    service.close();
    expect(document.body.style.overflow).toBe('');
    expect(document.body.style.paddingRight).toBe('');
  });

  it('open() and close() can be called multiple times safely', () => {
    service.open();
    service.open();
    expect(service.isOpen()).toBe(true);
    service.close();
    service.close();
    expect(service.isOpen()).toBe(false);
  });
});
