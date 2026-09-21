import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { Observable, concatMap, from, of, toArray } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { IntakeArticle, toCreatePayload } from '../../common/article-intake';
import { parsePastedArticles } from '../../common/article-paste';
import { toEventSlug } from '../../common/event-intake';
import { AdminSeries, SeriesInput } from '../../model/series.model';
import { BlogService } from '../../services/blog.service';
import { ReviewNotifierService } from '../../services/review-notifier.service';

/**
 * Une série repérée dans le texte collé, et ce qu'on propose d'en faire.
 *
 * Elle vient d'un bloc `type: série` — son brouillon, rédigé par l'IA — ou d'articles qui la
 * nomment (`serie:`, ou le « (2/6) » d'un titre). Dans tous les cas elle part au serveur en
 * **brouillon** : l'IA en écrit le teaser, mais pas l'image de tête. Un humain la pose en
 * relecture, et c'est ce geste qui valide la série.
 */
export interface SerieProposee {
  /** Clé de regroupement : le nom **détecté**, pas le nom saisi, pour survivre à une correction. */
  cle: string;
  titre: string;
  pitch: string;
  /** Ce que devrait montrer l'image de tête : le brief suivi en relecture. */
  imageIdea: string;
  plannedCount: number | null;
  /** La série porte déjà ce nom en base : on complète son brouillon au lieu de la créer. */
  existante: AdminSeries | null;
  /** Déclarée par son propre bloc, et non seulement nommée par des articles. */
  declaree: boolean;
  /** Ce que la lecture du bloc a relevé sans empêcher de créer. */
  warnings: string[];
  /** Les articles du lot qui la rejoignent, dans l'ordre où ils ont été collés. */
  episodes: { titre: string; position: number | null }[];
  /** Proposition acceptée. Décochée, la série n'est pas créée et ses articles partent seuls. */
  actif: boolean;
}

/** Ce que l'administrateur a changé sur une série proposée. */
type Retouche = Partial<
  Pick<SerieProposee, 'titre' | 'pitch' | 'imageIdea' | 'plannedCount' | 'actif'>
>;

/** Une série déjà validée : le collage d'un épisode ne réécrit pas son teaser. */
export function estEnLigne(serie: SerieProposee): boolean {
  return serie.existante?.status === 'PUBLISHED';
}

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

  constructor() {
    // Les séries existantes, lues une fois : elles servent à reconnaître celle que le lot
    // rejoint. Un échec n'empêche rien — sans elles, la série sera simplement proposée
    // comme nouvelle, et le serveur la retrouvera par son nom à la création.
    this.blog.adminSeries().subscribe({
      next: (series) => this.connues.set(series),
      error: () => this.connues.set([]),
    });
  }

  /** Relecture du texte collé, à chaque frappe : l'analyse est locale et sans coût. */
  readonly lu = computed(() =>
    this.texte().trim() ? parsePastedArticles(this.texte()) : null,
  );

  // --- Séries ----------------------------------------------------------------

  /** Les séries existantes, pour reconnaître celle que le lot rejoint plutôt que d'en créer une. */
  private readonly connues = signal<AdminSeries[]>([]);
  /** Ce que l'administrateur a changé, par série détectée. */
  private readonly retouches = signal<Record<string, Retouche>>({});

  readonly estEnLigne = estEnLigne;

  /**
   * Les séries que le lot fait naître, complète ou rejoint.
   *
   * Recalculé à chaque frappe, comme le reste de l'analyse : ce sont les retouches qui sont
   * gardées de côté, pas le résultat. Elles sont classées par nom **détecté**, si bien que
   * corriger le nom proposé ne fait pas repartir la saisie de zéro.
   *
   * Qui l'emporte, champ par champ : une série **en ligne** garde tout ce qu'elle a — elle a été
   * validée, un collage ne la réécrit pas. Sinon le bloc de série collé prime sur le brouillon
   * déjà en base, qui prime sur ce que les articles laissent deviner.
   */
  readonly series = computed<SerieProposee[]>(() => {
    const lu = this.lu();
    const retouches = this.retouches();
    const groupes = new Map<string, SerieProposee>();

    const groupe = (nom: string): SerieProposee => {
      const cle = toEventSlug(nom);
      const deja = groupes.get(cle);
      if (deja) return deja;
      const existante = this.connues().find((s) => s.slug === cle) ?? null;
      const nouveau: SerieProposee = {
        cle,
        titre: existante?.title ?? nom,
        pitch: existante?.pitch ?? '',
        imageIdea: existante?.imageIdea ?? '',
        plannedCount: existante?.plannedCount ?? null,
        existante,
        declaree: false,
        warnings: [],
        episodes: [],
        actif: true,
      };
      groupes.set(cle, nouveau);
      return nouveau;
    };

    for (const bloc of lu?.series ?? []) {
      const g = groupe(bloc.title);
      g.declaree = true;
      if (estEnLigne(g)) {
        g.warnings.push('déjà en ligne : son teaser ne change pas ici, le bloc est ignoré.');
        continue;
      }
      g.pitch = bloc.pitch || g.pitch;
      g.imageIdea = bloc.imageIdea || g.imageIdea;
      g.plannedCount = bloc.plannedCount ?? g.plannedCount;
      g.warnings.push(...bloc.warnings);
    }

    for (const a of lu?.articles ?? []) {
      if (!a.series) continue;
      const g = groupe(a.series);
      g.episodes.push({ titre: a.input.title, position: a.seriesPosition });
      // Le total annoncé par un article ne s'impose qu'à une série qui n'en annonce pas.
      if (!estEnLigne(g)) g.plannedCount ??= a.seriesPlannedCount;
    }

    return [...groupes.values()].map((g) => {
      const vue = { ...g, ...retouches[g.cle] };
      // Nommée par ses articles seulement : rien n'a été rédigé pour elle.
      if (!vue.declaree && !estEnLigne(vue) && !vue.pitch && !vue.imageIdea) {
        vue.warnings = [
          'déduite des articles : ni accroche ni idée d’image — à écrire ici ou en relecture.',
        ];
      }
      return vue;
    });
  });

  /** Ce que le bouton de création va réellement faire, en toutes lettres. */
  readonly libelleCreation = computed(() => {
    const n = this.lu()?.articles.length ?? 0;
    const m = this.series().filter((s) => s.actif && !estEnLigne(s)).length;
    const articles = n ? `${n} brouillon${n > 1 ? 's' : ''}` : '';
    const series = m ? `${m} série${m > 1 ? 's' : ''}` : '';
    const quoi = [articles, series].filter(Boolean).join(' et ');
    return quoi ? `Créer ${quoi}` : 'Créer le brouillon';
  });

  /** La série que rejoindrait cet article, telle qu'elle est proposée à l'écran. */
  private serieDe(article: IntakeArticle): SerieProposee | null {
    if (!article.series) return null;
    const cle = toEventSlug(article.series);
    return this.series().find((s) => s.cle === cle) ?? null;
  }

  retoucher(cle: string, champ: Retouche): void {
    this.retouches.update((all) => ({ ...all, [cle]: { ...all[cle], ...champ } }));
  }

  onTexte(cle: string, champ: 'titre' | 'pitch' | 'imageIdea', event: Event): void {
    this.retoucher(cle, { [champ]: (event.target as HTMLInputElement).value });
  }

  /** Le total saisi à la main. Vidé, la série n'annonce plus de nombre d'épisodes. */
  onTotal(cle: string, event: Event): void {
    const brut = (event.target as HTMLInputElement).value.trim();
    const n = Number(brut);
    this.retoucher(cle, {
      plannedCount: brut && n >= 1 && n <= 99 ? n : null,
    });
  }

  /**
   * Un lot peut ne contenir qu'une série : son brouillon se prépare avant d'en écrire le
   * premier épisode, comme `preparer_serie` le fait depuis Claude Desktop.
   */
  readonly peutCreer = computed(() => {
    const lu = this.lu();
    if (!lu || lu.errors.length) return false;
    return lu.articles.length > 0 || this.series().some((s) => s.actif && !estEnLigne(s));
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
    this.retouches.set({});
  }

  /**
   * Le brouillon de série tel qu'il doit exister avant que ses épisodes ne soient créés.
   *
   * Une série inconnue naît en brouillon avec tout son texte d'un coup : la laisser naître du
   * seul nom d'un article la ferait arriver en relecture sans accroche ni idée d'image. Un
   * brouillon déjà là ne reçoit **que ce qui change**. Une série en ligne n'est pas touchée :
   * elle a été validée, et un collage n'est pas une validation.
   */
  private enregistrerSerie(serie: SerieProposee): Observable<AdminSeries | null> {
    const titre = serie.titre.trim();
    const existante = this.connues().find((c) => c.slug === toEventSlug(titre)) ?? null;

    if (!existante) {
      return this.blog.createSeries({
        title: titre,
        ...(serie.pitch.trim() ? { pitch: serie.pitch.trim() } : {}),
        ...(serie.imageIdea.trim() ? { imageIdea: serie.imageIdea.trim() } : {}),
        ...(serie.plannedCount ? { plannedCount: serie.plannedCount } : {}),
      });
    }
    if (existante.status === 'PUBLISHED') return of(null);

    const diff: SeriesInput = {};
    if (serie.pitch.trim() !== existante.pitch) diff.pitch = serie.pitch.trim();
    if (serie.imageIdea.trim() !== existante.imageIdea) diff.imageIdea = serie.imageIdea.trim();
    if ((serie.plannedCount ?? null) !== existante.plannedCount) {
      diff.plannedCount = serie.plannedCount;
    }
    return Object.keys(diff).length ? this.blog.updateSeries(existante.id, diff) : of(null);
  }

  /** L'article tel qu'il part au serveur : la série qu'il rejoint est celle affichée à l'écran. */
  private aCreer(article: IntakeArticle): IntakeArticle {
    const serie = this.serieDe(article);
    if (!serie) return article;
    if (!serie.actif) {
      // Le titre reste nettoyé de son « (2/6) » : refuser la série ne le rend pas souhaitable.
      return { ...article, series: null, seriesPosition: null, seriesPlannedCount: null };
    }
    return {
      ...article,
      series: serie.titre.trim(),
      seriesPlannedCount: serie.plannedCount,
    };
  }

  /**
   * Crée les brouillons, un par un — leurs séries d'abord.
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

    from(this.series().filter((s) => s.actif))
      .pipe(
        concatMap((serie) =>
          this.enregistrerSerie(serie).pipe(
            catchError((err: unknown) => {
              echecs.push(`Série « ${serie.titre} » — ${this.messageOf(err) ?? 'échec'}`);
              return of(null);
            }),
          ),
        ),
        toArray(),
        concatMap(() => from(lu.articles)),
        concatMap((article) =>
          this.blog.create(toCreatePayload(this.aCreer(article))).pipe(
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
