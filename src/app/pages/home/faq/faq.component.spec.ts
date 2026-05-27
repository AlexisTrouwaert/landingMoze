import { ComponentFixture, TestBed } from '@angular/core/testing';

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
      providers: [{ provide: MetaPixelService, useValue: pixel }],
    }).compileComponents();
    fixture = TestBed.createComponent(FaqComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
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
