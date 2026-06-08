import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FollowUsComponent } from './follow-us.component';

describe('FollowUsComponent', () => {
  let fixture: ComponentFixture<FollowUsComponent>;
  let component: FollowUsComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FollowUsComponent]
    }).compileComponents();
    fixture = TestBed.createComponent(FollowUsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('expose exactement 3 réseaux (LinkedIn, Facebook, Instagram)', () => {
    expect(component.socials.length).toBe(3);
    const names = component.socials.map(s => s.name);
    expect(names).toEqual(jasmine.arrayContaining(['LinkedIn', 'Facebook', 'Instagram']));
  });

  it('chaque social a une URL Moze valide', () => {
    for (const s of component.socials) {
      expect(s.url).toMatch(/^https:\/\/(www\.)?(linkedin|facebook|instagram)\.com\/(company\/)?mozeconnect\/?$/);
    }
  });

  it('chaque social a un path SVG non vide', () => {
    for (const s of component.socials) {
      expect(s.path.length).toBeGreaterThan(100);
    }
  });

  it('rend un lien <a> par réseau avec attributs de sécurité', () => {
    const links = fixture.nativeElement.querySelectorAll('a.social-link');
    expect(links.length).toBe(3);
    links.forEach((link: HTMLAnchorElement) => {
      expect(link.target).toBe('_blank');
      expect(link.rel).toContain('noopener');
      expect(link.rel).toContain('noreferrer');
      expect(link.getAttribute('aria-label')).toBeTruthy();
    });
  });
});
