import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';

import { AdminBlogEditorComponent } from './admin-blog-editor.component';
import { Article, ArticleListItem } from '../../model/article.model';
import { BlogService } from '../../services/blog.service';

describe('AdminBlogEditorComponent', () => {
  let component: AdminBlogEditorComponent;
  let blog: jasmine.SpyObj<BlogService>;

  beforeEach(async () => {
    blog = jasmine.createSpyObj<BlogService>('BlogService', [
      'adminTags',
      'adminGet',
      'create',
      'update',
      'publish',
      'createTag',
      'renameTag',
      'deleteTag',
      'upload',
      'featured',
      'feature',
      'unfeature',
    ]);
    blog.adminTags.and.returnValue(of([]));

    await TestBed.configureTestingModule({
      imports: [AdminBlogEditorComponent],
      providers: [
        provideRouter([]),
        { provide: BlogService, useValue: blog },
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { paramMap: { get: () => null } } },
        },
      ],
    }).compileComponents();

    // Pas de detectChanges : on teste la logique, pas le rendu (évite d'instancier
    // tous les composants enfants). Le constructeur a déjà tourné (adminTags mocké).
    component = TestBed.createComponent(AdminBlogEditorComponent).componentInstance;
  });

  const extractError = (err: unknown): string | null =>
    (
      component as unknown as { extractError(e: unknown): string | null }
    ).extractError(err);

  describe('extractError', () => {
    it('message string → tel quel', () => {
      expect(extractError({ error: { message: 'boom' } })).toBe('boom');
    });
    it('message array → joint par « · »', () => {
      expect(extractError({ error: { message: ['a', 'b'] } })).toBe('a · b');
    });
    it('pas de message → null', () => {
      expect(extractError({})).toBeNull();
      expect(extractError(undefined)).toBeNull();
    });
  });

  describe('validation de longueur (garde-fou #4)', () => {
    it('extrait > 500 → invalide', () => {
      component.form.controls.excerpt.setValue('x'.repeat(501));
      expect(component.form.controls.excerpt.invalid).toBe(true);
    });
    it('extrait = 500 → valide', () => {
      component.form.controls.excerpt.setValue('x'.repeat(500));
      expect(component.form.controls.excerpt.valid).toBe(true);
    });
    it('titre obligatoire', () => {
      component.form.controls.title.setValue('');
      expect(component.form.controls.title.invalid).toBe(true);
    });
  });

  describe('adresse publique de l’article', () => {
    it('null tant qu’aucun slug n’est connu — le back le dérivera du titre', () => {
      expect(component.publicUrl()).toBeNull();
    });

    it('compose l’adresse avec l’origine courante (localhost en dev, moze.fr en prod)', () => {
      component.form.controls.slug.setValue('journee-type-freelance-existe-pas');

      expect(component.publicUrl()).toBe(
        `${location.origin}/blog/journee-type-freelance-existe-pas`,
      );
    });

    it('retombe sur le slug enregistré quand le champ est vide', () => {
      component.savedSlug.set('mon-article');

      expect(component.publicUrl()).toBe(`${location.origin}/blog/mon-article`);
    });

    it('copyPublicUrl écrit l’adresse complète et lève l’accusé', async () => {
      const clipboard = {
        writeText: jasmine.createSpy('writeText').and.returnValue(Promise.resolve()),
      };
      // `navigator.clipboard` n'est ni toujours défini ni inscriptible : on le
      // remplace le temps du test, puis on rend l'original.
      const original = Object.getOwnPropertyDescriptor(navigator, 'clipboard');
      Object.defineProperty(navigator, 'clipboard', {
        value: clipboard,
        configurable: true,
      });

      component.form.controls.slug.setValue('mon-article');
      component.copyPublicUrl();
      await Promise.resolve();
      await Promise.resolve();

      expect(clipboard.writeText).toHaveBeenCalledWith(
        `${location.origin}/blog/mon-article`,
      );
      expect(component.urlCopied()).toBeTrue();

      if (original) Object.defineProperty(navigator, 'clipboard', original);
      else delete (navigator as unknown as Record<string, unknown>)['clipboard'];
    });
  });

  describe('save() — remontée du vrai message back (correctif #3)', () => {
    it('affiche le message renvoyé par le back au lieu du générique', () => {
      component.form.controls.title.setValue('Un titre');
      // Sans tag, save() ouvre d'abord la modale du tag par défaut et ne
      // soumet pas (cf. test « aucun tag » ci-dessous).
      component.form.controls.tags.setValue(['Moze']);
      blog.create.and.returnValue(
        throwError(() => ({
          error: { message: 'excerpt must be shorter than or equal to 500 characters' },
        })),
      );
      component.save(false);
      expect(blog.create).toHaveBeenCalled();
      expect(component.error()).toBe(
        'excerpt must be shorter than or equal to 500 characters',
      );
      expect(component.saving()).toBe(false);
    });

    it('formulaire invalide → ne soumet pas', () => {
      component.form.controls.title.setValue(''); // requis manquant
      component.save(false);
      expect(blog.create).not.toHaveBeenCalled();
    });
  });

  /**
   * « Mettre à la une » depuis l'éditeur. La règle du back : seuls des articles publiés, cinq au
   * plus — à la limite, l'auteur choisit lequel cède sa place plutôt que d'essuyer un refus.
   */
  describe('mise à la une depuis l’éditeur', () => {
    /** Place le composant dans l'état « article publié ouvert ». */
    function openPublished(featuredAt: string | null = null): void {
      component.id.set('a1');
      component.status.set('PUBLISHED');
      component.featuredAt.set(featuredAt);
    }

    const item = (id: string): ArticleListItem => ({
      id,
      slug: id,
      title: `Titre ${id}`,
      excerpt: '',
      coverImageUrl: null,
      author: '',
      publishedAt: null,
      tags: [],
    });

    it('sur un brouillon : enregistre une INTENTION, sans jamais épingler tout de suite', () => {
      component.id.set('a1');
      component.status.set('DRAFT');
      blog.featured.and.returnValue(of([]));

      component.toggleFeature();

      expect(component.pendingFeature()).toBeTrue();
      // Le back n'épingle que du publié : rien ne part avant la mise en ligne.
      expect(blog.feature).not.toHaveBeenCalled();
    });

    it('épingle directement quand la une a de la place', () => {
      openPublished();
      blog.featured.and.returnValue(of([item('u1')]));
      blog.feature.and.returnValue(of({ featuredAt: '2026-08-26T00:00:00Z' } as Article));

      component.toggleFeature();

      expect(blog.feature).toHaveBeenCalledWith('a1', undefined);
      expect(component.isFeatured()).toBeTrue();
      expect(component.featureSwapChoices()).toBeNull();
    });

    it('à 5/5 : propose l’échange au lieu d’épingler', () => {
      openPublished();
      const cinq = ['u1', 'u2', 'u3', 'u4', 'u5'].map(item);
      blog.featured.and.returnValue(of(cinq));

      component.toggleFeature();

      expect(blog.feature).not.toHaveBeenCalled();
      expect(component.featureSwapChoices()?.length).toBe(5);
    });

    it('l’échange part en un seul appel : le back libère la place et épingle', () => {
      openPublished();
      component.featureSwapChoices.set(['u1', 'u2'].map(item));
      blog.feature.and.returnValue(of({ featuredAt: '2026-08-26T00:00:00Z' } as Article));

      component.swapFeature(item('u2'));

      // Deux appels laissaient une fenêtre où la une n'avait que quatre articles ;
      // surtout, c'est le back qui doit décider si l'échange attend la parution.
      expect(blog.unfeature).not.toHaveBeenCalled();
      expect(blog.feature).toHaveBeenCalledWith('a1', 'u2');
      expect(component.isFeatured()).toBeTrue();
      expect(component.featureSwapChoices()).toBeNull();
    });

    it('déjà à la une : le même bouton retire', () => {
      openPublished('2026-08-01T00:00:00Z');
      blog.unfeature.and.returnValue(of({ featuredAt: null } as Article));

      component.toggleFeature();

      expect(blog.unfeature).toHaveBeenCalledWith('a1');
      expect(component.isFeatured()).toBeFalse();
    });

    describe('intention sur un article pas encore publié', () => {
      it('enregistre l’intention quand la une a de la place — sans rien épingler', () => {
        blog.featured.and.returnValue(of([item('u1')]));

        component.toggleFeature();

        expect(component.pendingFeature()).toBeTrue();
        expect(blog.feature).not.toHaveBeenCalled();
      });

      it('re-cliquer annule l’intention', () => {
        component.pendingFeature.set(true);

        component.toggleFeature();

        expect(component.pendingFeature()).toBeFalse();
        expect(blog.featured).not.toHaveBeenCalled();
      });

      it('à 5/5 : la popup s’ouvre, le choix est mémorisé — l’échange attendra la mise en ligne', () => {
        const cinq = ['u1', 'u2', 'u3', 'u4', 'u5'].map(item);
        blog.featured.and.returnValue(of(cinq));

        component.toggleFeature();
        expect(component.featureSwapChoices()?.length).toBe(5);

        component.swapFeature(item('u3'));

        expect(component.pendingFeature()).toBeTrue();
        expect(component.pendingSwap()?.id).toBe('u3');
        expect(component.featureSwapChoices()).toBeNull();
        // Rien ne part maintenant : l'échange a lieu à la publication.
        expect(blog.unfeature).not.toHaveBeenCalled();
        expect(blog.feature).not.toHaveBeenCalled();
      });

      it('à la publication, l’intention part avec l’article à remplacer', () => {
        const navigate = spyOn(TestBed.inject(Router), 'navigate').and.resolveTo(true);
        component.pendingFeature.set(true);
        component.pendingSwap.set(item('u3'));
        blog.feature.and.returnValue(of({ featuredAt: '2026-08-26T00:00:00Z' } as Article));

        (
          component as unknown as { applyPendingFeature(id: string): void }
        ).applyPendingFeature('a1');

        // Un seul appel : le back applique l'échange, ou le mémorise si l'article n'est
        // que programmé — auquel cas u3 reste à la une jusqu'à la parution.
        expect(blog.unfeature).not.toHaveBeenCalled();
        expect(blog.feature).toHaveBeenCalledWith('a1', 'u3');
        expect(navigate).toHaveBeenCalled();
        expect(component.pendingFeature()).toBeFalse();
      });
    });
  });

  /**
   * Publication programmée : l'article prend une date future et reste masqué du public jusqu'à
   * l'échéance (filtre côté back) — il paraît alors daté de l'heure choisie.
   */
  describe('publication programmée', () => {
    it('statut « Programmé » quand la date de publication est à venir', () => {
      component.status.set('PUBLISHED');
      component.articlePublishedAt.set(new Date(Date.now() + 3600_000).toISOString());

      expect(component.isScheduled()).toBeTrue();
      expect(component.statusLabel()).toBe('Programmé');
    });

    it('statut « Publié » quand la date est passée', () => {
      component.status.set('PUBLISHED');
      component.articlePublishedAt.set('2026-07-01T08:00:00.000Z');

      expect(component.isScheduled()).toBeFalse();
      expect(component.statusLabel()).toBe('Publié');
    });

    it('refuse une échéance passée, sans publier', () => {
      component.scheduleOpen.set(true);
      component.scheduleValue.set('2020-01-01T08:00');

      component.confirmSchedule();

      expect(component.error()).toContain('futur');
      expect(component.scheduleOpen()).toBeTrue();
      expect(blog.publish).not.toHaveBeenCalled();
    });

    it('échéance future sur un article en préparation : passe par l’enregistrement habituel', () => {
      const save = spyOn(component, 'save');
      component.scheduleOpen.set(true);
      component.scheduleValue.set('2030-01-01T08:00');

      component.confirmSchedule();

      expect(component.scheduleOpen()).toBeFalse();
      expect(save).toHaveBeenCalledWith(true);
    });

    it('reprogrammation d’un article déjà publié : seule la date part au back', () => {
      component.id.set('a1');
      component.status.set('PUBLISHED');
      blog.publish.and.returnValue(
        of({ publishedAt: '2030-01-01T07:00:00.000Z' } as Article),
      );
      component.scheduleOpen.set(true);
      component.scheduleValue.set('2030-01-01T08:00');

      component.confirmSchedule();

      expect(blog.publish).toHaveBeenCalledWith('a1', jasmine.any(String));
      expect(component.articlePublishedAt()).toBe('2030-01-01T07:00:00.000Z');
    });

    it('« publier maintenant » annule la programmation', () => {
      component.id.set('a1');
      component.status.set('PUBLISHED');
      component.articlePublishedAt.set(new Date(Date.now() + 3600_000).toISOString());
      const now = new Date().toISOString();
      blog.publish.and.returnValue(of({ publishedAt: now } as Article));

      component.publishNow();

      expect(blog.publish).toHaveBeenCalledWith('a1');
      expect(component.articlePublishedAt()).toBe(now);
      expect(component.isScheduled()).toBeFalse();
    });
  });

  /**
   * Après un import, les champs restés vides sont signalés en rouge. Publier dans cet état
   * demande une confirmation — enregistrer un brouillon, non : on écrit en plusieurs fois.
   */
  describe('avertissement « champs manquants » à la publication', () => {
    beforeEach(() => {
      component.form.controls.title.setValue('Un titre');
      component.form.controls.tags.setValue(['Moze']);
      // Ce que laisserait un import : extrait et couverture non remplis, dans l'ordre du
      // formulaire — c'est celui que produit `importArticleFromDocx`.
      component.importMissing.set(['excerpt', 'coverImageUrl']);
    });

    it('publier ouvre la modale au lieu d’enregistrer', () => {
      component.save(true);

      expect(component.missingWarningOpen()).toBeTrue();
      expect(component.missingLabels()).toEqual(['Extrait', 'Image de couverture']);
      expect(blog.create).not.toHaveBeenCalled();
    });

    it('enregistrer un brouillon n’ouvre rien', () => {
      blog.create.and.returnValue(of({ id: 'a1' } as Article));
      spyOn(TestBed.inject(Router), 'navigate').and.resolveTo(true);

      component.save(false);

      expect(component.missingWarningOpen()).toBeFalse();
      expect(blog.create).toHaveBeenCalled();
    });

    it('« Corriger » revient au formulaire, sans rien publier', () => {
      component.save(true);

      component.cancelMissingWarning();

      expect(component.missingWarningOpen()).toBeFalse();
      expect(blog.create).not.toHaveBeenCalled();
      // Les liserés restent : ils indiquent où aller.
      expect(component.isMissing('excerpt')).toBeTrue();
    });

    it('« Publier » poursuit la publication', () => {
      spyOn(TestBed.inject(Router), 'navigate').and.resolveTo(true);
      blog.create.and.returnValue(of({ id: 'a1' } as Article));
      blog.publish.and.returnValue(of({ id: 'a1', publishedAt: 'x' } as Article));
      component.save(true);

      component.confirmMissingWarning();

      expect(blog.create).toHaveBeenCalled();
      expect(blog.publish).toHaveBeenCalled();
      // L'avertissement a été assumé : il ne doit pas se redéclencher.
      expect(component.isMissing('excerpt')).toBeFalse();
    });

    it('un champ complété cesse d’être signalé — et n’ouvre plus la modale', () => {
      component.importMissing.set(['excerpt']);
      expect(component.isMissing('excerpt')).toBeTrue();

      component.form.controls.excerpt.setValue('Un résumé.');

      expect(component.isMissing('excerpt')).toBeFalse();
      expect(component.missingLabels()).toEqual([]);
    });
  });

  describe('save() — garde-fou du tag par défaut', () => {
    it('aucun tag → ouvre la modale au lieu de soumettre', () => {
      component.form.controls.title.setValue('Un titre');
      component.save(false);
      expect(component.defaultTagOpen()).toBe(true);
      expect(blog.create).not.toHaveBeenCalled();
    });

    it('confirmation → ajoute le tag par défaut puis soumet', () => {
      // Le TestBed n'a aucune route : on neutralise la redirection de fin.
      spyOn(TestBed.inject(Router), 'navigate').and.resolveTo(true);
      component.form.controls.title.setValue('Un titre');
      blog.create.and.returnValue(of({ id: 'a1' } as Article));
      component.save(false);
      component.confirmDefaultTag();
      expect(component.defaultTagOpen()).toBe(false);
      expect(component.form.controls.tags.value).toEqual(['Moze']);
      expect(blog.create).toHaveBeenCalledWith(
        jasmine.objectContaining({ tags: ['Moze'] }),
      );
    });
  });
});
