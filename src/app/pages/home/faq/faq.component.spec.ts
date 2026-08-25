import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { FaqComponent } from './faq.component';
import { MetaPixelService } from '../../../services/meta-pixel.service';

describe('FaqComponent', () => {
  let fixture: ComponentFixture<FaqComponent>;
  let component: FaqComponent;
  let pixel: jasmine.SpyObj<MetaPixelService>;

  beforeEach(async () => {
    pixel = jasmine.createSpyObj<MetaPixelService>('MetaPixelService', [
      'trackCustomEvent',
    ]);
    await TestBed.configureTestingModule({
      imports: [FaqComponent],
      // provideRouter : SeoService (JSON-LD FAQPage) écoute la navigation.
      providers: [{ provide: MetaPixelService, useValue: pixel }, provideRouter([])],
    }).compileComponents();
    fixture = TestBed.createComponent(FaqComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  afterEach(() => {
    // `ngOnDestroy` retire le JSON-LD ; le DOM de test reste propre entre specs.
    fixture.destroy();
  });

  it('déclare la FAQPage depuis les questions réellement affichées', () => {
    const tag = document.getElementById('ld-faq');
    expect(tag).not.toBeNull();

    const ld = JSON.parse(tag!.textContent ?? '{}');
    expect(ld['@type']).toBe('FAQPage');
    expect(ld.mainEntity.length).toBe(component.commonQuestions.length);
    expect(ld.mainEntity[0].name).toBe(component.commonQuestions[0].title);
    // Les <span> de style sont retirés, le texte de la réponse reste.
    expect(ld.mainEntity[0].acceptedAnswer.text).not.toContain('<span>');

    fixture.destroy();
    expect(document.getElementById('ld-faq')).toBeNull();
  });

  it('hiérarchie de titres valide : un H2 (bandeau), un H3 (sous-bloc) — pas de saut', () => {
    const host = fixture.nativeElement as HTMLElement;

    const h2 = host.querySelectorAll('h2');
    expect(h2.length).toBe(1);
    expect(h2[0].textContent).toContain('FOIRE AUX QUESTIONS');

    // « Questions fréquentes » reste un H3 : il a désormais un H2 parent,
    // c'est une sous-section — plus un saut de niveau.
    const h3 = host.querySelectorAll('h3');
    expect(h3.length).toBe(1);
    expect(h3[0].textContent).toContain('Questions fréquentes');
    // Et le doublon décoratif du bandeau est bien hors de l'arborescence.
    expect(host.querySelector('.banner-header-secondary h2, .banner-header-secondary h3')).toBeNull();
  });

  it('should create with no selected question', () => {
    expect(component).toBeTruthy();
    expect(component.selectedQ()).toBeNull();
  });

  it('should expose left & right question lists', () => {
    expect(component.leftQuestions.length).toBeGreaterThan(0);
    expect(component.rightQuestions.length).toBeGreaterThan(0);
  });

  it('changeSelectedQ should toggle the question id', () => {
    component.changeSelectedQ(2);
    expect(component.selectedQ()).toBe(2);
    component.changeSelectedQ(2);
    expect(component.selectedQ()).toBeNull();
    component.changeSelectedQ(3);
    expect(component.selectedQ()).toBe(3);
  });

  it('onAnswerLinkClick should fire VideoPlay when YouTube link matched', () => {
    const link = document.createElement('a');
    link.setAttribute(
      'href',
      'https://www.youtube.com/watch?v=GIayqf7tRGk'
    );
    const target = document.createElement('span');
    link.appendChild(target);

    const event = { target } as unknown as MouseEvent;
    component.onAnswerLinkClick(event);

    expect(pixel.trackCustomEvent).toHaveBeenCalledWith('VideoPlay', {
      content_name: 'facturation_collaborative_explainer',
      content_id: 'GIayqf7tRGk',
    });
  });

  it('onAnswerLinkClick should ignore clicks outside any <a>', () => {
    const target = document.createElement('span');
    const event = { target } as unknown as MouseEvent;
    component.onAnswerLinkClick(event);
    expect(pixel.trackCustomEvent).not.toHaveBeenCalled();
  });

  it('onAnswerLinkClick should ignore unmatched links', () => {
    const link = document.createElement('a');
    link.setAttribute('href', 'https://example.com');
    const event = { target: link } as unknown as MouseEvent;
    component.onAnswerLinkClick(event);
    expect(pixel.trackCustomEvent).not.toHaveBeenCalled();
  });
});
