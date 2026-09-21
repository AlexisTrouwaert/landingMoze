import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SeriesCoverComponent } from './series-cover.component';

/** Hôte minimal : les entrées d'un `input.required` se posent depuis un gabarit. */
@Component({
  imports: [SeriesCoverComponent],
  template: `<app-series-cover [head]="head()" [covers]="covers()" [fresh]="fresh()" />`,
})
class HoteTest {
  readonly head = signal<string | null>(null);
  readonly covers = signal<(string | null)[]>([]);
  readonly fresh = signal(false);
}

/**
 * La pile de couvertures d'une série : ce qu'on voit du rayon avant d'avoir lu quoi que ce soit.
 * Trois calques, l'image de tête devant, et jamais de trou au milieu.
 */
describe('SeriesCoverComponent — la pile de couvertures', () => {
  let fixture: ComponentFixture<HoteTest>;
  let host: HTMLElement;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [HoteTest] });
    fixture = TestBed.createComponent(HoteTest);
    host = fixture.nativeElement as HTMLElement;
  });

  /** Les images réellement rendues, de devant vers l'arrière. */
  function pile(): (string | null)[] {
    return ['front', 'mid', 'back'].map(
      (rang) => host.querySelector(`.layer--${rang} img`)?.getAttribute('src') ?? null,
    );
  }

  it('l’image de tête passe devant les couvertures d’épisodes', () => {
    fixture.componentInstance.head.set('tete.jpg');
    fixture.componentInstance.covers.set(['ep3.jpg', 'ep2.jpg', 'ep1.jpg']);
    fixture.detectChanges();

    expect(pile()).toEqual(['tete.jpg', 'ep3.jpg', 'ep2.jpg']);
  });

  it('sans image de tête, le dernier épisode prend la place de devant', () => {
    fixture.componentInstance.covers.set(['ep2.jpg', 'ep1.jpg']);
    fixture.detectChanges();

    expect(pile()).toEqual(['ep2.jpg', 'ep1.jpg', null]);
  });

  it('un épisode sans couverture est sauté, pas laissé en trou', () => {
    fixture.componentInstance.covers.set(['ep3.jpg', null, 'ep1.jpg']);
    fixture.detectChanges();

    expect(pile()).toEqual(['ep3.jpg', 'ep1.jpg', null]);
  });

  it('au-delà de trois images, le reste ne se verrait pas : la pile s’arrête là', () => {
    fixture.componentInstance.head.set('tete.jpg');
    fixture.componentInstance.covers.set(['ep4.jpg', 'ep3.jpg', 'ep2.jpg', 'ep1.jpg']);
    fixture.detectChanges();

    expect(pile()).toEqual(['tete.jpg', 'ep4.jpg', 'ep3.jpg']);
    expect(host.querySelectorAll('img').length).toBe(3);
  });

  it('sans aucune image, la forme de pile reste : trois calques, aucune image', () => {
    fixture.detectChanges();

    expect(host.querySelectorAll('.layer').length).toBe(3);
    expect(host.querySelectorAll('img').length).toBe(0);
    expect(host.querySelectorAll('.layer--img').length).toBe(0);
  });

  it('la pastille « Nouvel épisode » ne s’affiche que sur demande', () => {
    fixture.detectChanges();
    expect(host.querySelector('.fresh')).toBeNull();

    fixture.componentInstance.fresh.set(true);
    fixture.detectChanges();
    expect(host.querySelector('.fresh')?.textContent?.trim()).toBe('Nouvel épisode');
  });
});
