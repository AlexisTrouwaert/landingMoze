import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';

import { FooterComponent } from './footer.component';
import { ContactPanelService } from '../../../services/contact-panel.service';
import { CookieConsentService } from '../../../services/cookie-consent.service';

describe('FooterComponent', () => {
  let fixture: ComponentFixture<FooterComponent>;
  let component: FooterComponent;
  let router: Router;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FooterComponent],
      providers: [provideRouter([])],
    }).compileComponents();
    fixture = TestBed.createComponent(FooterComponent);
    component = fixture.componentInstance;
    router = TestBed.inject(Router);
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('exposes contactPanel and cookieConsent services', () => {
    expect(component.contactPanel).toBe(TestBed.inject(ContactPanelService));
    expect(component.cookieConsent).toBe(TestBed.inject(CookieConsentService));
  });

  it('cgv() navigates to /cgv-cgu', () => {
    spyOn(router, 'navigate');
    component.cgv();
    expect(router.navigate).toHaveBeenCalledWith(['/cgv-cgu']);
  });

  it('confidentialite() navigates to /politique-confidentialite', () => {
    spyOn(router, 'navigate');
    component.confidentialite();
    expect(router.navigate).toHaveBeenCalledWith(['/politique-confidentialite']);
  });

  it('mention() navigates to /mentions-legales', () => {
    spyOn(router, 'navigate');
    component.mention();
    expect(router.navigate).toHaveBeenCalledWith(['/mentions-legales']);
  });

  it('auto() opens the URSSAF page in a new tab', () => {
    const spy = spyOn(window, 'open');
    component.auto();
    expect(spy).toHaveBeenCalled();
    expect(spy.calls.mostRecent().args[0]).toContain(
      'autoentrepreneur.urssaf.fr'
    );
    expect(spy.calls.mostRecent().args[1]).toBe('_blank');
  });
});
