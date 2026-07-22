import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';

import { NewsletterFormComponent } from './newsletter-form.component';
import { MetaPixelService } from '../../services/meta-pixel.service';

describe('NewsletterFormComponent', () => {
  let fixture: ComponentFixture<NewsletterFormComponent>;
  let component: NewsletterFormComponent;
  let pixel: jasmine.SpyObj<MetaPixelService>;

  const HOUR = 60 * 60 * 1000;

  beforeEach(async () => {
    pixel = jasmine.createSpyObj<MetaPixelService>('MetaPixelService', [
      'trackSubscribe',
    ]);
    localStorage.clear();
    await TestBed.configureTestingModule({
      imports: [NewsletterFormComponent],
      providers: [{ provide: MetaPixelService, useValue: pixel }],
    }).compileComponents();
    fixture = TestBed.createComponent(NewsletterFormComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  afterEach(() => localStorage.clear());

  function evt(): Event {
    return { preventDefault: jasmine.createSpy('preventDefault') } as unknown as Event;
  }

  function attempts(): number[] {
    const raw = localStorage.getItem('nl_attempts');
    return raw ? (JSON.parse(raw) as number[]) : [];
  }

  it('should create with defaults', () => {
    expect(component).toBeTruthy();
    expect(component.status()).toBe('IDLE');
    expect(component.source()).toBe('newsletter');
  });

  it('email invalide → emailError + shake', fakeAsync(() => {
    component.emailValue.set('nope');
    component.optInValue.set(true);
    component.onSubmit(evt());
    expect(component.emailError()).toBe(true);
    expect(component.isShaking()).toBe(true);
    tick(500);
    expect(component.isShaking()).toBe(false);
  }));

  it('optIn manquant → optInError', () => {
    component.emailValue.set('a@b.fr');
    component.optInValue.set(false);
    component.onSubmit(evt());
    expect(component.optInError()).toBe(true);
  });

  it('honeypot rempli → succès silencieux, sans réseau', () => {
    const fetchSpy = spyOn(window, 'fetch');
    component.emailValue.set('a@b.fr');
    component.optInValue.set(true);
    component.honeypotValue.set('bot');
    component.onSubmit(evt());
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(component.status()).toBe('SUCCESS');
  });

  it('rate-limité après 5 envois récents → ERROR (pas de faux succès, pas de réseau)', () => {
    const fetchSpy = spyOn(window, 'fetch');
    const now = Date.now();
    localStorage.setItem('nl_attempts', JSON.stringify([now, now, now, now, now]));
    component.emailValue.set('a@b.fr');
    component.optInValue.set(true);
    component.onSubmit(evt());
    expect(component.status()).toBe('ERROR');
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('anciennes tentatives hors fenêtre → ignorées, l\'envoi repart', fakeAsync(() => {
    const fetchSpy = spyOn(window, 'fetch').and.returnValue(
      Promise.resolve(new Response()),
    );
    const old = Date.now() - 3 * HOUR;
    localStorage.setItem('nl_attempts', JSON.stringify([old, old, old, old, old]));
    component.emailValue.set('a@b.fr');
    component.optInValue.set(true);
    component.onSubmit(evt());
    tick();
    expect(fetchSpy).toHaveBeenCalled();
    expect(component.status()).toBe('SUCCESS');
  }));

  it('succès → POST + horodatage compté après succès, avec la source', fakeAsync(() => {
    fixture.componentRef.setInput('source', 'newsletter_blog');
    const fetchSpy = spyOn(window, 'fetch').and.returnValue(
      Promise.resolve(new Response()),
    );
    component.emailValue.set('a@b.fr');
    component.optInValue.set(true);
    component.onSubmit(evt());

    expect(component.status()).toBe('LOADING');
    expect(localStorage.getItem('nl_attempts')).toBeNull();

    tick();
    expect(fetchSpy).toHaveBeenCalled();
    expect(pixel.trackSubscribe).toHaveBeenCalledWith({ source: 'newsletter_blog' });
    expect(component.status()).toBe('SUCCESS');
    expect(attempts().length).toBe(1);
  }));

  it('erreur réseau → IDLE, aucun envoi compté (pas de ban)', fakeAsync(() => {
    spyOn(window, 'fetch').and.returnValue(Promise.reject(new Error('net')));
    spyOn(console, 'error');
    component.emailValue.set('a@b.fr');
    component.optInValue.set(true);
    component.onSubmit(evt());
    tick();
    tick(500);
    expect(component.status()).toBe('IDLE');
    expect(localStorage.getItem('nl_attempts')).toBeNull();
  }));
});
