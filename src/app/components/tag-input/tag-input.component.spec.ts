import { TestBed } from '@angular/core/testing';

import { TagInputComponent } from './tag-input.component';
import { Tag } from '../../model/article.model';

describe('TagInputComponent', () => {
  let component: TagInputComponent;
  let onChange: jasmine.Spy;

  const suggestions: Tag[] = [
    { id: '1', name: 'Réparation', slug: 'reparation' },
    { id: '2', name: 'Auto', slug: 'auto' },
  ];

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TagInputComponent],
    }).compileComponents();
    const fixture = TestBed.createComponent(TagInputComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('suggestions', suggestions);
    onChange = jasmine.createSpy('onChange');
    component.registerOnChange(onChange);
  });

  it('découpe une saisie collée sur les virgules → plusieurs tags', () => {
    component.add('Voiture, mécanique, réparation');
    // « réparation » réutilise la casse canonique du tag existant « Réparation ».
    expect(component.tags()).toEqual(['Voiture', 'mécanique', 'Réparation']);
    expect(onChange).toHaveBeenCalledWith(['Voiture', 'mécanique', 'Réparation']);
  });

  it("réutilise le nom canonique d'un tag existant (casse différente)", () => {
    component.add('auto, RÉPARATION');
    expect(component.tags()).toEqual(['Auto', 'Réparation']);
  });

  it('dédoublonne (insensible à la casse)', () => {
    component.writeValue(['Voiture']);
    component.add('voiture, Moto');
    expect(component.tags()).toEqual(['Voiture', 'Moto']);
  });

  it('ignore les entrées vides', () => {
    component.add('a,, b ,  , c');
    expect(component.tags()).toEqual(['a', 'b', 'c']);
  });

  it('saisie simple sans virgule → un seul tag', () => {
    component.add('simple');
    expect(component.tags()).toEqual(['simple']);
  });

  it('remove() retire un tag et notifie', () => {
    component.writeValue(['A', 'B']);
    onChange.calls.reset();
    component.remove('A');
    expect(component.tags()).toEqual(['B']);
    expect(onChange).toHaveBeenCalledWith(['B']);
  });
});
