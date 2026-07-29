import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';

import { WysiwygEditorComponent } from './wysiwyg-editor.component';
import { environment } from '../../../environements/environment';

/**
 * On teste les fonctions PURES de nettoyage/normalisation (le cœur des correctifs
 * collage & liens). Elles sont privées → accès via cast, sans rendre la vue.
 */
describe('WysiwygEditorComponent (nettoyage collage & liens)', () => {
  let component: WysiwygEditorComponent;

  const clean = (h: string): string =>
    (component as unknown as { cleanPastedHtml(h: string): string }).cleanPastedHtml(h);
  const decode = (t: string): string =>
    (component as unknown as { decodeEntities(t: string): string }).decodeEntities(t);
  const normalize = (u: string): string =>
    (component as unknown as { normalizeUrl(u: string): string }).normalizeUrl(u);
  const semantic = (h: string): string =>
    (component as unknown as { toSemanticHtml(h: string): string }).toSemanticHtml(h);

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [WysiwygEditorComponent],
      // L'éditeur injecte BlogService (upload d'image) → HttpClient requis.
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();
    component = TestBed.createComponent(WysiwygEditorComponent).componentInstance;
  });

  /**
   * Garde-fou anti-régression : la whitelist du back (`sanitize.ts`) n'accepte ni
   * `b`, ni `i`, ni `div`. `sanitize-html` étant en mode `discard`, ces balises
   * étaient supprimées EN GARDANT le texte → la mise en forme disparaissait
   * silencieusement à l'enregistrement. La valeur émise ne doit donc jamais en
   * contenir.
   */
  describe('toSemanticHtml (survie à la whitelist du back)', () => {
    const BACK_WHITELIST = [
      'h2', 'h3', 'p', 'strong', 'em', 'ul', 'ol', 'li', 'a', 'blockquote', 'br', 'hr',
    ];
    const tagsOf = (h: string): string[] =>
      [...h.matchAll(/<([a-z0-9]+)\b/gi)].map((m) => m[1].toLowerCase());

    it('<b> → <strong> (gras via le bouton de la barre)', () => {
      expect(semantic('<b>hello</b> world')).toBe('<strong>hello</strong> world');
    });

    it('<i> → <em> (italique via le bouton de la barre)', () => {
      expect(semantic('hello <i>world</i>')).toBe('hello <em>world</em>');
    });

    it('<div> → <p> (retour à la ligne de contentEditable)', () => {
      expect(semantic('<div>ligne 1</div><div>ligne 2</div>')).toBe(
        '<p>ligne 1</p><p>ligne 2</p>',
      );
    });

    it('imbrication conservée : <div><b>x</b></div> → <p><strong>x</strong></p>', () => {
      expect(semantic('<div><b>x</b></div>')).toBe('<p><strong>x</strong></p>');
    });

    it('les balises déjà valides ne bougent pas', () => {
      const ok = '<h2>Titre</h2><p><strong>gras</strong> <em>ita</em></p><ul><li>a</li></ul>';
      expect(semantic(ok)).toBe(ok);
    });

    it('aucune balise émise hors whitelist du back', () => {
      const out = semantic('<div>para <b>gras</b> et <i>ita</i></div>');
      const rejected = tagsOf(out).filter((t) => !BACK_WHITELIST.includes(t));
      expect(rejected).toEqual([]);
    });
  });

  describe('insertion d\'image', () => {
    let http: HttpTestingController;
    const file = (name: string) =>
      new File(['x'], name, { type: 'image/png' });
    const selectFile = (f: File) =>
      component.onImageSelected({
        target: { files: [f], value: 'C:\\fakepath\\' + f.name },
      } as unknown as Event);

    beforeEach(() => {
      http = TestBed.inject(HttpTestingController);
    });

    it('téléverse le fichier puis propose le nom (sans extension) comme alt', () => {
      selectFile(file('photo-atelier.png'));
      expect(component.imageUploading()).toBe(true);

      http
        .expectOne(`${environment.blogApiUrl}/admin/blog/upload`)
        .flush({ url: 'https://cdn.moze.fr/a.png' });

      expect(component.imageUploading()).toBe(false);
      expect(component.imageDialogOpen()).toBe(true);
      expect(component.imageAltDefault()).toBe('photo-atelier');
      expect(component.imageError()).toBeNull();
    });

    it('upload en échec → message d\'erreur, pas de modale', () => {
      selectFile(file('photo.png'));
      http
        .expectOne(`${environment.blogApiUrl}/admin/blog/upload`)
        .flush('boom', { status: 500, statusText: 'Server Error' });

      expect(component.imageUploading()).toBe(false);
      expect(component.imageDialogOpen()).toBe(false);
      expect(component.imageError()).toContain('échoué');
    });

    it('annuler la modale n\'insère rien', () => {
      selectFile(file('photo.png'));
      http
        .expectOne(`${environment.blogApiUrl}/admin/blog/upload`)
        .flush({ url: 'https://cdn.moze.fr/a.png' });

      component.onImageAltCancel();
      expect(component.imageDialogOpen()).toBe(false);
    });
  });

  describe('cleanPastedHtml', () => {
    it('Google Docs : conteneur <b font-weight:normal> ignoré, styles inline → strong/em', () => {
      const input =
        '<b style="font-weight:normal"><span style="font-weight:700">Gras</span> normal <span style="font-style:italic">italique</span></b>';
      expect(clean(input)).toBe('<strong>Gras</strong> normal <em>italique</em>');
    });

    it('Word : <b> → <strong>, classes/couleurs retirées', () => {
      const input =
        "<p class=MsoNormal style='margin:0'><b>Titre</b> <span style='color:red'>rouge</span></p>";
      expect(clean(input)).toBe('<p><strong>Titre</strong> rouge</p>');
    });

    it('<style> ne fuit pas en texte', () => {
      expect(clean('<style>.x{color:red}</style><p>texte</p>')).toBe('<p>texte</p>');
    });

    it('h1 → h2, listes et liens conservés (+ target/rel)', () => {
      const input = '<h1>Titre</h1><ul><li>item <a href="http://ex.com">lien</a></li></ul>';
      expect(clean(input)).toBe(
        '<h2>Titre</h2><ul><li>item <a href="http://ex.com" target="_blank" rel="noopener noreferrer">lien</a></li></ul>',
      );
    });

    it('lien collé sans schéma → https:// ajouté', () => {
      expect(clean('<a href="ex.com">L</a>')).toBe(
        '<a href="https://ex.com" target="_blank" rel="noopener noreferrer">L</a>',
      );
    });
  });

  describe('decodeEntities', () => {
    it('décode &#39; et &amp;', () => {
      expect(decode('l&#39;été &amp; co')).toBe("l'été & co");
    });

    it('texte sans entité inchangé (coût nul)', () => {
      expect(decode('bonjour')).toBe('bonjour');
    });
  });

  /**
   * Alignement. Trois couches le retirent si on le laisse en `style` : la whitelist du back,
   * le sanitizer d'Angular au rendu, et le renommage `<div>` → `<p>` qui recrée l'élément sans
   * ses attributs. La sortie doit donc toujours porter une classe `ta-*`, jamais un style.
   */
  describe('alignement', () => {
    it('convertit le style inline d’`execCommand` en classe', () => {
      expect(semantic('<p style="text-align: center">T</p>')).toBe('<p class="ta-center">T</p>');
      expect(semantic('<h2 style="text-align: right">T</h2>')).toBe('<h2 class="ta-right">T</h2>');
    });

    it('conserve l’alignement à travers le renommage div → p', () => {
      expect(semantic('<div style="text-align: center">T</div>')).toBe(
        '<p class="ta-center">T</p>',
      );
    });

    it('reprend l’attribut `align` des vieux éditeurs', () => {
      expect(semantic('<p align="justify">T</p>')).toBe('<p class="ta-justify">T</p>');
    });

    it('ignore une valeur d’alignement inconnue, et le reste du style', () => {
      expect(semantic('<p style="text-align: inherit">T</p>')).toBe('<p>T</p>');
      expect(semantic('<p style="color: red">T</p>')).toBe('<p>T</p>');
    });

    it('ne laisse jamais passer un `style`', () => {
      const html = semantic('<p style="text-align:center;color:red">T</p>');
      expect(html).not.toContain('style');
      expect(html).toContain('ta-center');
    });

    it('laisse intact un contenu déjà enregistré', () => {
      // Rechargement d'un article : la classe est déjà là, rien ne doit bouger.
      expect(semantic('<p class="ta-center">T</p>')).toBe('<p class="ta-center">T</p>');
    });

    it('conserve l’alignement d’un collage Word ou Docs', () => {
      expect(clean('<p style="text-align:center">T</p>')).toBe('<p class="ta-center">T</p>');
      expect(clean('<div align="right">T</div>')).toBe('<p class="ta-right">T</p>');
    });
  });

  describe('normalizeUrl', () => {
    it('ajoute https:// sans schéma', () => {
      expect(normalize('ex.com')).toBe('https://ex.com');
    });

    it('laisse un https:// existant', () => {
      expect(normalize('https://x.fr')).toBe('https://x.fr');
    });

    it('email → mailto:', () => {
      expect(normalize('a@b.fr')).toBe('mailto:a@b.fr');
    });
  });
});

/**
 * Garde-fou : un lien dont le texte affiché est une adresse différente de sa destination.
 * Ici la vue est rendue — la détection travaille sur le DOM de la zone éditable.
 */
describe('WysiwygEditorComponent (lien affiché ≠ destination)', () => {
  let fixture: ComponentFixture<WysiwygEditorComponent>;
  let component: WysiwygEditorComponent;
  let emitted: string | null;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [WysiwygEditorComponent],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();

    fixture = TestBed.createComponent(WysiwygEditorComponent);
    component = fixture.componentInstance;
    emitted = null;
    component.registerOnChange((value) => (emitted = value));
  });

  /** Ouvre l'éditeur sur un contenu existant (comme à l'édition d'un article enregistré). */
  function open(html: string): void {
    component.writeValue(html);
    fixture.detectChanges();
  }

  const link = (href: string, label: string) =>
    `<p><a href="${href}" target="_blank" rel="noopener noreferrer">${label}</a></p>`;

  it('signale dès l’ouverture un lien qui affiche une adresse et mène ailleurs', () => {
    open(link('https://x.com/user/status/123?s=46', 'https://www.youtube.com/watch?v=abc'));

    expect(component.mismatchedLinks()).toEqual([
      {
        shown: 'https://www.youtube.com/watch?v=abc',
        target: 'https://x.com/user/status/123?s=46',
        targetHost: 'x.com',
      },
    ]);
  });

  it('se tait quand le libellé est une phrase', () => {
    open(link('https://x.com/a', 'voir notre guide'));

    expect(component.mismatchedLinks()).toEqual([]);
  });

  it('se tait sur les écarts de présentation (schéma, www., barre finale)', () => {
    open(
      link('https://www.moze.fr/blog/', 'moze.fr/blog') +
        link('https://exemple.fr/a', 'http://exemple.fr/a'),
    );

    expect(component.mismatchedLinks()).toEqual([]);
  });

  it('relève chaque lien fautif', () => {
    open(
      link('https://x.com/a', 'https://youtube.com/watch?v=1') +
        link('https://ok.fr/a', 'https://ok.fr/a') +
        link('https://b.fr/a', 'https://c.fr/a'),
    );

    expect(component.mismatchedLinks().map((l) => l.targetHost)).toEqual(['x.com', 'b.fr']);
  });

  it('le bouton fait pointer le lien vers l’adresse affichée', () => {
    open(link('https://x.com/user/status/123', 'https://www.youtube.com/watch?v=abc'));

    component.alignMismatchedLinks();
    fixture.detectChanges();

    expect(component.mismatchedLinks()).toEqual([]);
    expect(emitted).toContain('href="https://www.youtube.com/watch?v=abc"');
    expect(emitted).not.toContain('x.com');
    // Le libellé, lui, n'est pas touché : c'est la saisie la plus récente de l'auteur.
    expect(emitted).toContain('>https://www.youtube.com/watch?v=abc</a>');
  });

  it('affiche l’avertissement sous la barre, et le clic le fait disparaître', () => {
    open(link('https://x.com/user/status/123', 'https://www.youtube.com/watch?v=abc'));

    const banner: HTMLElement = fixture.nativeElement.querySelector('.wys-mismatch');
    expect(banner).not.toBeNull();
    expect(banner.textContent).toContain('Un lien affiche une adresse');
    expect(banner.textContent).toContain('https://www.youtube.com/watch?v=abc');
    expect(banner.textContent).toContain('x.com');

    banner.querySelector<HTMLButtonElement>('.wys-mismatch__fix')!.click();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.wys-mismatch')).toBeNull();
    expect(emitted).toContain('href="https://www.youtube.com/watch?v=abc"');
  });

  it('un libellé sans schéma donne une destination absolue', () => {
    open(link('https://x.com/a', 'www.moze.fr/blog'));

    component.alignMismatchedLinks();

    expect(emitted).toContain('href="https://www.moze.fr/blog"');
  });

  it('éditeur désactivé : le bouton ne modifie rien', () => {
    open(link('https://x.com/a', 'https://youtube.com/watch?v=abc'));
    component.setDisabledState(true);

    component.alignMismatchedLinks();

    expect(emitted).toBeNull();
    expect(component.mismatchedLinks().length).toBe(1);
  });
});

/**
 * Rendu de la zone éditable. Ce qu'elle contient vient de `innerHTML`, donc sans attribut
 * d'encapsulation Angular : une règle de style écrite sans `::ng-deep` y est compilée en
 * `.ta-center[_ngcontent-…]` et ne s'applique jamais. Le défaut ne se voit qu'à la réouverture
 * d'un article — à la frappe, l'inline d'`execCommand` masque le problème.
 */
describe('WysiwygEditorComponent (alignement à la réouverture)', () => {
  let fixture: ComponentFixture<WysiwygEditorComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [WysiwygEditorComponent],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();

    fixture = TestBed.createComponent(WysiwygEditorComponent);
  });

  function open(html: string): HTMLElement {
    fixture.componentInstance.writeValue(html);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('affiche l’alignement d’un contenu déjà enregistré', () => {
    const host = open(
      '<p class="ta-center">Centré</p><p class="ta-right">Droite</p>' +
        '<p class="ta-justify">Justifié</p><p>Normal</p>',
    );

    const paragraphes = host.querySelectorAll('.wys-editable p');
    expect(getComputedStyle(paragraphes[0]).textAlign).toBe('center');
    expect(getComputedStyle(paragraphes[1]).textAlign).toBe('right');
    expect(getComputedStyle(paragraphes[2]).textAlign).toBe('justify');
    expect(getComputedStyle(paragraphes[3]).textAlign).not.toBe('center');
  });

  it('vaut aussi pour les titres et les listes', () => {
    const host = open('<h2 class="ta-center">Titre</h2><ul><li class="ta-right">item</li></ul>');

    expect(getComputedStyle(host.querySelector('.wys-editable h2')!).textAlign).toBe('center');
    expect(getComputedStyle(host.querySelector('.wys-editable li')!).textAlign).toBe('right');
  });
});
