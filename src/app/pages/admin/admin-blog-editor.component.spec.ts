import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';

import { AdminBlogEditorComponent } from './admin-blog-editor.component';
import { Article } from '../../model/article.model';
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
