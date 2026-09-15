import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { concatMap, from, of, toArray } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { toCreatePayload } from '../../common/article-intake';
import { parsePastedArticles } from '../../common/article-paste';
import { BlogService } from '../../services/blog.service';
import { ReviewNotifierService } from '../../services/review-notifier.service';

/**
 * Création d'articles par collage.
 *
 * **Pourquoi cet écran existe.** Le serveur MCP donne à un système extérieur des identifiants
 * d'administration, stockés en clair sur le disque — et la liste d'outils qu'il expose n'est
 * pas une frontière de sécurité : elle contraint le modèle, pas quelqu'un qui lirait le
 * fichier. Ici, le sens du flux est inversé : c'est un humain **déjà authentifié** qui pousse
 * le texte depuis son navigateur. Aucun identifiant n'existe hors de sa session, et la surface
 * d'attaque ajoutée par l'IA est nulle — elle redevient un éditeur de texte qui écrit bien.
 *
 * Le back n'a rien eu à changer : `POST /admin/blog` acceptait déjà tout, `origin` compris.
 * La propriété de sécurité vient de la réutilisation d'une session existante, pas d'un
 * mécanisme de plus.
 */
@Component({
  selector: 'app-admin-blog-paste',
  imports: [RouterLink],
  templateUrl: './admin-blog-paste.component.html',
  styleUrl: './admin-blog-paste.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminBlogPasteComponent {
  private readonly blog = inject(BlogService);
  private readonly notifier = inject(ReviewNotifierService);
  private readonly router = inject(Router);

  readonly texte = signal('');
  readonly creating = signal(false);
  readonly error = signal<string | null>(null);
  readonly aide = signal(false);

  /** Retour du bouton de copie. `ko` quand le presse-papiers refuse. */
  readonly copie = signal<'repos' | 'ok' | 'ko'>('repos');
  private retour?: ReturnType<typeof setTimeout>;

  /** Relecture du texte collé, à chaque frappe : l'analyse est locale et sans coût. */
  readonly lu = computed(() =>
    this.texte().trim() ? parsePastedArticles(this.texte()) : null,
  );

  readonly peutCreer = computed(() => {
    const lu = this.lu();
    return !!lu && lu.errors.length === 0 && lu.articles.length > 0;
  });

  /**
   * Dates relues en toutes lettres — le même filet que partout ailleurs.
   *
   * Une date ISO ne se vérifie pas d'un coup d'œil ; en français, une semaine de décalage
   * saute aux yeux avant que l'article ne soit créé.
   */
  private readonly longue = new Intl.DateTimeFormat('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  enClair(iso: string): string {
    return this.longue.format(new Date(iso));
  }

  onInput(event: Event): void {
    this.texte.set((event.target as HTMLTextAreaElement).value);
    this.error.set(null);
  }

  /**
   * Copie le prompt affiché.
   *
   * Le texte est lu dans le DOM plutôt que tenu en constante : le gabarit reste lisible dans
   * le template, et il n'existe qu'à un seul endroit — deux exemplaires finiraient par
   * diverger, et c'est celui affiché qui ferait foi pour l'œil sans être celui copié.
   *
   * L'échec est dit plutôt que tu : `writeText` refuse hors contexte sécurisé, et un bouton
   * qui ne réagit pas laisse croire que la copie a eu lieu.
   */
  async copier(texte: string): Promise<void> {
    clearTimeout(this.retour);
    try {
      await navigator.clipboard.writeText(texte);
      this.copie.set('ok');
    } catch {
      this.copie.set('ko');
    }
    this.retour = setTimeout(() => this.copie.set('repos'), 2000);
  }

  vider(): void {
    this.texte.set('');
    this.error.set(null);
  }

  /**
   * Crée les brouillons, un par un.
   *
   * Séquentiel et non parallèle : les slugs se dédoublonnent côté serveur, et deux créations
   * simultanées sur un même titre pourraient se marcher dessus. Un échec n'interrompt pas les
   * suivants — il est nommé, sans quoi un lot à moitié passé laisserait sans savoir lequel
   * reprendre.
   */
  creer(): void {
    const lu = this.lu();
    if (!lu || !this.peutCreer()) return;

    this.creating.set(true);
    this.error.set(null);
    const echecs: string[] = [];

    from(lu.articles)
      .pipe(
        concatMap((article) =>
          this.blog.create(toCreatePayload(article)).pipe(
            concatMap((cree) =>
              // Date et « une » sont des *propositions* : elles ne publient ni n'épinglent.
              article.proposedPublishAt || article.proposedFeatured
                ? this.blog.proposal(cree.id, {
                    publishAt: article.proposedPublishAt,
                    featured: article.proposedFeatured,
                  })
                : of(cree),
            ),
            catchError((err: unknown) => {
              echecs.push(`« ${article.input.title} » — ${this.messageOf(err) ?? 'échec'}`);
              return of(null);
            }),
          ),
        ),
        toArray(),
      )
      .subscribe((resultats) => {
        this.creating.set(false);
        const reussis = resultats.filter(Boolean).length;

        if (echecs.length) {
          this.error.set(
            `${reussis} créé(s), ${echecs.length} en échec :\n${echecs.join('\n')}`,
          );
          return;
        }

        // Tout est passé : la file de relecture est le prochain geste, on y emmène.
        this.texte.set('');
        this.notifier.refresh();
        void this.router.navigate(['/admin/blog/relecture']);
      });
  }

  private messageOf(err: unknown): string | null {
    const msg = (err as { error?: { message?: string | string[] } } | null)?.error
      ?.message;
    if (Array.isArray(msg)) return msg.join(' · ');
    return typeof msg === 'string' ? msg : null;
  }
}
