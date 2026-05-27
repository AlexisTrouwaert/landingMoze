import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CgvComponent } from './cgv.component';

describe('CgvComponent', () => {
  let component: CgvComponent;
  let fixture: ComponentFixture<CgvComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CgvComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(CgvComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should render CGV content (non-empty template)', () => {
    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent?.trim().length).toBeGreaterThan(0);
  });
});
