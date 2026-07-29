import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { LinkPreview } from '../../model/link-preview.model';
import { LinkPreviewComponent } from './link-preview.component';

describe('LinkPreviewComponent', () => {
  let fixture: ComponentFixture<LinkPreviewComponent>;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [LinkPreviewComponent],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    fixture = TestBed.createComponent(LinkPreviewComponent);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  /** Affiche la carte pour `url`, avec l'aperçu que renverrait le back. */
  function render(url: string, preview: Partial<LinkPreview>): void {
    fixture.componentRef.setInput('url', url);
    fixture.detectChanges();

    http
      .expectOne((r) => r.url.includes('/link-preview'))
      .flush({ url, ...preview } satisfies LinkPreview);

    fixture.detectChanges();
  }

  const host = (): HTMLElement => fixture.nativeElement as HTMLElement;
  const text = (selector: string): string =>
    host().querySelector(selector)?.textContent?.trim() ?? '';

  it('affiche l’image quand la cible en expose une', () => {
    render('https://exemple.fr/a', {
      title: 'Un article',
      siteName: 'exemple.fr',
      imageUrl: 'https://exemple.fr/og.png',
    });

    expect(fixture.componentInstance.showImage()).toBeTrue();
    expect(host().querySelector('img.lp-image')).not.toBeNull();
    expect(text('.lp-title')).toBe('Un article');
    expect(text('.lp-source')).toBe('exemple.fr');
  });

  it('sans image annoncée : carte compacte', () => {
    render('https://exemple.fr/a', { title: 'Un article', siteName: 'exemple.fr' });

    expect(host().querySelector('img.lp-image')).toBeNull();
    expect(host().querySelector('svg.lp-icon')).not.toBeNull();
    expect(host().querySelector('a')?.classList).toContain('link-preview--compact');
  });

  it('YouTube reste compact malgré la vignette renvoyée par le back', () => {
    render('https://www.youtube.com/watch?v=LXb3EKWsInQ', {
      siteName: 'YouTube',
      imageUrl: 'https://img.youtube.com/vi/LXb3EKWsInQ/hqdefault.jpg',
    });

    expect(fixture.componentInstance.showImage()).toBeFalse();
    expect(host().querySelector('img.lp-image')).toBeNull();
    // Faute de titre (YouTube n'en donne pas aux robots), la carte dit au moins où elle mène.
    expect(text('.lp-title')).toBe('https://www.youtube.com/watch?v=LXb3EKWsInQ');
    expect(text('.lp-source')).toBe('YouTube');
  });

  it('la règle vaut pour les sous-domaines, les liens courts et youtube-nocookie', () => {
    for (const url of [
      'https://m.youtube.com/watch?v=abc',
      'https://music.youtube.com/watch?v=abc',
      'https://youtu.be/abc',
      'https://www.youtube-nocookie.com/embed/abc',
    ]) {
      fixture.componentRef.setInput('url', url);
      fixture.detectChanges();
      http.expectOne((r) => r.url.includes('/link-preview')).flush({
        url,
        siteName: 'YouTube',
        imageUrl: 'https://img.youtube.com/vi/abc/hqdefault.jpg',
      });
      fixture.detectChanges();

      expect(fixture.componentInstance.showImage())
        .withContext(url)
        .toBeFalse();
    }
  });

  it('la carte mène à l’adresse de l’article, pas à celle que le back renvoie', () => {
    // Le back a suivi une redirection et renvoie la page de consentement : le lecteur, lui,
    // doit atterrir sur la vidéo.
    render('https://www.youtube.com/watch?v=abc', {
      url: 'https://consent.youtube.com/m?continue=…',
      siteName: 'YouTube',
    });

    const anchor = host().querySelector('a')!;
    expect(anchor.getAttribute('href')).toBe('https://www.youtube.com/watch?v=abc');
    expect(text('.lp-title')).toBe('https://www.youtube.com/watch?v=abc');
  });

  it('une redirection ne fait pas revenir la vignette par la fenêtre', () => {
    // Demandé : YouTube. Atteint par le back : la page de consentement, sur un autre hôte.
    render('https://www.youtube.com/watch?v=abc', {
      url: 'https://consent.youtube.com/m?continue=…',
      siteName: 'YouTube',
      imageUrl: 'https://img.youtube.com/vi/abc/hqdefault.jpg',
    });

    expect(fixture.componentInstance.showImage()).toBeFalse();
  });

  it('image annoncée mais non chargeable → repli compact, sans retirer la carte', () => {
    const resolved: boolean[] = [];
    fixture.componentInstance.resolved.subscribe((v) => resolved.push(v));

    render('https://exemple.fr/a', {
      title: 'Un article',
      imageUrl: 'https://exemple.fr/absente.png',
    });
    expect(fixture.componentInstance.showImage()).toBeTrue();

    host().querySelector('img.lp-image')!.dispatchEvent(new Event('error'));
    fixture.detectChanges();

    expect(fixture.componentInstance.showImage()).toBeFalse();
    expect(host().querySelector('a')).not.toBeNull();
    // Une carte reste affichée : elle continue de remplacer l'URL dans le texte.
    expect(resolved).toEqual([true]);
  });

  it('aperçu refusé → rien du tout, et le parent en est informé', () => {
    const resolved: boolean[] = [];
    fixture.componentInstance.resolved.subscribe((v) => resolved.push(v));

    fixture.componentRef.setInput('url', 'https://exemple.fr/a');
    fixture.detectChanges();
    http
      .expectOne((r) => r.url.includes('/link-preview'))
      .flush('nope', { status: 400, statusText: 'Bad Request' });
    fixture.detectChanges();

    expect(host().querySelector('a')).toBeNull();
    expect(resolved).toEqual([false]);
  });
});
