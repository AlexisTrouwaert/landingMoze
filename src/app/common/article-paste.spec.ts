import { parsePastedArticles } from './article-paste';

/**
 * Lecture d'articles collés.
 *
 * Le sujet de ce fichier : être **tolérant sur la forme, intraitable sur le fond**. Une clé
 * accentuée, une majuscule, un séparateur en trop ne doivent rien casser ; un titre manquant
 * ou une date sans fuseau doivent arrêter net, avant l'envoi.
 */
describe('parsePastedArticles', () => {
  const DEMAIN = () => {
    const d = new Date(Date.now() + 86_400_000);
    // Fuseau explicite : c'est justement ce que l'analyseur exige.
    return d.toISOString();
  };

  const bloc = (entete: string, corps = '<p>Un contenu.</p>') =>
    `${entete}\n---\n${corps}`;

  it('lit un article complet', () => {
    const { articles, errors } = parsePastedArticles(
      bloc(
        [
          'titre: La journée type du freelance',
          'slug: journee-type',
          'extrait: Un résumé.',
          'tags: Freelance, gestion du temps',
          'metaTitle: Journée type',
          'metaDescription: Une description.',
          `date: ${DEMAIN()}`,
          'alaune: oui',
        ].join('\n'),
        '<h2>Titre</h2><p>Corps.</p>',
      ),
    );

    expect(errors).toEqual([]);
    expect(articles.length).toBe(1);
    expect(articles[0].input).toEqual(
      jasmine.objectContaining({
        title: 'La journée type du freelance',
        slug: 'journee-type',
        excerpt: 'Un résumé.',
        tags: ['Freelance', 'gestion du temps'],
        content: '<h2>Titre</h2><p>Corps.</p>',
        origin: 'ASSISTANT',
      }),
    );
    expect(articles[0].proposedFeatured).toBe(true);
    expect(articles[0].proposedPublishAt).not.toBeNull();
  });

  describe('tolérance sur la forme', () => {
    it('accepte les clés accentuées, en majuscules ou espacées', () => {
      const { articles, errors } = parsePastedArticles(
        bloc(['TITRE: Un titre', 'Méta Title: Pour les moteurs'].join('\n')),
      );

      expect(errors).toEqual([]);
      expect(articles[0].input.title).toBe('Un titre');
      expect(articles[0].input.metaTitle).toBe('Pour les moteurs');
    });

    it('ne coupe la valeur qu’au premier deux-points', () => {
      const { articles } = parsePastedArticles(
        bloc('titre: Facturation : le guide complet'),
      );

      expect(articles[0].input.title).toBe('Facturation : le guide complet');
    });

    it('ignore un séparateur en trop plutôt que d’inventer un article vide', () => {
      const { articles, errors } = parsePastedArticles(
        `${bloc('titre: Premier')}\n===\n${bloc('titre: Second')}\n===\n`,
      );

      expect(errors).toEqual([]);
      expect(articles.map((a) => a.input.title)).toEqual(['Premier', 'Second']);
    });

    it('signale les lignes d’en-tête inconnues sans bloquer', () => {
      const { articles, errors } = parsePastedArticles(
        bloc(['titre: Un titre', 'humeur: joyeuse'].join('\n')),
      );

      expect(errors).toEqual([]);
      expect(articles[0].warnings.join(' ')).toContain('humeur');
    });
  });

  describe('intransigeance sur le fond', () => {
    it('titre manquant : refusé', () => {
      const { articles, errors } = parsePastedArticles(bloc('slug: sans-titre'));

      expect(articles.length).toBe(0);
      expect(errors[0]).toContain('titre');
    });

    it('corps vide : refusé', () => {
      const { articles, errors } = parsePastedArticles('titre: Un titre\n---\n');

      expect(articles.length).toBe(0);
      expect(errors[0]).toContain('corps');
    });

    /**
     * Le mode de défaillance qu'on traque depuis le début : sans fuseau, l'heure serait lue
     * comme de l'UTC et l'article paraîtrait décalé de deux heures. Invisible à la relecture.
     */
    it('date sans fuseau : refusée, avec l’exemple à suivre', () => {
      const { articles, errors } = parsePastedArticles(
        bloc(['titre: Un titre', 'date: 2026-09-14T08:00:00'].join('\n')),
      );

      expect(articles.length).toBe(0);
      expect(errors[0]).toContain('fuseau');
      expect(errors[0]).toContain('+02:00');
    });

    it('date déjà passée : refusée avant l’envoi', () => {
      const hier = new Date(Date.now() - 86_400_000).toISOString();
      const { articles, errors } = parsePastedArticles(
        bloc(['titre: Un titre', `date: ${hier}`].join('\n')),
      );

      expect(articles.length).toBe(0);
      expect(errors[0]).toContain('passée');
    });

    it('titre trop long pour le back : refusé ici plutôt que là-bas', () => {
      const { articles, errors } = parsePastedArticles(
        bloc(`titre: ${'a'.repeat(201)}`),
      );

      expect(articles.length).toBe(0);
      expect(errors[0]).toContain('200');
    });

    it('un bloc fautif nomme son rang', () => {
      const { errors } = parsePastedArticles(
        `${bloc('titre: Premier')}\n===\n${bloc('slug: sans-titre')}`,
      );

      expect(errors[0]).toContain('Article 2');
    });
  });

  it('prévient si le corps contient un <h1>', () => {
    const { articles } = parsePastedArticles(
      bloc('titre: Un titre', '<h1>Doublon</h1><p>Corps.</p>'),
    );

    expect(articles[0].warnings.join(' ')).toContain('<h1>');
  });

  it('texte vide : une erreur, pas un plantage', () => {
    const { articles, errors } = parsePastedArticles('   \n  ');

    expect(articles.length).toBe(0);
    expect(errors.length).toBe(1);
  });
});
