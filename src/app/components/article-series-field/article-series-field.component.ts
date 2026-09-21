import { DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  signal,
} from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { startWith } from 'rxjs';
import { toEventSlug } from '../../common/event-intake';
import { AdminSeries } from '../../model/series.model';
import { BlogService } from '../../services/blog.service';

/** Ligne de la frise : un épisode de la série, cet article compris. */
interface TimelineRow {
  id: string;
  position: number | null;
  title: string;
  status: string;
  publishedAt: string | null;
  current: boolean;
}

/**
 * La carte « Série » de l'éditeur d'article : rattacher l'article à une série, lui donner son
 * numéro, et voir la série entière pour ne pas se tromper.
 *
 * - **Le nom** propose les séries existantes ; un nom inconnu crée la série à l'enregistrement,
 *   comme un tag. Deux écritures du même nom (casse, accents) désignent la même série.
 * - **Le numéro** se propose seul : le suivant du dernier épisode. Vide, le back fait de même.
 * - **La frise** montre les autres épisodes avec leur date : un numéro déjà pris, ou un épisode
 *   programmé avant le précédent, se voit avant d'enregistrer.
 *
 * Les contrôles viennent du formulaire de l'éditeur : c'est lui qui les enregistre.
 */
@Component({
  selector: 'app-article-series-field',
  imports: [ReactiveFormsModule, RouterLink, DatePipe],
  templateUrl: './article-series-field.component.html',
  styleUrl: './article-series-field.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ArticleSeriesFieldComponent {
  private readonly blog = inject(BlogService);

  readonly seriesControl = input.required<FormControl<string>>();
  readonly positionControl = input.required<FormControl<number | null>>();
  /** Identifiant de l'article ouvert, `null` pour un nouvel article. */
  readonly articleId = input<string | null>(null);
  /** Titre en cours de saisie, pour nommer « cet article » dans la frise. */
  readonly articleTitle = input('');
  /** Date de parution de l'article ouvert (future s'il est programmé). */
  readonly articlePublishedAt = input<string | null>(null);

  readonly all = signal<AdminSeries[]>([]);

  /** Identifiants stables des listes de suggestions, un par instance. */
  readonly listId = `series-options-${Math.random().toString(36).slice(2, 8)}`;

  /** Valeurs courantes des deux contrôles, tenues à jour par abonnement (cf. constructeur). */
  readonly name = signal('');
  private readonly position = signal<number | null>(null);

  constructor() {
    this.blog.adminSeries().subscribe({
      next: (series) => this.all.set(series),
      error: () => this.all.set([]),
    });

    // Les contrôles arrivent en entrée : on s'abonne une fois qu'ils sont posés, et on se
    // réabonne si l'éditeur en fournit d'autres.
    effect((onCleanup) => {
      const series = this.seriesControl();
      const position = this.positionControl();
      const subs = [
        series.valueChanges.pipe(startWith(series.value)).subscribe((v) => this.name.set(v)),
        position.valueChanges.pipe(startWith(position.value)).subscribe((v) => this.position.set(v)),
      ];
      onCleanup(() => subs.forEach((s) => s.unsubscribe()));
    });
  }

  /** La série existante qui porte ce nom, à la casse et aux accents près. */
  readonly match = computed(() => {
    const slug = toEventSlug(this.name());
    return slug ? (this.all().find((s) => s.slug === slug) ?? null) : null;
  });

  readonly isNew = computed(() => !!this.name().trim() && !this.match());

  /** Le numéro que prendrait l'article : le suivant du dernier épisode des autres articles. */
  readonly suggested = computed(() => {
    const series = this.match();
    if (!series) return 1;
    const others = series.articles.filter((a) => a.id !== this.articleId());
    return Math.max(0, ...others.map((a) => a.seriesPosition ?? 0)) + 1;
  });

  readonly timeline = computed<TimelineRow[]>(() => {
    const series = this.match();
    if (!series) return [];
    const id = this.articleId();
    const typed = this.position() || null;

    const rows: TimelineRow[] = series.articles
      .filter((a) => a.id !== id)
      .map((a) => ({
        id: a.id,
        position: a.seriesPosition,
        title: a.title,
        status: a.status,
        publishedAt: a.publishedAt,
        current: false,
      }));
    rows.push({
      id: id ?? 'nouveau',
      position: typed ?? this.suggested(),
      title: this.articleTitle() || 'Cet article',
      status: 'current',
      publishedAt: this.articlePublishedAt(),
      current: true,
    });
    return rows.sort(
      (a, b) => (a.position ?? 999) - (b.position ?? 999) || Number(b.current) - Number(a.current),
    );
  });

  /** Un autre article porte déjà ce numéro dans la série. */
  readonly taken = computed(() => {
    const current = this.timeline().find((r) => r.current);
    if (!current?.position) return null;
    return this.timeline().find((r) => !r.current && r.position === current.position) ?? null;
  });

  /**
   * Un épisode paraît avant un épisode de numéro inférieur — le lecteur du 3 lirait une suite
   * qui n'existe pas encore. Seules les dates connues comptent : un brouillon n'en a pas.
   */
  readonly inverted = computed(() => {
    const dated = this.timeline().filter((r) => r.publishedAt && r.position !== null);
    for (let i = 1; i < dated.length; i++) {
      if (new Date(dated[i].publishedAt!).getTime() < new Date(dated[i - 1].publishedAt!).getTime()) {
        return { earlier: dated[i - 1], later: dated[i] };
      }
    }
    return null;
  });

  statusLabel(row: TimelineRow): string {
    if (row.current) return 'cet article';
    if (row.status === 'DRAFT') return 'brouillon';
    if (row.status === 'ARCHIVED') return 'archivé';
    if (row.publishedAt && new Date(row.publishedAt).getTime() > Date.now()) return 'programmé';
    return 'publié';
  }
}
