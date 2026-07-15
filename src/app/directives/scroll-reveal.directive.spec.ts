import { Component, DebugElement } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';

import { ScrollRevealDirective } from './scroll-reveal.directive';

@Component({
    imports: [ScrollRevealDirective],
    template: `
    <div appScrollReveal [delay]="delay" [threshold]="threshold"></div>
  `
})
class HostComponent {
  delay = 0;
  threshold = 0.1;
}

class FakeIntersectionObserver {
  static instances: FakeIntersectionObserver[] = [];
  callback: IntersectionObserverCallback;
  options: IntersectionObserverInit | undefined;
  observed: Element[] = [];
  disconnected = false;

  constructor(
    cb: IntersectionObserverCallback,
    opts?: IntersectionObserverInit
  ) {
    this.callback = cb;
    this.options = opts;
    FakeIntersectionObserver.instances.push(this);
  }

  observe(el: Element) {
    this.observed.push(el);
  }
  disconnect() {
    this.disconnected = true;
  }
  unobserve() {}
  takeRecords(): IntersectionObserverEntry[] {
    return [];
  }
  root = null;
  rootMargin = '';
  thresholds = [];

  trigger(isIntersecting: boolean) {
    this.callback(
      [{ isIntersecting } as IntersectionObserverEntry],
      this as any
    );
  }
}

describe('ScrollRevealDirective', () => {
  let fixture: ComponentFixture<HostComponent>;
  let host: HostComponent;
  let de: DebugElement;
  let originalIO: any;
  let originalMM: any;

  function flushDoubleRaf() {
    return new Promise<void>((resolve) => {
      requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
    });
  }

  beforeEach(async () => {
    originalIO = (window as any).IntersectionObserver;
    originalMM = window.matchMedia;
    FakeIntersectionObserver.instances = [];
    (window as any).IntersectionObserver = FakeIntersectionObserver;
    window.matchMedia = ((q: string) =>
      ({
        matches: false,
        media: q,
        addEventListener: () => {},
        removeEventListener: () => {},
        addListener: () => {},
        removeListener: () => {},
        onchange: null,
        dispatchEvent: () => false,
      } as any)) as any;

    await TestBed.configureTestingModule({
      imports: [HostComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(HostComponent);
    host = fixture.componentInstance;
    de = fixture.debugElement.query(By.directive(ScrollRevealDirective));
  });

  afterEach(() => {
    (window as any).IntersectionObserver = originalIO;
    window.matchMedia = originalMM;
  });

  it('should create the directive instance', () => {
    const directive = de.injector.get(ScrollRevealDirective);
    expect(directive).toBeTruthy();
  });

  it('should start hidden with sr-hidden class', () => {
    fixture.detectChanges();
    expect(de.nativeElement.classList.contains('sr-hidden')).toBeTrue();
    expect(de.nativeElement.classList.contains('sr-visible')).toBeFalse();
  });

  it('should apply transition-delay from the @Input delay', () => {
    host.delay = 250;
    fixture.detectChanges();
    expect(de.nativeElement.style.transitionDelay).toBe('250ms');
  });

  /** Retourne l'IntersectionObserver qui observe précisément notre élément hôte
   *  (d'autres tests/composants vivant encore dans le document peuvent en avoir
   *  créé d'autres, on filtre pour ne garder que le bon). */
  function ioForHost(): FakeIntersectionObserver {
    const match = FakeIntersectionObserver.instances.find((io) =>
      io.observed.includes(de.nativeElement)
    );
    if (!match) throw new Error('No IntersectionObserver observed the host');
    return match;
  }

  it('should observe the host element after double rAF', async () => {
    fixture.detectChanges();
    await flushDoubleRaf();
    const io = ioForHost();
    expect(io.observed.includes(de.nativeElement)).toBeTrue();
    expect(io.options?.threshold).toBe(0.1);
  });

  it('should reveal when intersecting and disconnect the observer', async () => {
    fixture.detectChanges();
    await flushDoubleRaf();
    const io = ioForHost();
    io.trigger(true);
    fixture.detectChanges();
    expect(de.nativeElement.classList.contains('sr-visible')).toBeTrue();
    expect(io.disconnected).toBeTrue();
  });

  it('should NOT reveal when not intersecting', async () => {
    fixture.detectChanges();
    await flushDoubleRaf();
    const io = ioForHost();
    io.trigger(false);
    fixture.detectChanges();
    expect(de.nativeElement.classList.contains('sr-visible')).toBeFalse();
  });

  it('should bypass observation and reveal immediately when prefers-reduced-motion is set', () => {
    window.matchMedia = ((q: string) =>
      ({
        matches: q.includes('reduce'),
        media: q,
        addEventListener: () => {},
        removeEventListener: () => {},
        addListener: () => {},
        removeListener: () => {},
        onchange: null,
        dispatchEvent: () => false,
      } as any)) as any;

    fixture.detectChanges();
    expect(de.nativeElement.classList.contains('sr-visible')).toBeTrue();
    expect(de.nativeElement.style.transitionDelay).toBe('');
    expect(FakeIntersectionObserver.instances.length).toBe(0);
  });

  it('should disconnect observer on destroy', async () => {
    fixture.detectChanges();
    await flushDoubleRaf();
    const io = ioForHost();
    fixture.destroy();
    expect(io.disconnected).toBeTrue();
  });
});
