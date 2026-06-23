import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';

import { EmailComponent } from './email.component';
import { MetaPixelService } from '../../../services/meta-pixel.service';

describe('EmailComponent', () => {
  let fixture: ComponentFixture<EmailComponent>;
  let component: EmailComponent;
  let router: Router;
  let pixel: jasmine.SpyObj<MetaPixelService>;

  beforeEach(async () => {
    pixel = jasmine.createSpyObj<MetaPixelService>('MetaPixelService', [
      'trackLeadCTA',
      'trackSubscribe',
    ]);
    localStorage.clear();
    await TestBed.configureTestingModule({
      imports: [EmailComponent],
      providers: [
        provideRouter([]),
        { provide: MetaPixelService, useValue: pixel },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(EmailComponent);
    component = fixture.componentInstance;
    router = TestBed.inject(Router);
    fixture.detectChanges();
  });

  afterEach(() => localStorage.clear());

  function evt(): Event {
    return { preventDefault: jasmine.createSpy('preventDefault') } as any;
  }

  it('should create with defaults', () => {
    expect(component).toBeTruthy();
    expect(component.status()).toBe('IDLE');
    expect(component.emailValue()).toBe('');
    expect(component.optInValue()).toBe(false);
  });

  it('goToFunnel() should track + navigate', () => {
    spyOn(router, 'navigate');
    component.goToFunnel();
    expect(pixel.trackLeadCTA).toHaveBeenCalledWith('inscription_generic');
    expect(router.navigate).toHaveBeenCalledWith(['/commencer']);
  });

  it('onSubmit() with invalid email should flag emailError and shake', fakeAsync(() => {
    component.emailValue.set('not-an-email');
    component.optInValue.set(true);
    component.onSubmit(evt());
    expect(component.emailError()).toBe(true);
    expect(component.isShaking()).toBe(true);
    tick(500);
    expect(component.isShaking()).toBe(false);
  }));

  it('onSubmit() with valid email but optIn false should flag optInError', () => {
    component.emailValue.set('a@b.fr');
    component.optInValue.set(false);
    component.onSubmit(evt());
    expect(component.optInError()).toBe(true);
  });

  it('onSubmit() with honeypot filled should trigger success without network call', () => {
    const fetchSpy = spyOn(window, 'fetch');
    component.emailValue.set('a@b.fr');
    component.optInValue.set(true);
    component.honeypotValue.set('bot');
    component.onSubmit(evt());
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(component.status()).toBe('SUCCESS');
    expect(localStorage.getItem('isBanned')).toBe('true');
  });

  it('onSubmit() should bail out instantly when user is banned', () => {
    const fetchSpy = spyOn(window, 'fetch');
    localStorage.setItem('isBanned', 'true');
    component.emailValue.set('a@b.fr');
    component.optInValue.set(true);
    component.onSubmit(evt());
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(component.status()).toBe('SUCCESS');
  });

  it('onSubmit() should ban user after MAX_ATTEMPTS', () => {
    const fetchSpy = spyOn(window, 'fetch');
    localStorage.setItem('submissionCount', '5');
    component.emailValue.set('a@b.fr');
    component.optInValue.set(true);
    component.onSubmit(evt());
    expect(component.status()).toBe('ERROR');
    expect(localStorage.getItem('isBanned')).toBe('true');
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('onSubmit() should POST to Brevo on success', fakeAsync(() => {
    const fetchSpy = spyOn(window, 'fetch').and.returnValue(
      Promise.resolve(new Response())
    );
    component.emailValue.set('a@b.fr');
    component.optInValue.set(true);
    component.onSubmit(evt());

    expect(component.status()).toBe('LOADING');
    expect(localStorage.getItem('submissionCount')).toBe('1');

    tick();
    expect(fetchSpy).toHaveBeenCalled();
    expect(pixel.trackSubscribe).toHaveBeenCalled();
    expect(component.status()).toBe('SUCCESS');
    expect(component.emailValue()).toBe('');
    expect(component.optInValue()).toBe(false);
  }));

  it('onSubmit() should shake and reset on network error', fakeAsync(() => {
    spyOn(window, 'fetch').and.returnValue(Promise.reject(new Error('net')));
    const errSpy = spyOn(console, 'error');
    component.emailValue.set('a@b.fr');
    component.optInValue.set(true);
    component.onSubmit(evt());
    tick();
    // L'erreur déclenche triggerShake() qui pose un setTimeout 500ms.
    tick(500);
    expect(component.status()).toBe('IDLE');
    expect(errSpy).toHaveBeenCalled();
  }));
});
