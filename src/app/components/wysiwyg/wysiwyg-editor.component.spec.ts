import { TestBed } from '@angular/core/testing';
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
