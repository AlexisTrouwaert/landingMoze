import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { ProjectedSlot } from '../../common/featured-projection';

/** L'état d'un emplacement, du point de vue de l'article qu'on cherche à mettre à la une. */
export type SlotState = 'leaving' | 'taken' | 'arriving' | 'current';

/**
 * Les cinq emplacements de la une, projetés à une date, avec ce qui leur arrivera.
 *
 * **Pourquoi un composant.** Trois écrans posent la même question — le pupitre de relecture,
 * la liste et l'éditeur — et tous trois demandent de désigner l'article qui cédera sa place.
 * Les deux derniers montraient une liste plate de titres : sans état ni date, on choisissait
 * sur la une d'aujourd'hui alors que l'échange n'aura lieu qu'à la parution. Recopier le
 * gabarit du pupitre une troisième fois aurait mis quatre icônes et quatre libellés en trois
 * exemplaires, donc trois occasions de diverger.
 *
 * Des pastilles ne suffiraient pas : les titres sont longs, et chaque ligne doit dire trois
 * choses — qui occupe la place, depuis quand, et ce qui lui arrivera. Une liste le fait, une
 * pastille tronque.
 */
@Component({
  selector: 'app-featured-slots',
  templateUrl: './featured-slots.component.html',
  styleUrl: './featured-slots.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FeaturedSlotsComponent {
  readonly slots = input.required<readonly ProjectedSlot[]>();

  /**
   * L'emplacement déjà désigné comme sortant, s'il y en a un.
   *
   * Comparé à l'occupant projeté (`slot.id`) et non à `slotId` : c'est ainsi que le pupitre
   * mémorise le choix, et changer cette convention ici toucherait à sa sémantique d'échange
   * différé sans que rien ne l'ait demandé.
   */
  readonly replacedId = input<string | null>(null);

  /**
   * Emplacements retenus par un autre article du même lot, et par lequel.
   *
   * Grisés plutôt que masqués : voir la place occupée, et par qui, vaut mieux qu'une liste
   * qui rétrécit sans explication.
   */
  readonly claimed = input<Readonly<Record<string, string>>>({});

  /**
   * Libellé du bouton d'action, quand la ligne en porte un — « Remplacer » dans les modales.
   * Absent dans le pupitre, où c'est la ligne entière qui vaut choix.
   */
  readonly cta = input<string | null>(null);

  /** L'emplacement choisi. L'appelant décide s'il vise `slotId` ou l'occupant projeté. */
  readonly chosen = output<ProjectedSlot>();

  /** Date d'arrivée en version brève — « 14 sept. ». */
  private readonly jour = new Intl.DateTimeFormat('fr-FR', {
    day: 'numeric',
    month: 'short',
  });

  enJour(iso: string): string {
    return this.jour.format(new Date(iso));
  }

  /**
   * Quatre états qui se ressemblent, calculés ici plutôt que déduits dans le gabarit : c'est
   * exactement le genre de logique qui se met à mentir une fois éparpillée en conditions
   * imbriquées.
   */
  state(slot: ProjectedSlot): SlotState {
    if (this.replacedId() === slot.id) return 'leaving';
    if (this.claimed()[slot.id]) return 'taken';
    return slot.future ? 'arriving' : 'current';
  }

  /** Le titre de l'article qui a déjà retenu cet emplacement, s'il y en a un. */
  claimedBy(slot: ProjectedSlot): string | undefined {
    return this.claimed()[slot.id];
  }

  choose(slot: ProjectedSlot): void {
    if (this.state(slot) === 'taken') return;
    this.chosen.emit(slot);
  }
}
