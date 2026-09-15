import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
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
  ArticleFlag,
  FlagField,
  MAX_FEATURED,
} from '../../model/article.model';
import { notesDuGroupe } from '../../common/editorial-notes';
import { EditorialNotesComponent } from '../../components/editorial-notes/editorial-notes.component';
import {
  articlesSansPlace,
  projectFeatured,
  projectionAhead,
} from '../../common/featured-projection';
import { FeaturedSlotsComponent } from '../../components/featured-slots/featured-slots.component';
import { BlogService } from '../../services/blog.service';
import { ReviewNotifierService } from '../../services/review-notifier.service';

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
  ],
  templateUrl: './admin-blog-review.component.html',
  styleUrl: './admin-blog-review.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminBlogReviewComponent {
  private readonly blog = inject(BlogService);
  private readonly notifier = inject(ReviewNotifierService);

  /** Conteneur de l'aperçu : borne la sélection au texte de l'article. */
  private readonly previewBox =
    viewChild<ElementRef<HTMLElement>>('previewBox');

  /** Formulaire de signalement, ramené à l'écran à son ouverture. */
  private readonly draftBox = viewChild<ElementRef<HTMLElement>>('draftBox');

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

  readonly flags = signal<ArticleFlag[]>([]);

  /**
   * Signalement en cours de saisie, avant envoi.
   *
   * Une étape intermédiaire plutôt qu'un envoi direct : un signalement sans un mot dit
   * seulement « à revoir », alors que la phrase qui explique *pourquoi* est ce qui rend la
   * retouche utile. On laisse donc l'occasion de l'écrire — sans l'imposer.
   */
  readonly draft = signal<{ field: FlagField; quote?: string } | null>(null);
  readonly draftNote = signal('');

  /** Libellés des cibles, pour l'affichage. */
  private readonly labels: Record<FlagField, string> = {
    title: 'Titre',
    slug: 'Adresse',
    excerpt: 'Extrait',
    metaTitle: 'Titre moteurs',
    metaDescription: 'Description moteurs',
    content: 'Passage',
  };

  label(field: FlagField): string {
    return this.labels[field] ?? field;
  }

  readonly openFlags = computed(() => this.flags().filter((f) => !f.resolvedAt));

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

  /**
   * Ramène le formulaire de signalement à l'écran.
   *
   * Il s'ouvre sous l'aperçu, souvent deux écrans plus bas : sans ce rappel, on clique
   * « Signaler le titre » depuis le haut du panneau et rien ne semble se produire.
   *
   * Appelé depuis l'action, et non par un `effect` : celui-ci s'exécute avant que la requête
   * de vue soit résolue, et ne trouvait donc rien à faire défiler. Le report d'un tour laisse
   * le gabarit se rendre.
   */
  private revealDraft(): void {
    if (typeof window === 'undefined') return;
    setTimeout(() =>
      this.draftBox()?.nativeElement.scrollIntoView({
        block: 'center',
        behavior: 'smooth',
      }),
    );
  }

  // --- Chargement -----------------------------------------------------------

  load(): void {
    this.loading.set(true);
    this.error.set(null);

    this.blog.adminList({ origin: 'ASSISTANT', status: 'DRAFT' }).subscribe({
      next: (articles) => {
        this.queue.set(articles);
        // Sélection par défaut : le premier, pour que l'écran ne s'ouvre pas vide.
        if (!this.selected() && articles.length) {
          this.selectedId.set(articles[0].id);
        }
        const courant = this.selectedId();
        if (courant) {
          this.loadFlags(courant);
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
    this.selectedId.set(id);
    this.draft.set(null);
    this.loadFlags(id);
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

  private loadFlags(articleId: string): void {
    this.blog.flags(articleId).subscribe({
      next: (list) => this.flags.set(list),
      error: () => this.flags.set([]),
    });
  }

  /** Marque un champ entier — titre, adresse, extrait. */
  flagField(field: FlagField): void {
    this.draftNote.set('');
    this.draft.set({ field });
    this.revealDraft();
  }

  /**
   * Marque le passage actuellement sélectionné dans l'aperçu.
   *
   * On prend le texte **rendu** et non du HTML : c'est lui que le serveur retrouvera, et
   * c'est ce qui permet à l'ancrage de survivre à une réécriture partielle.
   */
  flagSelection(): void {
    const selection = typeof window !== 'undefined' ? window.getSelection() : null;

    // La sélection doit venir de l'aperçu. Sans cette borne, un texte surligné dans la file
    // ou dans un signalement partirait comme s'il appartenait à l'article.
    const box = this.previewBox()?.nativeElement;
    const node = selection?.anchorNode;
    if (!box || !node || !box.contains(node)) {
      this.error.set("Sélectionnez le passage dans l'aperçu de l'article.");
      return;
    }

    const quote = selection?.toString().replace(/\s+/g, ' ').trim() ?? '';

    // En deçà, la citation se retrouverait à dix endroits et ne désignerait plus rien —
    // c'est aussi la limite qu'applique le serveur.
    if (quote.length < 8) {
      this.error.set('Sélectionnez un passage un peu plus long (8 caractères au moins).');
      return;
    }
    this.error.set(null);
    this.draftNote.set('');
    this.draft.set({ field: 'content', quote });
    this.revealDraft();
  }

  cancelDraft(): void {
    this.draft.set(null);
    this.draftNote.set('');
  }

  submitDraft(): void {
    const article = this.selected();
    const draft = this.draft();
    if (!article || !draft) return;

    const note = this.draftNote().trim();
    this.busyId.set(article.id);
    this.blog
      .createFlag(article.id, {
        field: draft.field,
        ...(draft.quote ? { quote: draft.quote } : {}),
        ...(note ? { note } : {}),
      })
      .subscribe({
        next: () => {
          this.busyId.set(null);
          this.cancelDraft();
          this.loadFlags(article.id);
        },
        error: (err) => this.fail(err, "Le signalement n'a pas pu être enregistré."),
      });
  }

  // --- Modification d'un signalement ----------------------------------------

  /** Signalement dont la note est en cours de réécriture. */
  readonly editingId = signal<string | null>(null);
  readonly editingNote = signal('');

  startEdit(flag: ArticleFlag): void {
    this.draft.set(null);
    this.editingNote.set(flag.note ?? '');
    this.editingId.set(flag.id);
  }

  cancelEdit(): void {
    this.editingId.set(null);
    this.editingNote.set('');
  }

  saveEdit(flag: ArticleFlag): void {
    const article = this.selected();
    if (!article) return;

    const note = this.editingNote().trim();
    this.busyId.set(article.id);
    this.blog.updateFlag(flag.id, note || null).subscribe({
      next: () => {
        this.busyId.set(null);
        this.cancelEdit();
        this.loadFlags(article.id);
      },
      error: (err) => this.fail(err, "La note n'a pas pu être modifiée."),
    });
  }

  removeFlag(flag: ArticleFlag): void {
    const article = this.selected();
    if (!article) return;
    this.busyId.set(article.id);
    this.blog.deleteFlag(flag.id).subscribe({
      next: () => {
        this.busyId.set(null);
        this.loadFlags(article.id);
      },
      error: (err) => this.fail(err),
    });
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
