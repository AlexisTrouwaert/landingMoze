import { Injectable, PLATFORM_ID, inject, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

/** Clé de stockage. Versionnée : un changement de forme n'a pas à lire l'ancienne. */
const STORAGE_KEY = 'moze.series.read.v1';

/** Épisodes lus, par série : `{ "les-silences-du-metier": ["relancer-un-devis…"] }`. */
type ReadMap = Record<string, string[]>;

/**
 * Ce que le lecteur a déjà lu dans chaque série — de quoi cocher « Lu » et proposer
 * « Reprendre à l'épisode 3 ».
 *
 * **Dans son navigateur seulement.** Aucun compte, rien ne part vers un serveur : c'est une
 * commodité de lecture, pas une mesure d'audience. Le comptage des vues reste celui du back.
 *
 * Retenu par slug d'épisode et non par numéro : renuméroter une série ne décoche rien.
 * Côté serveur (rendu SSR), rien n'est lu : la page part sans coche, le navigateur les pose.
 */
@Injectable({ providedIn: 'root' })
export class SeriesProgressService {
  private readonly browser = isPlatformBrowser(inject(PLATFORM_ID));

  /** Lu une fois, puis tenu à jour : les composants réagissent aux coches posées ailleurs. */
  private readonly read = signal<ReadMap>(this.load());

  /** Les épisodes lus d'une série. */
  readEpisodes(seriesSlug: string): ReadonlySet<string> {
    return new Set(this.read()[seriesSlug] ?? []);
  }

  /** Marque un épisode comme lu. Sans effet côté serveur ou si le stockage est refusé. */
  markRead(seriesSlug: string, episodeSlug: string): void {
    if (!this.browser) return;
    const current = this.read();
    const episodes = current[seriesSlug] ?? [];
    if (episodes.includes(episodeSlug)) return;

    const next = { ...current, [seriesSlug]: [...episodes, episodeSlug] };
    this.read.set(next);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      /* navigation privée, stockage plein ou refusé : la coche vaut pour la visite */
    }
  }

  private load(): ReadMap {
    if (!this.browser) return {};
    try {
      const parsed: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}');
      return parsed && typeof parsed === 'object' ? (parsed as ReadMap) : {};
    } catch {
      return {};
    }
  }
}
