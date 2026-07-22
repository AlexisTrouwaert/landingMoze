import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { GoogleAnalyticsService } from './google-analytics.service';
import { CookieConsentService } from './cookie-consent.service';

/**
 * On teste la dérivation du `content_group` (dimension « Groupe de contenu » de
 * GA4) : c'est ce qui répond « combien de visiteurs sur le blog » en une ligne
 * de rapport. Consentement stubé à false → gtag n'est jamais chargé, on isole la
 * logique de routage.
 */
describe('GoogleAnalyticsService — content_group', () => {
  let service: GoogleAnalyticsService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        {
          provide: CookieConsentService,
          useValue: { analyticsConsent: signal(false) },
        },
      ],
    });
    service = TestBed.inject(GoogleAnalyticsService);
  });

  const group = (url: string): string =>
    (service as unknown as { contentGroup(u: string): string }).contentGroup(url);

  it('/blog et un article → « blog »', () => {
    expect(group('/blog')).toBe('blog');
    expect(group('/blog/mon-article')).toBe('blog');
    expect(group('/blog?tags=auto')).toBe('blog'); // query ignorée
  });

  it('racine → « accueil »', () => {
    expect(group('/')).toBe('accueil');
  });

  it('tunnel d\'inscription → « funnel »', () => {
    expect(group('/commencer')).toBe('funnel');
    expect(group('/commencer/etape-2')).toBe('funnel');
  });

  it('pages légales → « légal »', () => {
    expect(group('/cgv-cgu')).toBe('légal');
    expect(group('/mentions-legales')).toBe('légal');
    expect(group('/politique-confidentialite')).toBe('légal');
  });

  it('désinscription et admin → leur propre groupe', () => {
    expect(group('/desinscription')).toBe('désinscription');
    expect(group('/admin/blog')).toBe('admin');
  });

  it('route inconnue → « autre » (jamais vide)', () => {
    expect(group('/route-qui-nexiste-pas')).toBe('autre');
  });
});
