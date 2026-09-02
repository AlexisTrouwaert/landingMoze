import { importArticleFromDocx, unwrapParenthesisedUrls } from './article-import';
import { DocxReadError, readDocx } from './docx';

/**
 * Les documents de test sont fabriqués ici, en ZIP « stocké » (sans compression) : quelques
 * dizaines de lignes valent mieux qu'un binaire opaque commité, qu'on ne saurait ni relire ni
 * modifier pour couvrir un cas de plus.
 */
const W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';

function zip(files: Record<string, string>): Blob {
  const encoder = new TextEncoder();
  const locals: Uint8Array[] = [];
  const centrals: Uint8Array[] = [];
  let offset = 0;

  for (const [name, content] of Object.entries(files)) {
    const nameBytes = encoder.encode(name);
    const data = encoder.encode(content);

    const local = new Uint8Array(30 + nameBytes.length + data.length);
    const lv = new DataView(local.buffer);
    lv.setUint32(0, 0x04034b50, true);
    lv.setUint16(8, 0, true); // méthode 0 : stocké
    lv.setUint32(18, data.length, true);
    lv.setUint32(22, data.length, true);
    lv.setUint16(26, nameBytes.length, true);
    local.set(nameBytes, 30);
    local.set(data, 30 + nameBytes.length);
    locals.push(local);

    const central = new Uint8Array(46 + nameBytes.length);
    const cv = new DataView(central.buffer);
    cv.setUint32(0, 0x02014b50, true);
    cv.setUint16(10, 0, true);
    cv.setUint32(20, data.length, true);
    cv.setUint32(24, data.length, true);
    cv.setUint16(28, nameBytes.length, true);
    cv.setUint32(42, offset, true);
    central.set(nameBytes, 46);
    centrals.push(central);

    offset += local.length;
  }

  const centralSize = centrals.reduce((n, c) => n + c.length, 0);
  const eocd = new Uint8Array(22);
  const ev = new DataView(eocd.buffer);
  ev.setUint32(0, 0x06054b50, true);
  ev.setUint16(8, centrals.length, true);
  ev.setUint16(10, centrals.length, true);
  ev.setUint32(12, centralSize, true);
  ev.setUint32(16, offset, true);

  return new Blob([...locals, ...centrals, eocd] as BlobPart[]);
}

/** Un paragraphe WordprocessingML : `style` vide = paragraphe courant. */
function p(text: string, style = '', options: { bold?: boolean } = {}): string {
  const pPr = style ? `<w:pPr><w:pStyle w:val="${style}"/></w:pPr>` : '';
  const rPr = options.bold ? '<w:rPr><w:b/></w:rPr>' : '';
  return `<w:p>${pPr}<w:r>${rPr}<w:t xml:space="preserve">${text}</w:t></w:r></w:p>`;
}

function docx(body: string, extra: Record<string, string> = {}): Blob {
  return zip({
    'word/document.xml': `<?xml version="1.0"?><w:document xmlns:w="${W}"><w:body>${body}</w:body></w:document>`,
    ...extra,
  });
}

describe('readDocx', () => {
  it('rend les paragraphes avec leur niveau de titre, et ignore les vides', async () => {
    const doc = await readDocx(
      docx(p('Mon titre', 'Titre1') + p('') + p('Du texte') + p('Section', 'Heading2')),
    );

    expect(doc.paragraphs.map((x) => [x.heading, x.text])).toEqual([
      [1, 'Mon titre'],
      [0, 'Du texte'],
      [2, 'Section'],
    ]);
  });

  it('rend le gras en <strong> et échappe le HTML du texte', async () => {
    const doc = await readDocx(docx(p('a &amp; b &lt;i&gt;', '', { bold: true })));

    // L'esperluette reste une esperluette, et les chevrons ne deviennent pas une balise.
    expect(doc.paragraphs[0].html).toBe('<strong>a &amp; b &lt;i&gt;</strong>');
  });

  it('refuse un fichier qui n’est pas un document Word', async () => {
    await expectAsync(readDocx(zip({ 'autre.txt': 'bonjour' }))).toBeRejectedWithError(
      DocxReadError,
    );
    await expectAsync(readDocx(new Blob(['pas une archive']))).toBeRejectedWithError(
      DocxReadError,
    );
  });
});

/**
 * Les documents écrivent souvent « Ancre « … » — (https://moze.fr/blog/x) » : la parenthèse
 * fermante colle à l'adresse et en fait un lien mort.
 */
describe('unwrapParenthesisedUrls', () => {
  it('retire la paire qui encadre exactement une URL', () => {
    expect(unwrapParenthesisedUrls('Voir (https://moze.fr/blog/x) ici')).toBe(
      'Voir https://moze.fr/blog/x ici',
    );
    expect(unwrapParenthesisedUrls('(www.moze.fr)')).toBe('www.moze.fr');
  });

  it('laisse les parenthèses qui n’encadrent pas une URL', () => {
    expect(unwrapParenthesisedUrls('un aparté (voir plus bas)')).toBe(
      'un aparté (voir plus bas)',
    );
    expect(unwrapParenthesisedUrls('la TVA (20 %) s’applique')).toBe('la TVA (20 %) s’applique');
  });

  it('ne touche pas à une parenthèse contenue DANS une URL', () => {
    const texte = 'https://fr.wikipedia.org/wiki/Foo_(bar) est la source';

    expect(unwrapParenthesisedUrls(texte)).toBe(texte);
  });

  it('laisse une parenthèse contenant une URL ET autre chose', () => {
    const texte = 'la source (voir https://moze.fr) dit le contraire';

    expect(unwrapParenthesisedUrls(texte)).toBe(texte);
  });

  it('traite plusieurs URL dans le même texte', () => {
    expect(unwrapParenthesisedUrls('(https://a.fr) puis (https://b.fr)')).toBe(
      'https://a.fr puis https://b.fr',
    );
  });
});

describe('importArticleFromDocx', () => {
  /** La trame de la rédaction : métadonnées, posts réseaux sociaux, puis l'article. */
  const trame =
    p('Métadonnées éditoriales', 'Titre1') +
    p('Titre : Mon bel article', '', { bold: true }) +
    p('Slug (à saisir manuellement dans le CMS) : mon-bel-article', '', { bold: true }) +
    p('Extrait : Un résumé : avec deux-points dedans.', '', { bold: true }) +
    p('Tags : Freelance, Micro-entrepreneur, gestion du temps', '', { bold: true }) +
    p('Meta title (50 caractères) : Titre SEO : la suite', '', { bold: true }) +
    p('Meta description (148 caractères) : Description SEO.', '', { bold: true }) +
    p('Post LinkedIn', 'Titre2') +
    p('Ce texte de post ne doit PAS finir dans l’article.') +
    p('Mon bel article', 'Titre1') +
    p('Le premier paragraphe.') +
    p('Une section', 'Titre2') +
    p('Le second paragraphe.');

  it('remplit tous les champs étiquetés', async () => {
    const out = await importArticleFromDocx(docx(trame));

    expect(out.values.title).toBe('Mon bel article');
    expect(out.values.slug).toBe('mon-bel-article');
    // Découpe sur le PREMIER deux-points : la valeur en contient un.
    expect(out.values.excerpt).toBe('Un résumé : avec deux-points dedans.');
    expect(out.values.metaTitle).toBe('Titre SEO : la suite');
    expect(out.values.tags).toEqual(['Freelance', 'Micro-entrepreneur', 'gestion du temps']);
  });

  it('ne garde comme contenu que ce qui suit le titre de l’article', async () => {
    const out = await importArticleFromDocx(docx(trame));

    expect(out.values.content).toBe(
      '<p>Le premier paragraphe.</p>\n<h2>Une section</h2>\n<p>Le second paragraphe.</p>',
    );
    // Ni les métadonnées, ni les posts réseaux sociaux.
    expect(out.values.content).not.toContain('post');
    expect(out.values.content).not.toContain('Slug');
  });

  it('signale l’image de couverture comme manquante — elle n’est jamais importée', async () => {
    const out = await importArticleFromDocx(docx(trame));

    expect(out.missing).toEqual(['coverImageUrl']);
    expect(out.filled).toContain('title');
    expect(out.filled).toContain('content');
  });

  it('liste tous les champs vides d’un document sans métadonnées', async () => {
    const out = await importArticleFromDocx(
      docx(p('Un titre nu', 'Titre1') + p('Juste du texte.')),
    );

    // Le titre de niveau 1 fait foi, le reste est le corps ; tout le reste manque.
    expect(out.values.title).toBe('Un titre nu');
    expect(out.values.content).toBe('<p>Juste du texte.</p>');
    expect(out.missing).toEqual([
      'slug',
      'excerpt',
      'tags',
      'metaTitle',
      'metaDescription',
      'coverImageUrl',
    ]);
  });

  it('ramène les titres dans la plage acceptée par le back (h2, h3)', async () => {
    const out = await importArticleFromDocx(
      docx(p('T', 'Titre1') + p('Deux', 'Titre2') + p('Trois', 'Titre3') + p('Quatre', 'Titre4')),
    );

    expect(out.values.content).toBe('<h2>Deux</h2>\n<h3>Trois</h3>\n<h3>Quatre</h3>');
    // Jamais de h1 dans le contenu : la page en rend déjà un avec le titre de l'article.
    expect(out.values.content).not.toContain('<h1');
  });

  it('ne prend pas une phrase du corps pour une étiquette', async () => {
    const out = await importArticleFromDocx(
      docx(
        p('T', 'Titre1') +
          p('Une phrase assez longue qui contient un deux-points : et sa suite.'),
      ),
    );

    expect(out.values.excerpt).toBeUndefined();
    expect(out.values.content).toContain('deux-points');
  });

  it('retire les parenthèses autour des URL du contenu importé', async () => {
    const out = await importArticleFromDocx(
      docx(
        p('T', 'Titre1') +
          p('Voir (https://moze.fr/blog/mon-article) pour la suite (et rien d’autre).'),
      ),
    );

    // Plus de parenthèses collées à l'adresse — et elle est devenue un vrai lien au passage.
    expect(out.values.content).toContain(
      'Voir <a href="https://moze.fr/blog/mon-article"',
    );
    expect(out.values.content).not.toContain('(<a');
    expect(out.values.content).not.toContain('</a>)');
    // La parenthèse qui n'entoure PAS une URL reste intacte.
    expect(out.values.content).toContain('(et rien d’autre)');
  });

  it('transforme en liens les adresses tapées en texte brut', async () => {
    const out = await importArticleFromDocx(
      docx(p('T', 'Titre1') + p('La suite sur https://moze.fr/blog/mon-article aujourd’hui.')),
    );

    // Sans ça, l'URL arrivait inerte dans l'éditeur, impossible à distinguer d'une phrase.
    expect(out.values.content).toContain('<a href="https://moze.fr/blog/mon-article"');
    expect(out.values.content).toContain('>https://moze.fr/blog/mon-article</a>');
  });

  it('la parenthèse retirée n’empêche pas la détection du lien', async () => {
    const out = await importArticleFromDocx(
      docx(p('T', 'Titre1') + p('Voir (https://moze.fr/blog/x) pour la suite.')),
    );

    expect(out.values.content).toContain('<a href="https://moze.fr/blog/x"');
    expect(out.values.content).not.toContain('(<a');
  });

  it('signale un document qui embarque des images', async () => {
    const avec = await importArticleFromDocx(
      docx(p('T', 'Titre1'), { 'word/media/image1.png': 'binaire' }),
    );
    const sans = await importArticleFromDocx(docx(p('T', 'Titre1')));

    expect(avec.hasImages).toBeTrue();
    expect(sans.hasImages).toBeFalse();
  });
});
