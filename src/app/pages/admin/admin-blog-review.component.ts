import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { concatMap, from, of, toArray } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { ConfirmDialogComponent } from '../../components/confirm-dialog/confirm-dialog.component';
import {
  fromDatetimeLocal,
  toDatetimeLocal,
} from '../../common/datetime-local';
import {
  AdminFeaturedItem,
  Article,
  ArticleAnnex,
  Signalement,
  MAX_FEATURED,
} from '../../model/article.model';
import { notesDuGroupe } from '../../common/editorial-notes';
import { POST_SLOTS, networkFor } from '../../common/social-networks';
import { ArticleFlagsComponent } from '../../components/article-flags/article-flags.component';
import { EditorialNotesComponent } from '../../components/editorial-notes/editorial-notes.component';
import {
  articlesSansPlace,
  projectFeatured,
  projectionAhead,
} from '../../common/featured-projection';
import { FeaturedSlotsComponent } from '../../components/featured-slots/featured-slots.component';
import { AdminSeries, SeriesRef } from '../../model/series.model';
import { SeriesCoverComponent } from '../../components/series-cover/series-cover.component';
import { BlogService } from '../../services/blog.service';
import { ReviewNotifierService } from '../../services/review-notifier.service';

/**
 * Un bloc de la file de relecture : une série et ses épisodes, ou un article seul.
 *
 * Un article hors série forme un bloc d'un seul élément plutôt qu'un cas à part : la file
 * n'a alors qu'une forme à rendre, et l'entête de série est ce qui s'ajoute, pas ce qui
 * change tout.
 */
interface BlocDeFile {
  cle: string;
  serie: SeriesRef | null;
  /** La série est en brouillon : son en-tête s'ouvre dans le volet, pour y poser l'image. */
  brouillon: AdminSeries | null;
  articles: Article[];
}

/**
 * Pupitre de relecture des brouillons rédigés par l'assistant.
 *
 * **Pourquoi deux volets et non des modales.** Chaque article demande quatre gestes — image,
 * date, une, relecture. Une modale par geste et par article rendrait l'écran inutilisable.
 * Or aucun de ces gestes n'est irréversible : ce sont des *propriétés d'un brouillon*,
 * modifiables jusqu'au bout. La modale n'a de sens que là où une décision est définitive, et
 * ici il n'y en a qu'une : la mise en ligne. D'où la règle de l'écran —
 * **une seule confirmation, tout à la fin ; tout le reste est de l'état affiché en clair.**
 *
 * L'échange à la une en est l'illustration : `featureReplacesId` ne s'applique qu'à la
 * parution (cf. `applyDueFeatureSwaps` côté back). Choisir qui cède sa place n'engage donc à
 * rien tant que rien n'est publié — la liste des candidats s'affiche en ligne, et se change
 * autant de fois qu'on veut.
 */
@Component({
  selector: 'app-admin-blog-review',
  imports: [
    RouterLink,
    ConfirmDialogComponent,
    FeaturedSlotsComponent,
    EditorialNotesComponent,
    ArticleFlagsComponent,
    SeriesCoverComponent,
  ],
  templateUrl: './admin-blog-review.component.html',
  styleUrl: './admin-blog-review.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminBlogReviewComponent {
  private readonly blog = inject(BlogService);
  private readonly notifier = inject(ReviewNotifierService);

  /** Les retouches de l'article sélectionné — relues sur « Actualiser ». */
  private readonly retouches = viewChild(ArticleFlagsComponent);

  readonly maxFeatured = MAX_FEATURED;

  /**
   * Dates en toutes lettres, via `Intl` et non le pipe `date`.
   *
   * L'application n'enregistre aucune donnée de locale : `| date: … : 'fr'` lève
   * `NG0701` et interrompt le rendu de la vue. `Intl` s'appuie sur l'ICU du navigateur,
   * toujours disponible, et donne le même libellé que les messages du back.
   *
   * Le jour de la semaine n'est pas décoratif : c'est lui qui fait voir qu'un « lundi » a été
   * résolu sur la mauvaise semaine.
   */
  private readonly longue = new Intl.DateTimeFormat('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
  private readonly breve = new Intl.DateTimeFormat('fr-FR', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });

  enClair(iso: string): string {
    return this.longue.format(new Date(iso));
  }

  enBref(iso: string): string {
    return this.breve.format(new Date(iso));
  }

  readonly queue = signal<Article[]>([]);

  /**
   * La file, séries regroupées.
   *
   * Une série se relit d'un bloc : l'ordre des épisodes, l'échelonnement des dates et ce que
   * chacun promet au suivant ne se vérifient pas article par article. Le bloc prend la place
   * de son **premier** épisode dans la file, pour que la série n'avance ni ne recule par
   * rapport aux articles isolés déjà relus.
   *
   * À l'intérieur, l'ordre est celui de la lecture, pas celui de la file : c'est dans cet
   * ordre-là qu'on repère un épisode 3 programmé avant le 2.
   */
  readonly blocs = computed<BlocDeFile[]>(() => {
    const blocs: BlocDeFile[] = [];
    const parSerie = new Map<string, BlocDeFile>();
    const brouillon = (slug: string) =>
      this.seriesDrafts().find((s) => s.slug === slug) ?? null;

    for (const article of this.queue()) {
      const serie = article.series;
      if (!serie) {
        blocs.push({ cle: article.id, serie: null, brouillon: null, articles: [article] });
        continue;
      }
      const ouvert = parSerie.get(serie.slug);
      if (ouvert) {
        ouvert.articles.push(article);
        continue;
      }
      const bloc: BlocDeFile = {
        cle: `serie-${serie.slug}`,
        serie,
        brouillon: brouillon(serie.slug),
        articles: [article],
      };
      parSerie.set(serie.slug, bloc);
      blocs.push(bloc);
    }

    for (const bloc of parSerie.values()) {
      bloc.articles.sort(
        (a, b) => (a.seriesPosition ?? 99) - (b.seriesPosition ?? 99),
      );
    }

    // Les brouillons de série sans épisode dans la file — préparés avant leurs articles, ou
    // dont les épisodes sont déjà partis — passent en tête : ils n'attendent plus qu'une image.
    const seuls: BlocDeFile[] = this.seriesDrafts()
      .filter((s) => !parSerie.has(s.slug))
      .map((s) => ({
        cle: `serie-${s.slug}`,
        serie: { id: s.id, slug: s.slug, title: s.title, plannedCount: s.plannedCount },
        brouillon: s,
        articles: [],
      }));
    return [...seuls, ...blocs];
  });

  // --- Brouillons de série ----------------------------------------------------
  //
  // L'assistant rédige le teaser d'une série — nom, accroche, total, idée d'image — mais ne
  // produit pas l'image de tête. C'est ici qu'un humain la pose, et c'est ce geste qui valide
  // la série : jusque-là, elle n'existe pas pour le public.

  /** Les séries en brouillon, épisodes compris. */
  readonly seriesDrafts = signal<AdminSeries[]>([]);
  readonly selectedSeriesId = signal<string | null>(null);
  readonly selectedSeries = computed(
    () => this.seriesDrafts().find((s) => s.id === this.selectedSeriesId()) ?? null,
  );
  readonly serieBusy = signal(false);

  /** Le formulaire du brouillon ouvert, recopié à la sélection. */
  readonly serieForm = signal({ title: '', pitch: '', imageIdea: '', plannedCount: '' });

  readonly serieDirty = computed(() => {
    const s = this.selectedSeries();
    const f = this.serieForm();
    return (
      !!s &&
      (f.title.trim() !== s.title ||
        f.pitch.trim() !== s.pitch ||
        f.imageIdea.trim() !== s.imageIdea ||
        this.total(f.plannedCount) !== s.plannedCount)
    );
  });

  /**
   * La pile telle qu'elle se verra sur le blog : l'image de tête devant, les couvertures des
   * épisodes de la file derrière. Montrée avant de valider, pour qu'on juge l'image à sa place.
   */
  readonly serieCovers = computed(() => {
    const s = this.selectedSeries();
    if (!s) return [];
    return this.queue()
      .filter((a) => a.series?.slug === s.slug)
      .sort((a, b) => (b.seriesPosition ?? 0) - (a.seriesPosition ?? 0))
      .map((a) => a.coverImageUrl);
  });

  /** Les épisodes de la file dont la série attend encore sa validation. */
  readonly episodesSansSerie = computed(() =>
    this.queue().filter(
      (a) => !!a.series && this.seriesDrafts().some((s) => s.slug === a.series!.slug),
    ),
  );

  /** Le message de la confirmation, avec ce qu'une série en brouillon change à la parution. */
  readonly confirmMessage = computed(() => {
    const base =
      `Les ${this.queue().length} articles seront publiés à leur date proposée. ` +
      "C'est la seule action irréversible de cet écran.";
    const n = this.episodesSansSerie().length;
    if (!n) return base;
    return (
      `${base}\n\n${n} épisode${n > 1 ? 's' : ''} appartien${n > 1 ? 'nent' : 't'} à une série ` +
      'encore en brouillon : ils paraîtront comme des articles seuls tant que sa série ' +
      "n'est pas validée, puis s'y rattacheront d'eux-mêmes."
    );
  });

  selectSeries(id: string): void {
    const s = this.seriesDrafts().find((x) => x.id === id);
    if (!s) return;
    this.selectedId.set(null);
    this.selectedSeriesId.set(id);
    this.remplirSerieForm(s);
  }

  private remplirSerieForm(s: AdminSeries): void {
    this.serieForm.set({
      title: s.title,
      pitch: s.pitch,
      imageIdea: s.imageIdea,
      plannedCount: s.plannedCount === null ? '' : String(s.plannedCount),
    });
  }

  onSerieChamp(champ: 'title' | 'pitch' | 'imageIdea' | 'plannedCount', event: Event): void {
    const valeur = (event.target as HTMLInputElement).value;
    this.serieForm.update((f) => ({ ...f, [champ]: valeur }));
  }

  /** Un total saisi, ou `null` : vide ou hors bornes, la série n'annonce pas de nombre. */
  private total(brut: string): number | null {
    const n = Number(brut.trim());
    return brut.trim() && Number.isInteger(n) && n >= 1 && n <= 99 ? n : null;
  }

  /** Remplace un brouillon de série par sa version fraîche. */
  private patchSerie(maj: AdminSeries): void {
    this.seriesDrafts.update((all) => all.map((s) => (s.id === maj.id ? maj : s)));
    if (maj.id === this.selectedSeriesId()) this.remplirSerieForm(maj);
    this.serieBusy.set(false);
  }

  private failSerie(err: unknown, repli = 'Enregistrement impossible.'): void {
    this.serieBusy.set(false);
    this.error.set(this.messageOf(err) ?? repli);
  }

  /** L'image de tête : envoyée, puis enregistrée aussitôt sur le brouillon, comme une couverture. */
  onSerieCover(event: Event, s: AdminSeries): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;

    this.serieBusy.set(true);
    this.error.set(null);
    this.blog.upload(file).subscribe({
      next: ({ url }) =>
        this.blog.updateSeries(s.id, { coverImageUrl: url }).subscribe({
          next: (maj) => this.patchSerie(maj),
          error: (err) => this.failSerie(err),
        }),
      error: (err) => this.failSerie(err, "L'envoi de l'image a échoué."),
    });
  }

  private ecrireSerie(s: AdminSeries) {
    const f = this.serieForm();
    return this.blog.updateSeries(s.id, {
      title: f.title.trim(),
      pitch: f.pitch.trim(),
      imageIdea: f.imageIdea.trim(),
      plannedCount: this.total(f.plannedCount),
    });
  }

  enregistrerSerie(s: AdminSeries): void {
    if (!this.serieDirty() || !this.serieForm().title.trim()) return;
    this.serieBusy.set(true);
    this.error.set(null);
    this.ecrireSerie(s).subscribe({
      next: (maj) => this.patchSerie(maj),
      error: (err) => this.failSerie(err),
    });
  }

  /**
   * Valide la série : ce qui a été retouché est enregistré d'abord, puis la série sort du
   * brouillon. Elle quitte alors la relecture — elle n'attend plus personne.
   */
  validerSerie(s: AdminSeries): void {
    if (!s.coverImageUrl || !this.serieForm().title.trim()) return;
    this.serieBusy.set(true);
    this.error.set(null);

    const avant = this.serieDirty() ? this.ecrireSerie(s) : of(s);
    avant.pipe(concatMap(() => this.blog.publishSeries(s.id))).subscribe({
      next: () => {
        this.serieBusy.set(false);
        this.seriesDrafts.update((all) => all.filter((x) => x.id !== s.id));
        this.selectedSeriesId.set(null);
        const premier = this.queue()[0];
        if (premier) this.select(premier.id);
        this.notifier.refresh();
      },
      error: (err) => this.failSerie(err, 'La validation de la série a échoué.'),
    });
  }

  readonly featuredList = signal<AdminFeaturedItem[]>([]);
  readonly selectedId = signal<string | null>(null);

  /** Annexes de l'article sélectionné, corps compris — pour ses notes de rédaction. */
  readonly notes = signal<ArticleAnnex[]>([]);

  /** Notes SEO présentes ? Leur bloc n'a pas d'autre raison d'exister. */
  readonly aNotesSeo = computed(
    () => notesDuGroupe(this.notes(), 'seo').length > 0,
  );

  /** Liens internes et blocs non reconnus présents ? */
  readonly aNotesAutres = computed(
    () => notesDuGroupe(this.notes(), 'autres').length > 0,
  );
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  /** Identifiant de l'article dont une écriture est en cours, pour désarmer ses contrôles. */
  readonly busyId = signal<string | null>(null);
  readonly publishing = signal(false);
  readonly confirming = signal(false);
  /**
   * Bilan de la dernière mise en ligne.
   *
   * Trois catégories et non deux : `partiels` recueille les articles **publiés** dont
   * l'épinglage a échoué. Les compter en échec laisserait croire qu'ils restent à reprendre,
   * alors qu'ils sont en ligne — seule la une leur manque.
   */
  readonly report = signal<{
    ok: number;
    partiels: string[];
    errors: string[];
  } | null>(null);

  /**
   * Article qui cède sa place à la une, par article de la file.
   *
   * Volontairement en mémoire et non en base : ce choix n'a de sens qu'au moment de valider,
   * et il n'engage rien. Le persister obligerait à gérer son invalidation quand la une bouge.
   */
  private readonly replacements = signal<Record<string, string>>({});

  // --- Signalements de relecture --------------------------------------------
  //
  // La saisie, la liste et la reprise des retouches vivent dans `app-article-flags`, le même
  // composant que l'éditeur. Cet écran n'en garde que ce qui lui est propre : des boutons posés
  // au plus près de ce qu'ils visent (à côté du titre, sous chaque post), et le compte des
  // retouches par post.

  /** Retouches encore ouvertes de l'article sélectionné, telles que le composant les relit. */
  readonly flags = signal<Signalement[]>([]);

  readonly openFlags = computed(() => this.flags().filter((f) => !f.resolvedAt));

  /**
   * Les posts réseaux de l'article sélectionné, dans l'ordre de diffusion.
   *
   * Leur texte **rédigé**, tel qu'en base — et non celui que la Diffusion copie, augmenté de
   * l'adresse de l'article (`composerPost`). C'est dans ce texte-ci que le serveur cherchera
   * la citation d'un signalement : un passage pris dans la version avec lien ne s'y
   * retrouverait pas.
   */
  readonly posts = computed(() => {
    const annexes = this.notes();
    const ouvertes = this.openFlags();
    return POST_SLOTS.flatMap((slot) => {
      const annex = annexes.find((a) => a.slot === slot);
      const network = networkFor(slot);
      if (!annex || !network) return [];
      return [
        {
          annex,
          network,
          trop: network.limit !== null && annex.body.length > network.limit,
          retouches: ouvertes.filter((f) => f.field === 'annex' && f.annexSlot === slot)
            .length,
        },
      ];
    });
  });

  readonly selected = computed(
    () => this.queue().find((a) => a.id === this.selectedId()) ?? null,
  );


  readonly featuredFull = computed(
    () => this.featuredList().length >= MAX_FEATURED,
  );

  /**
   * Les articles du lot qui ne trouveront **pas** de place à la une.
   *
   * Le compte ne peut pas se limiter à la une d'aujourd'hui, et c'est tout l'intérêt de ce
   * calcul : le lot se publie d'un bloc, si bien que chaque article épinglé avant celui-ci a
   * déjà pris sa place. Une une à quatre occupants et quatre articles proposés donnent, à ne
   * regarder que l'état courant, quatre fois « il reste de la place » — puis un seul passe et
   * les trois autres sont refusés par le serveur, une fois publiés.
   *
   * Un article qui désigne un sortant ne consomme rien : il occupe la place qu'il libère.
   * L'ordre est celui de la file, c'est-à-dire celui dans lequel `publishAll` les traite.
   */
  private readonly sansPlace = computed(() =>
    articlesSansPlace(
      this.featuredList().length,
      this.queue(),
      this.replacements(),
      MAX_FEATURED,
    ),
  );

  /** Combien d'épinglages du lot resteront sans place. */
  readonly uneEnTrop = computed(() => this.sansPlace().size);

  /**
   * Cet article doit-il désigner un sortant ?
   *
   * Vrai dès que la une est pleine — le cas déjà couvert — mais aussi lorsqu'elle se remplira
   * pendant la mise en ligne du lot. C'est ce second cas qui manquait : l'interface de choix
   * restait cachée précisément quand elle devenait nécessaire.
   */
  besoinDeRemplacant(id: string): boolean {
    return this.sansPlace().has(id);
  }

  /**
   * La une **telle qu'elle sera** à la date proposée pour l'article sélectionné.
   *
   * C'est le point qui rend l'écran utilisable d'une semaine sur l'autre. Programmer un
   * article pour dans quinze jours et se voir proposer la une d'aujourd'hui n'a pas de sens :
   * les articles affichés en ce moment auront déjà cédé leur place. On projette donc chaque
   * emplacement à la date visée, en déroulant deux choses :
   *
   *  1. les échanges **déjà programmés** en base (`succession`, fournie par le serveur) ;
   *  2. les propositions **du lot en cours**, qui n'existent pas encore en base mais qui
   *     paraîtront avant — sans elles, deux articles du même lot pourraient viser la même
   *     place sans que rien ne le signale.
   *
   * Sans date proposée, on montre la une d'aujourd'hui : c'est le seul état dont on soit sûr.
   */
  readonly projected = computed(() => {
    const article = this.selected();
    const at = article?.proposedPublishAt
      ? new Date(article.proposedPublishAt).getTime()
      : null;

    // Les échanges déjà en base : calcul partagé avec la liste et l'éditeur.
    const slots = projectFeatured(this.featuredList(), at);
    if (at === null) return slots;

    // Les échanges du lot en cours, appliqués dans l'ordre de leur parution.
    const duLot = this.queue()
      .filter(
        (o) =>
          o.id !== article?.id &&
          o.proposedFeatured &&
          !!this.replacementFor(o.id) &&
          !!o.proposedPublishAt &&
          new Date(o.proposedPublishAt).getTime() <= at,
      )
      .sort(
        (x, y) =>
          new Date(x.proposedPublishAt!).getTime() -
          new Date(y.proposedPublishAt!).getTime(),
      );

    for (const o of duLot) {
      const slot = slots.find((s) => s.id === this.replacementFor(o.id));
      if (slot) {
        slot.id = o.id;
        slot.title = o.title;
        slot.future = true;
        slot.since = o.proposedPublishAt ?? null;
      }
    }
    return slots;
  });


  /** Date d'arrivée en version brève — « 8 sept. » — pour les étiquettes de la une. */
  private readonly jour = new Intl.DateTimeFormat('fr-FR', {
    day: 'numeric',
    month: 'short',
  });

  enJour(iso: string): string {
    return this.jour.format(new Date(iso));
  }

  /** Vrai si la projection diffère de l'état actuel — donc s'il y a lieu de le dire. */
  readonly projectionAhead = computed(() => projectionAhead(this.projected()));

  /**
   * Le titre de l'article du lot qui a déjà retenu ce candidat, s'il y en a un.
   *
   * Deux articles ne peuvent pas prendre la même place : sans ce repère, on choisirait deux
   * fois le même sans rien voir, et le second échange écraserait le premier à la parution.
   */
  claimedBy(candidateId: string): string | null {
    return this.claimedTitles()[candidateId] ?? null;
  }

  /**
   * Les places déjà retenues par le lot, et par quel article — sauf celles retenues par
   * l'article en cours de programmation, qui les voit comme « sortantes » et non « prises ».
   *
   * Une table plutôt qu'une recherche par candidat : la liste des emplacements l'interroge
   * cinq fois par rendu, et une table calculée une fois évite d'y parcourir les choix du lot
   * autant de fois.
   */
  readonly claimedTitles = computed<Record<string, string>>(() => {
    const moi = this.selectedId();
    const table: Record<string, string> = {};
    for (const [articleId, cible] of Object.entries(this.replacements())) {
      if (articleId === moi) continue;
      const titre = this.queue().find((a) => a.id === articleId)?.title;
      if (titre) table[cible] = titre;
    }
    return table;
  });

  // --- Ce qui empêche de mettre en ligne ------------------------------------

  /**
   * Pas de couverture, pas d'`og:image` : l'article partagé sur LinkedIn ou Facebook sortirait
   * sans visuel. La couverture n'est pas cosmétique, elle bloque.
   */
  readonly missingCover = computed(() =>
    this.queue().filter((a) => !a.coverImageUrl),
  );

  readonly missingDate = computed(() =>
    this.queue().filter((a) => !a.proposedPublishAt),
  );

  /**
   * Une file préparée mardi et relue jeudi contient des dates devenues du passé. C'est le
   * scénario le plus probable de tous, et le back les refuserait une par une — autant le dire
   * avant de lancer la mise en ligne.
   */
  readonly stalledDate = computed(() =>
    this.queue().filter(
      (a) => a.proposedPublishAt && new Date(a.proposedPublishAt) <= new Date(),
    ),
  );

  /**
   * Les articles qui demandent la une sans qu'aucune place ne leur revienne.
   *
   * Échec **garanti**, exactement au même titre qu'une date manquante : la une est pleine,
   * aucun sortant n'est désigné, et le serveur refusera l'épinglage — après avoir publié,
   * puisque l'épinglage vient en second. C'est arrivé sur un lot de quatre : quatre articles
   * en ligne, zéro à la une, et un rapport d'erreurs pour seule explication.
   *
   * L'avertissement dans la confirmation ne suffisait pas — une confirmation se clique. Il
   * fallait désarmer le bouton, comme pour les autres échecs certains.
   */
  readonly sansPlaceArticles = computed(() =>
    this.queue().filter((a) => this.sansPlace().has(a.id)),
  );

  readonly blockers = computed(() => {
    const out: string[] = [];
    const n = (list: unknown[], un: string, plusieurs: string) =>
      `${list.length} article${list.length > 1 ? 's' : ''} ${list.length > 1 ? plusieurs : un}`;

    if (this.missingCover().length)
      out.push(n(this.missingCover(), 'sans image', 'sans image'));
    if (this.missingDate().length)
      out.push(n(this.missingDate(), 'sans date', 'sans date'));
    if (this.stalledDate().length)
      out.push(n(this.stalledDate(), 'à une date passée', 'à des dates passées'));
    if (this.sansPlaceArticles().length)
      out.push(
        n(
          this.sansPlaceArticles(),
          'à la une sans place libre',
          'à la une sans place libre',
        ),
      );
    return out;
  });

  /**
   * Ouvre le premier article qui bloque, pour que la correction soit à un clic.
   *
   * Un blocage nommé mais introuvable oblige à ouvrir les articles un par un jusqu'à tomber
   * sur le bon — et une file de dix rend l'exercice pénible.
   */
  allerAuBlocage(): void {
    const premier =
      this.sansPlaceArticles()[0] ??
      this.missingDate()[0] ??
      this.stalledDate()[0] ??
      this.missingCover()[0];
    if (premier) this.select(premier.id);
  }

  readonly canPublish = computed(
    () => this.queue().length > 0 && this.blockers().length === 0,
  );

  constructor() {
    // Être ici, c'est avoir vu : le bandeau d'arrivée n'a plus lieu d'être.
    this.notifier.acknowledge();
    this.load();

  }

  // --- Chargement -----------------------------------------------------------

  load(): void {
    this.loading.set(true);
    this.error.set(null);

    // Les brouillons de série, avec la file : l'en-tête de chaque série dit s'il attend sa
    // validation. Leur échec n'empêche pas de relire les articles.
    this.blog.adminSeries().subscribe({
      next: (series) => {
        const brouillons = series.filter((s) => s.status === 'DRAFT');
        this.seriesDrafts.set(brouillons);
        const ouverte = brouillons.find((s) => s.id === this.selectedSeriesId());
        if (ouverte) this.remplirSerieForm(ouverte);
        else this.selectedSeriesId.set(null);
        // Rien d'autre à relire : on ouvre le premier brouillon de série.
        if (!this.selectedId() && !ouverte && brouillons.length && !this.queue().length) {
          this.selectSeries(brouillons[0].id);
        }
      },
      error: () => this.seriesDrafts.set([]),
    });

    this.blog.adminList({ origin: 'ASSISTANT', status: 'DRAFT' }).subscribe({
      next: (articles) => {
        this.queue.set(articles);
        // Sélection par défaut : le premier, pour que l'écran ne s'ouvre pas vide.
        if (!this.selected() && !this.selectedSeriesId() && articles.length) {
          this.selectedId.set(articles[0].id);
        }
        const courant = this.selectedId();
        if (courant) {
          // Même article qu'avant « Actualiser » : le composant ne recharge pas de lui-même
          // (son identifiant n'a pas changé), on le lui demande. Premier chargement : il n'est
          // pas encore rendu, et chargera à sa création.
          this.retouches()?.recharger();
          this.loadNotes(courant);
        }
        this.loading.set(false);
      },
      error: (err) => {
        this.loading.set(false);
        this.error.set(this.messageOf(err) ?? 'Chargement impossible.');
      },
    });

    // La une sert à savoir s'il faut demander qui cède sa place : son échec n'empêche pas
    // de relire, il empêche seulement de proposer l'échange.
    this.blog.adminFeatured().subscribe({
      next: (list) => this.featuredList.set(list),
      error: () => this.featuredList.set([]),
    });
  }

  select(id: string): void {
    this.selectedSeriesId.set(null);
    this.selectedId.set(id);
    // Vidées tout de suite : le compte de retouches par post ne doit pas afficher celles de
    // l'article précédent, le temps que le composant relise celles du nouveau.
    this.flags.set([]);
    this.loadNotes(id);
  }

  /**
   * Les notes de rédaction de l'article sélectionné.
   *
   * Chargées à la sélection et non avec la file : la liste ne transporte pas le corps des
   * annexes (cf. `LIST_INCLUDE` côté back), et une file de dix brouillons en tirerait des
   * dizaines de milliers de caractères pour n'en lire qu'un.
   *
   * La réponse est ignorée si l'on a changé d'article entre-temps : sinon, cliquer vite d'un
   * brouillon à l'autre afficherait l'idée d'image du précédent sous la couverture du suivant.
   */
  private loadNotes(articleId: string): void {
    this.notes.set([]);
    this.blog.adminGet(articleId).subscribe({
      next: (a) => {
        if (this.selectedId() === articleId) this.notes.set(a.annexes ?? []);
      },
      // Sans notes, la relecture reste possible : elles éclairent, elles ne conditionnent rien.
      error: () => this.notes.set([]),
    });
  }

  // --- Marquage --------------------------------------------------------------

  /** Le composant a relu les retouches : c'est d'elles que dépend le compte par post. */
  onRetouches(ouvertes: Signalement[]): void {
    this.flags.set(ouvertes);
  }

  // --- Couverture -----------------------------------------------------------

  /** Un clic, un fichier, une vignette. L'upload existant fait le reste. */
  onCoverPicked(event: Event, article: Article): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;

    this.busyId.set(article.id);
    this.blog.upload(file).subscribe({
      next: ({ url }) =>
        this.blog
          .update(article.id, { title: article.title, coverImageUrl: url })
          .subscribe({
            next: (maj) => this.patch(maj),
            error: (err) => this.fail(err),
          }),
      error: (err) => this.fail(err, "L'envoi de l'image a échoué."),
    });
  }

  // --- Date proposée --------------------------------------------------------

  /** Valeur du `<input type="datetime-local">` pour un article de la file. */
  dateValue(article: Article): string {
    return article.proposedPublishAt
      ? toDatetimeLocal(new Date(article.proposedPublishAt))
      : '';
  }

  onDateChanged(event: Event, article: Article): void {
    const parsed = fromDatetimeLocal((event.target as HTMLInputElement).value);
    if (!parsed) {
      this.setProposal(article, { publishAt: null });
      return;
    }
    if (parsed.getTime() <= Date.now()) {
      this.error.set('La date de parution doit être dans le futur.');
      return;
    }
    this.setProposal(article, { publishAt: parsed.toISOString() });
  }

  // --- À la une -------------------------------------------------------------

  toggleFeatured(article: Article): void {
    this.setProposal(article, { featured: !article.proposedFeatured });
  }

  /** L'article qui cédera sa place, s'il a été choisi. */
  replacementFor(id: string): string | undefined {
    return this.replacements()[id];
  }

  chooseReplacement(articleId: string, replacedId: string): void {
    this.replacements.update((map) => ({
      ...map,
      // Re-cliquer sur le même choix l'annule : pas besoin d'un bouton « aucun ».
      ...(map[articleId] === replacedId
        ? { [articleId]: '' }
        : { [articleId]: replacedId }),
    }));
  }

  private setProposal(
    article: Article,
    input: { publishAt?: string | null; featured?: boolean | null },
  ): void {
    this.busyId.set(article.id);
    this.error.set(null);
    this.blog.proposal(article.id, input).subscribe({
      next: (maj) => this.patch(maj),
      error: (err) => this.fail(err),
    });
  }

  // --- Mise en ligne --------------------------------------------------------

  askPublish(): void {
    if (!this.canPublish()) return;
    this.confirming.set(true);
  }

  /**
   * Le seul moment irréversible de l'écran.
   *
   * Séquentiel et non parallèle : chaque article est publié à sa date proposée, puis épinglé
   * si c'était demandé — `feature` exige un article publié, l'ordre n'est donc pas négociable.
   * Un échec n'interrompt pas les suivants ; il est collecté et rapporté nommément, sans quoi
   * un lot à moitié passé laisserait l'admin sans savoir lequel reprendre.
   *
   * Les deux étapes sont rattrapées **séparément**, et c'est le point délicat. Un `catchError`
   * unique autour des deux traiterait un épinglage refusé — la une pleine, par exemple —
   * comme si l'article n'était pas passé, alors que sa publication, elle, a bien eu lieu :
   * l'admin lirait « échec » sur un article déjà en ligne, et pourrait le republier.
   */
  publishAll(): void {
    this.confirming.set(false);
    const articles = this.queue();
    if (!articles.length) return;

    this.publishing.set(true);
    this.error.set(null);
    const errors: string[] = [];
    const partiels: string[] = [];

    from(articles)
      .pipe(
        concatMap((a) =>
          this.blog.publish(a.id, a.proposedPublishAt ?? undefined).pipe(
            concatMap((publie) =>
              a.proposedFeatured
                ? this.blog
                    .feature(publie.id, this.replacementFor(a.id) || undefined)
                    .pipe(
                      catchError((err) => {
                        partiels.push(
                          `« ${a.title} » — publié, mais pas mis à la une : ` +
                            `${this.messageOf(err) ?? 'échec'}`,
                        );
                        return of(publie);
                      }),
                    )
                : of(publie),
            ),
            catchError((err) => {
              errors.push(`« ${a.title} » — ${this.messageOf(err) ?? 'échec'}`);
              return of(null);
            }),
          ),
        ),
        toArray(),
      )
      .subscribe((results) => {
        this.publishing.set(false);
        this.report.set({
          ok: results.filter(Boolean).length,
          partiels,
          errors,
        });
        // La file se recharge : ce qui est passé en publié en sort de lui-même.
        this.selectedId.set(null);
        this.load();
        // Le compteur global suit sans attendre le prochain battement.
        this.notifier.refresh();
      });
  }

  dismissReport(): void {
    this.report.set(null);
  }

  // --- Utilitaires ----------------------------------------------------------

  /** Remplace un article de la file par sa version fraîche, sans recharger tout l'écran. */
  private patch(maj: Article): void {
    this.queue.update((list) =>
      list.map((a) => (a.id === maj.id ? { ...a, ...maj } : a)),
    );
    this.busyId.set(null);
  }

  private fail(err: unknown, repli = 'Enregistrement impossible.'): void {
    this.busyId.set(null);
    this.error.set(this.messageOf(err) ?? repli);
  }

  /** Message réel du back (NestJS : `{ message: string | string[] }`). */
  private messageOf(err: unknown): string | null {
    const msg = (err as { error?: { message?: string | string[] } } | null)
      ?.error?.message;
    if (Array.isArray(msg)) return msg.join(' · ');
    return typeof msg === 'string' ? msg : null;
  }
}
