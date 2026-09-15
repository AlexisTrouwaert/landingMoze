import { AdminFeaturedItem, FeaturedSuccessor } from '../model/article.model';

/**
 * La une **telle qu'elle sera** à une date donnée.
 *
 * Trois écrans posent la même question — le pupitre de relecture, la liste et l'éditeur —
 * et tous trois demandent à l'auteur de désigner un article qui cédera sa place. Montrer la
 * une d'aujourd'hui quand l'échange n'aura lieu que dans quinze jours revient à faire choisir
 * sur un état périmé : les occupants affichés auront déjà changé.
 *
 * Le calcul vit ici, hors des composants, parce qu'il est pur et qu'il n'a aucune raison
 * d'exister en trois exemplaires — trois copies d'une règle, ce sont trois occasions qu'elle
 * diverge.
 */

export interface ProjectedSlot {
  /**
   * L'emplacement, identifié par son occupant **actuel**.
   *
   * Distinct de `id` à dessein : c'est cet identifiant que le back attend comme « article
   * remplacé », puisque c'est lui qui tient la place aujourd'hui.
   */
  slotId: string;
  /** L'occupant projeté à la date visée. */
  id: string;
  title: string;
  /** Vrai si cet occupant n'est pas celui d'aujourd'hui. */
  future: boolean;
  /** Depuis quand il tient la place. Nul s'il y est déjà. */
  since: string | null;
  /**
   * Le prochain échange déjà décidé sur cet emplacement, **après** la date visée. Nul si
   * plus rien n'est prévu.
   *
   * C'est ce qui rend la modale utile quand aucune date n'est connue — le cas d'un article
   * qu'on rédige encore. On ne peut alors rien projeter, mais on peut dire que cette place
   * est déjà promise à quelqu'un : la choisir signifierait viser un occupant qui ne sera
   * peut-être plus là au moment où l'échange s'appliquera.
   */
  nextChange: FeaturedSuccessor | null;
}

/**
 * Déroule les échanges déjà programmés jusqu'à `at`.
 *
 * `at` nul — aucune date visée — rend la une d'aujourd'hui : c'est le seul état dont on soit
 * certain, et inventer une projection sans date la rendrait fausse plutôt qu'absente.
 */
export function projectFeatured(
  featured: readonly AdminFeaturedItem[],
  at: number | null,
): ProjectedSlot[] {
  return featured.map((f) => {
    // `?? []` : le champ est récent. Face à un back plus ancien, l'écran retombe sur l'état
    // du jour au lieu de planter — une projection absente vaut mieux qu'un écran mort.
    // Un successeur sans date ne peut pas être situé dans le temps : il est écarté ici
    // plutôt que d'être sauté au milieu de la boucle, ce qui fausserait le rang.
    const suite = (f.succession ?? []).filter((s) => s.publishedAt);

    let occupant = {
      id: f.id,
      title: f.title,
      future: false,
      since: null as string | null,
    };

    // La file est ordonnée : on avance tant que l'échéance précède la date visée.
    let i = 0;
    if (at !== null) {
      while (i < suite.length && new Date(suite[i].publishedAt!).getTime() <= at) {
        const s = suite[i];
        occupant = { id: s.id, title: s.title, future: true, since: s.publishedAt };
        i += 1;
      }
    }

    // Sans date visée, `i` vaut zéro : le prochain échange est simplement le premier de la
    // file. C'est ce qui permet d'avertir même quand on ne peut rien projeter.
    return { slotId: f.id, ...occupant, nextChange: suite[i] ?? null };
  });
}

/**
 * La date à laquelle projeter, pour un article qu'on cherche à mettre à la une.
 *
 * Un article déjà paru prend la place tout de suite : sa date est derrière nous, et la une
 * pertinente est celle d'aujourd'hui. Un article programmé, lui, ne la prendra qu'à sa
 * parution — c'est alors la une de ce jour-là qu'il faut montrer.
 */
export function projectionTarget(publishedAt: string | null | undefined): number | null {
  if (!publishedAt) return null;
  const at = new Date(publishedAt).getTime();
  return Number.isNaN(at) || at <= Date.now() ? null : at;
}

/** Vrai si la projection diffère de l'état actuel — donc s'il y a lieu de le dire. */
export function projectionAhead(slots: readonly ProjectedSlot[]): boolean {
  return slots.some((s) => s.future);
}

/**
 * Les articles d'un lot qui demandent la une sans qu'aucune place ne leur revienne.
 *
 * Le compte ne peut pas se limiter à la une d'aujourd'hui : le lot se publie d'un bloc, si
 * bien que chaque article épinglé avant celui-ci a déjà pris sa place. Une une à quatre
 * occupants et quatre articles proposés donnent, à ne regarder que l'état courant, quatre fois
 * « il reste de la place » — puis un seul passe et les trois autres sont refusés par le
 * serveur, **après avoir été publiés**, puisque l'épinglage vient en second.
 *
 * Un article qui désigne un sortant ne consomme rien : il occupe la place qu'il libère.
 * L'ordre est celui de la file, c'est-à-dire celui dans lequel la mise en ligne les traite.
 *
 * Hors du composant parce que c'est le cœur d'un garde-fou : ici, il s'éprouve sans navigateur.
 */
export function articlesSansPlace(
  dejaOccupees: number,
  // `proposedFeatured` optionnel : le champ est réservé aux réponses admin, et le modèle le
  // déclare donc facultatif. Absent vaut « non proposé », ce qui est le bon défaut.
  file: readonly { id: string; proposedFeatured?: boolean }[],
  remplacants: Readonly<Record<string, string>>,
  max: number,
): Set<string> {
  const manquants = new Set<string>();
  let occupees = dejaOccupees;

  for (const a of file) {
    if (!a.proposedFeatured || remplacants[a.id]) continue;
    if (occupees >= max) manquants.add(a.id);
    else occupees += 1;
  }
  return manquants;
}

/**
 * Vrai si au moins une place est déjà promise à un autre article.
 *
 * Distinct de {@link projectionAhead} : celui-ci répond « la une aura changé d'ici la date
 * visée », celui-là « des échanges sont décidés, quelle que soit la date ». Le second est le
 * seul qui ait un sens quand on ne connaît pas encore la date de parution.
 */
export function projectionPending(slots: readonly ProjectedSlot[]): boolean {
  return slots.some((s) => s.nextChange !== null);
}
