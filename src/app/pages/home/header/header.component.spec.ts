import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';

import { HeaderComponent } from './header.component';
import { MetaPixelService } from '../../../services/meta-pixel.service';

describe('HeaderComponent', () => {
  let fixture: ComponentFixture<HeaderComponent>;
  let component: HeaderComponent;
  let router: Router;
  let pixel: jasmine.SpyObj<MetaPixelService>;

  beforeEach(async () => {
    pixel = jasmine.createSpyObj<MetaPixelService>('MetaPixelService', [
      'trackLeadCTA',
    ]);
    await TestBed.configureTestingModule({
      imports: [HeaderComponent],
      providers: [
        provideRouter([]),
        { provide: MetaPixelService, useValue: pixel },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(HeaderComponent);
    component = fixture.componentInstance;
    router = TestBed.inject(Router);
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  // Le CTA "je commence gratuitement" est désormais une ancre : il appelle
  // LandingNavService.scrollToOffers('header') depuis le template (testé dans
  // landing-nav.service.spec). Plus de méthode goToFunnel sur le composant.
});
