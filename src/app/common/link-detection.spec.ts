import { collectUrls, findUrls, linkifyHtml, sameUrl } from './link-detection';

describe('link-detection', () => {
  describe('findUrls', () => {
    it('repère les URL explicites et les domaines en www.', () => {
      const found = findUrls('Voir https://a.fr/x ou www.b.fr aujourd’hui');

      expect(found.map((u) => u.href)).toEqual(['https://a.fr/x', 'https://www.b.fr']);
    });

    it('laisse à la phrase sa ponctuation finale', () => {
      expect(findUrls('Rendez-vous sur https://a.fr.')[0].href).toBe('https://a.fr');
      expect(findUrls('(voir https://a.fr/x)')[0].href).toBe('https://a.fr/x');
    });

    it('garde une parenthèse qui appartient à l’URL', () => {
      expect(findUrls('https://fr.wikipedia.org/wiki/Vim_(logiciel)')[0].href).toBe(
        'https://fr.wikipedia.org/wiki/Vim_(logiciel)',
      );
    });
  });

  describe('linkifyHtml', () => {
    it('rend cliquable une URL laissée en texte brut', () => {
      const html = linkifyHtml('<p>Voir https://a.fr/x</p>', document);

      expect(html).toContain('<a href="https://a.fr/x"');
      expect(html).toContain('rel="noopener noreferrer"');
    });

    it('ne touche ni aux ancres existantes ni aux blocs de code', () => {
      const source = '<p><a href="https://a.fr">mon lien</a> <code>https://b.fr</code></p>';

      const html = linkifyHtml(source, document);

      expect(html).toBe(source);
    });
  });

  describe('sameUrl', () => {
    it('ignore les écarts de présentation', () => {
      expect(sameUrl('https://moze.fr/blog', 'moze.fr/blog')).toBeTrue();
      expect(sameUrl('https://www.moze.fr/blog', 'moze.fr/blog')).toBeTrue();
      expect(sameUrl('https://moze.fr/blog/', 'https://moze.fr/blog')).toBeTrue();
      expect(sameUrl('http://moze.fr', 'https://MOZE.fr')).toBeTrue();
    });

    it('distingue deux destinations différentes', () => {
      expect(sameUrl('https://moze.fr/a', 'https://moze.fr/b')).toBeFalse();
      expect(sameUrl('https://youtube.com/watch?v=1', 'https://x.com/a')).toBeFalse();
      // Le chemin compte : un sous-domaine n'est pas le domaine.
      expect(sameUrl('https://blog.moze.fr', 'https://moze.fr')).toBeFalse();
    });
  });

  describe('collectUrls', () => {
    it('relève les liens dans l’ordre du document, sans doublon', () => {
      const html =
        '<p><a href="https://b.fr">b</a></p><p><a href="https://a.fr">a</a>' +
        '<a href="https://b.fr">encore b</a></p>';

      expect(collectUrls(html, document)).toEqual(['https://b.fr', 'https://a.fr']);
    });

    it('écarte ce qui n’est pas une ressource externe', () => {
      const html =
        '<a href="/blog/x">interne</a><a href="mailto:a@b.fr">mail</a>' +
        '<a href="https://a.fr">externe</a>';

      expect(collectUrls(html, document)).toEqual(['https://a.fr']);
    });

    it('ignore une URL citée comme du code', () => {
      expect(collectUrls('<pre><a href="https://a.fr">x</a></pre>', document)).toEqual([]);
    });
  });
});
