import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { environment } from '../../../environements/environment';
import { Article } from '../../model/article.model';
import { ArticleViewComponent, ContentBlock } from './article-view.component';

/** Article minimal : seul `content` compte pour le découpage. */
function articleWith(content: string): Article {
  return {
    id: '1',
    slug: 'test',
    title: 'Test',
    excerpt: '',
    content,
    coverImageUrl: null,
    coverPosition: 'top',
    author: 'Équipe Moze',
    status: 'PUBLISHED',
    metaTitle: null,
    metaDescription: null,
    createdAt: '2026-07-01T00:00:00.000Z',
    updatedAt: '2026-07-01T00:00:00.000Z',
    publishedAt: '2026-07-01T00:00:00.000Z',
    featuredAt: null,
    tags: [],
  };
}

describe('ArticleViewComponent', () => {
  let fixture: ComponentFixture<ArticleViewComponent>;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [ArticleViewComponent],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    });
    fixture = TestBed.createComponent(ArticleViewComponent);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  function render(content: string): void {
    fixture.componentRef.setInput('article', articleWith(content));
    fixture.detectChanges();
  }

  function blocks(): ContentBlock[] {
    return fixture.componentInstance.blocks();
  }

  function kinds(): string[] {
    return blocks().map((block) => block.kind);
  }

  /** Répond à toutes les demandes d'aperçu en attente, comme le ferait le back. */
  function resolvePreviews(): string[] {
    const requests = http.match((r) => r.url.includes('/link-preview'));

    for (const req of requests) {
      const url = decodeURIComponent(req.request.url.split('?url=')[1]);
      req.flush({ url, title: 'Titre distant', siteName: 'exemple.fr' });
    }

    fixture.detectChanges();
    return requests.map((r) => decodeURIComponent(r.request.url.split('?url=')[1]));
  }

  it('place la carte juste après le bloc qui cite le lien', () => {
    render(
      '<p>Avant</p><p><a href="https://exemple.fr/a">https://exemple.fr/a</a></p><p>Après</p>',
    );

    expect(kinds()).toEqual(['html', 'preview', 'html']);
    expect(blocks()[2]).toEqual({ kind: 'html', html: '<p>Après</p>' });

    // La carte reste à sa place une fois l'aperçu arrivé — seul le lien s'efface du texte.
    resolvePreviews();
    expect(kinds()).toEqual(['html', 'preview', 'html']);
  });

  it('retire l’ancre du texte une fois la carte affichée — mais elle seule', () => {
    render('<p>Avant</p><p><a href="https://exemple.fr/a">https://exemple.fr/a</a></p>');

    // Tant que l'aperçu n'a pas abouti, le lien reste : sinon il disparaîtrait sans
    // rien à la place.
    const avant = blocks()[0];
    expect(avant.kind === 'html' && avant.html).toContain('exemple.fr/a');

    resolvePreviews();

    const first = blocks()[0];
    expect(first.kind).toBe('html');
    expect(first.kind === 'html' && first.html).toBe('<p>Avant</p>');
  });

  it('garde le lien quand l’auteur lui a donné un libellé', () => {
    render('<p>Voir <a href="https://exemple.fr/a">notre guide</a> pour la suite</p>');
    resolvePreviews();

    const first = blocks()[0];
    expect(first.kind === 'html' && first.html).toContain('notre guide');
    expect(first.kind === 'html' && first.html).toContain('href="https://exemple.fr/a"');
    expect(kinds()).toEqual(['html', 'preview']);
  });

  it('prévisualise aussi une URL simplement collée dans le texte', () => {
    render('<p>Regarde https://exemple.fr/a et dis-moi</p>');

    expect(resolvePreviews()).toEqual(['https://exemple.fr/a']);

    const first = blocks()[0];
    expect(first.kind === 'html' && first.html).toContain('Regarde');
    expect(first.kind === 'html' && first.html).not.toContain('href');
  });

  it('plafonne à trois cartes, les liens suivants restant cliquables', () => {
    render(
      ['a', 'b', 'c', 'd']
        .map((p) => `<p><a href="https://exemple.fr/${p}">https://exemple.fr/${p}</a></p>`)
        .join(''),
    );

    expect(blocks().filter((b) => b.kind === 'preview').length).toBe(3);

    resolvePreviews();

    const texte = blocks()
      .filter((b): b is { kind: 'html'; html: string } => b.kind === 'html')
      .map((b) => b.html)
      .join('');
    expect(texte).toContain('exemple.fr/d');
    expect(texte).not.toContain('exemple.fr/a');
  });

  it('ignore les liens vers le site lui-même', () => {
    render(`<p><a href="${environment.siteUrl}/mentions-legales">Mentions légales</a></p>`);

    expect(kinds()).toEqual(['html']);
    http.expectNone((r) => r.url.includes('/link-preview'));
  });

  it('laisse intacte une URL citée dans un bloc de code', () => {
    render('<p>Exemple : <code>https://exemple.fr/a</code></p>');

    expect(kinds()).toEqual(['html']);
    http.expectNone((r) => r.url.includes('/link-preview'));
  });

  /**
   * L'alignement posé par l'éditeur voyage en `style="text-align:…"`. Il traverse la whitelist du
   * back, mais Angular sanitise à son tour le `[innerHTML]` : si le sanitizer retirait
   * l'attribut, le rédacteur verrait son texte centré dans l'éditeur et à plat en ligne.
   */
  it('conserve l’alignement du texte jusqu’au DOM rendu', () => {
    render('<p class="ta-center">Centré</p><p>Normal</p>');

    const paragraphes = (fixture.nativeElement as HTMLElement).querySelectorAll('.article__content p');
    expect(paragraphes.length).toBe(2);
    expect(paragraphes[0].classList.contains('ta-center')).toBeTrue();
    expect(getComputedStyle(paragraphes[0]).textAlign).toBe('center');
    expect(getComputedStyle(paragraphes[1]).textAlign).not.toBe('center');
  });

  it('sans lien : un seul bloc, le contenu tel quel', () => {
    render('<h2>Titre</h2><p>Du texte</p>');

    expect(blocks()).toEqual([{ kind: 'html', html: '<h2>Titre</h2><p>Du texte</p>' }]);
  });
});
