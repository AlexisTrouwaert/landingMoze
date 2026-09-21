import {
  ANNEX_BLOCKS,
  ANNEX_LABELS,
  IntakeAnnex,
  IntakeArticle,
  IntakeResult,
  IntakeSeries,
  annexSlotFor,
  estVrai,
  fieldFor,
  normalizeLabel,
  parseDateFr,
  readSeriesFields,
  slugifyLabel,
} from './article-intake';

/**
 * Lecture d'articles collés depuis une conversation avec une IA.
 *
 * **Pourquoi ce format et pas celui des DOCX.** Le parseur DOCX devait *deviner* où commence
 * l'article parmi les métadonnées et les posts. Ici la frontière est **déclarée** : `---` nu
 * termine l'en-tête, `--- nom` ouvre une annexe. Il n'y a aucune heuristique à se tromper.
 *
 * Le corps est déjà du HTML restreint à la whitelist du back : pas de conversion, donc pas
 * d'occasion d'y perdre de la mise en forme.
 *
 * Format attendu, un bloc par article, séparés par une ligne de `===` :
 *
 *     titre: La journée type du freelance n'existe pas ☕
 *     slug: journee-type-freelance-existe-pas
 *     extrait: Emplois du temps millimétrés…
 *     tags: gestion du temps, Freelance
 *     date: 2026-09-14T08:00:00+02:00
 *     alaune: oui
 *     ---
 *     <h2>Ce qu'on cherche vraiment</h2>
 *     <p>…</p>
 *
 *     --- linkedin
 *     « Décris-moi ta journée type. » Probablement la question…
 */

/** Séparateur entre deux articles : une ligne ne contenant que des `=`. */
const SEPARATEUR = /^\s*={3,}\s*$/;

/** Fin de l'en-tête (`---`) ou ouverture d'une annexe (`--- linkedin`). */
const TIRETS = /^\s*-{3,}\s*(.*)$/;

/** Longueurs que le back refuse (cf. `CreateArticleDto`). Vérifiées avant l'envoi. */
const MAX = {
  titre: 200,
  slug: 120,
  extrait: 500,
  metaTitle: 200,
  metaDescription: 500,
  tag: 50,
} as const;

/**
 * Découpe le texte collé en blocs d'article.
 *
 * Les blocs vides sont ignorés plutôt que signalés : un séparateur en trop à la fin d'un
 * copier-coller est la faute de frappe la plus banale qui soit, et elle ne mérite pas d'erreur.
 */
function decouper(texte: string): string[] {
  return texte
    .split(/\r?\n/)
    .reduce<string[][]>(
      (blocs, ligne) => {
        if (SEPARATEUR.test(ligne)) blocs.push([]);
        else blocs[blocs.length - 1].push(ligne);
        return blocs;
      },
      [[]],
    )
    .map((lignes) => lignes.join('\n'))
    .filter((bloc) => bloc.trim().length > 0);
}

interface BlocLu {
  entete: Map<string, string>;
  corps: string;
  annexes: IntakeAnnex[];
  inconnues: string[];
}

/** Sépare en-tête, corps et annexes. */
function separer(bloc: string): BlocLu {
  const lignes = bloc.split(/\r?\n/);
  const entete = new Map<string, string>();
  const inconnues: string[] = [];
  const annexes: IntakeAnnex[] = [];
  const corps: string[] = [];

  /** `null` tant qu'on lit l'en-tête, puis le nom de la section en cours (`''` = le corps). */
  let section: string | null = null;
  let courant: string[] = [];

  const fermer = (nom: string): void => {
    const texte = courant.join('\n').trim();
    courant = [];
    if (!texte) return;
    if (!nom) {
      corps.push(texte);
      return;
    }
    // Les deux tables, et dans cet ordre. `ANNEX_BLOCKS` porte les intitulés de section,
    // `ANNEX_LABELS` ceux que le document Word écrit sur une seule ligne (« Idée d'image : … »).
    // Les consulter toutes les deux est ce qui garantit qu'un même intitulé aboutit au même
    // emplacement quelle que soit la porte d'entrée : sans cela, « Idée d'image » deviendrait
    // `image` depuis un DOCX et `idee-d-image` depuis un collage, et la même annexe se
    // retrouverait rangée à deux endroits.
    const label = normalizeLabel(nom);
    annexes.push({
      slot:
        annexSlotFor(label, ANNEX_BLOCKS) ??
        annexSlotFor(label, ANNEX_LABELS) ??
        slugifyLabel(nom),
      label: nom,
      body: texte,
    });
  };

  for (const ligne of lignes) {
    const tirets = TIRETS.exec(ligne);
    if (tirets) {
      if (section !== null) fermer(section);
      section = tirets[1].trim();
      continue;
    }

    if (section !== null) {
      courant.push(ligne);
      continue;
    }

    // En-tête : `clé: valeur`, une par ligne.
    if (!ligne.trim()) continue;
    const sep = ligne.indexOf(':');
    if (sep === -1) break;

    const brut = ligne.slice(0, sep).trim();
    const cle = normalizeLabel(brut);
    // La valeur peut contenir des « : » — on ne coupe qu'au premier.
    const valeur = ligne.slice(sep + 1).trim();

    const champ = fieldFor(cle);
    if (champ) entete.set(champ, valeur);
    else inconnues.push(brut);
  }
  if (section !== null) fermer(section);

  return { entete, corps: corps.join('\n\n'), annexes, inconnues };
}

/** Longueurs d'une série que le back refuse (cf. `CreateSeriesDto`). */
const MAX_SERIE = { titre: 120, accroche: 240, ideeImage: 1000 } as const;

/** Ce que déclare la ligne `type:` d'un bloc. `null` : une valeur que le format ne connaît pas. */
function typeDeBloc(valeur: string | undefined): 'article' | 'serie' | null {
  const type = normalizeLabel(valeur ?? '');
  if (!type || type === 'article') return 'article';
  return type === 'serie' ? 'serie' : null;
}

/**
 * Lit un bloc `type: série` — le brouillon d'une série.
 *
 * Même grammaire qu'un article, pour que l'IA n'ait qu'un format à tenir : `titre:` nomme la
 * série, `accroche:` et `episodes:` la décrivent, `--- image` porte l'idée de l'image de tête.
 * Il n'a ni corps ni posts : ce sont ses épisodes qui les portent. Ce qu'il contiendrait en
 * plus est signalé et laissé de côté plutôt que refusé — une annexe en trop n'empêche pas de
 * créer la série.
 */
function lireSerie(bloc: BlocLu, rang: string, errors: string[]): IntakeSeries | null {
  const { entete, corps, annexes, inconnues } = bloc;

  const titre = entete.get('title') ?? '';
  if (!titre) {
    errors.push(`${rang}il manque la ligne « titre: » — le nom de la série.`);
    return null;
  }

  // `accroche:` est lue comme l'extrait d'un article : c'en est l'équivalent pour une série.
  const accroche = entete.get('excerpt') ?? '';
  const idee = annexes.find((a) => a.slot === 'image')?.body ?? '';

  const trop = (quoi: string, valeur: string, max: number): boolean => {
    if (valeur.length <= max) return false;
    errors.push(`${rang}${quoi} trop long : ${valeur.length} caractères, maximum ${max}.`);
    return true;
  };
  let invalide = trop('nom de la série', titre, MAX_SERIE.titre);
  invalide = trop('accroche', accroche, MAX_SERIE.accroche) || invalide;
  invalide = trop('idée d’image', idee, MAX_SERIE.ideeImage) || invalide;
  if (invalide) return null;

  const total = Number(/\d+/.exec(entete.get('seriesPlannedCount') ?? '')?.[0] ?? NaN);
  const plannedCount = total >= 1 && total <= 99 ? total : null;

  const warnings: string[] = [];
  if (!accroche) warnings.push('pas d’accroche : la carte de la série n’aura que son nom.');
  if (!idee) warnings.push('pas d’idée d’image : l’image de tête sera à trouver sans brief.');
  if (plannedCount === null) {
    warnings.push('pas de nombre d’épisodes : la série ne pourra jamais être dite complète.');
  }
  if (corps) warnings.push('corps ignoré : ce sont les épisodes qui portent le texte.');
  const autres = annexes.filter((a) => a.slot !== 'image');
  if (autres.length) {
    warnings.push(`annexes ignorées pour une série : ${autres.map((a) => a.label).join(', ')}.`);
  }
  if (inconnues.length) warnings.push(`lignes d'en-tête ignorées : ${inconnues.join(', ')}.`);

  return { title: titre, pitch: accroche, plannedCount, imageIdea: idee, warnings };
}

/** Lit un ou plusieurs articles collés, et les brouillons de série qui les accompagnent. */
export function parsePastedArticles(texte: string): IntakeResult {
  const blocs = decouper(texte);
  if (!blocs.length) {
    return { articles: [], series: [], errors: ['Rien à lire : le texte collé est vide.'] };
  }

  const articles: IntakeArticle[] = [];
  const series: IntakeSeries[] = [];
  const errors: string[] = [];

  blocs.forEach((bloc, index) => {
    const rang = blocs.length > 1 ? `Article ${index + 1} : ` : '';
    const lu = separer(bloc);

    const type = typeDeBloc(lu.entete.get('type'));
    if (type === null) {
      errors.push(
        `${blocs.length > 1 ? `Bloc ${index + 1} : ` : ''}type « ${lu.entete.get('type')} » ` +
          'inconnu — « série » pour une série, rien pour un article.',
      );
      return;
    }
    if (type === 'serie') {
      const serie = lireSerie(lu, blocs.length > 1 ? `Série (bloc ${index + 1}) : ` : 'Série : ', errors);
      if (serie) series.push(serie);
      return;
    }

    const { entete, corps, annexes, inconnues } = lu;
    const warnings: string[] = [];

    const titre = entete.get('title') ?? '';
    if (!titre) {
      errors.push(`${rang}il manque la ligne « titre: ».`);
      return;
    }
    if (!corps) {
      errors.push(
        `${rang}corps vide. L'en-tête doit être suivi d'une ligne « --- » puis du HTML.`,
      );
      return;
    }

    const trop = (quoi: string, valeur: string, max: number): boolean => {
      if (valeur.length <= max) return false;
      errors.push(`${rang}${quoi} trop long : ${valeur.length} caractères, maximum ${max}.`);
      return true;
    };

    const slug = entete.get('slug') ?? '';
    const extrait = entete.get('excerpt') ?? '';
    const metaTitle = entete.get('metaTitle') ?? '';
    const metaDescription = entete.get('metaDescription') ?? '';

    let invalide = trop('titre', titre, MAX.titre);
    invalide = trop('slug', slug, MAX.slug) || invalide;
    invalide = trop('extrait', extrait, MAX.extrait) || invalide;
    invalide = trop('metaTitle', metaTitle, MAX.metaTitle) || invalide;
    invalide = trop('metaDescription', metaDescription, MAX.metaDescription) || invalide;

    const tags = (entete.get('tags') ?? '')
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);
    for (const tag of tags) {
      if (tag.length > MAX.tag) {
        errors.push(`${rang}tag « ${tag} » trop long : maximum ${MAX.tag} caractères.`);
        invalide = true;
      }
    }

    const { iso, jour, erreur } = parseDateFr(entete.get('publishAt') ?? '');
    if (erreur) {
      errors.push(`${rang}${erreur}`);
      invalide = true;
    }
    // Une date passée est refusée par le serveur ; autant le dire ici, avant l'envoi.
    if (iso && new Date(iso).getTime() <= Date.now()) {
      errors.push(`${rang}la date de parution est déjà passée.`);
      invalide = true;
    }
    if (jour) {
      warnings.push("seul un jour est donné : l'heure de parution reste à préciser.");
    }

    if (invalide) return;

    if (inconnues.length) {
      warnings.push(`lignes d'en-tête ignorées : ${inconnues.join(', ')}.`);
    }
    if (!tags.length) warnings.push('aucun tag.');
    if (!extrait) warnings.push('aucun extrait.');
    // La série se lit dans l'en-tête et, à défaut, dans le titre : une IA écrit volontiers
    // « (2/6) » malgré la consigne. Le titre en ressort nettoyé.
    const { title: titrePropre, ...serie } = readSeriesFields(
      entete.get('series'),
      entete.get('seriesPosition'),
      titre,
      entete.get('seriesPlannedCount'),
    );
    if (serie.series && titrePropre !== titre.trim()) {
      warnings.push(
        `« ${titre.trim()} » : la numérotation est retirée du titre, la série l'affiche.`,
      );
    }

    if (/<h1[\s>]/i.test(corps)) {
      warnings.push('le corps contient un <h1> — la page en rend déjà un, il sera retiré.');
    }

    articles.push({
      input: {
        title: titrePropre,
        ...(slug ? { slug } : {}),
        ...(extrait ? { excerpt: extrait } : {}),
        content: corps,
        ...(metaTitle ? { metaTitle } : {}),
        ...(metaDescription ? { metaDescription } : {}),
        ...(tags.length ? { tags } : {}),
        origin: 'ASSISTANT',
      },
      proposedPublishAt: iso,
      proposedPublishDay: jour,
      proposedFeatured: estVrai(entete.get('featured') ?? ''),
      ...serie,
      coverImageAlt: entete.get('coverImageAlt') ?? null,
      annexes,
      warnings,
    });
  });

  return { articles, series, errors };
}
