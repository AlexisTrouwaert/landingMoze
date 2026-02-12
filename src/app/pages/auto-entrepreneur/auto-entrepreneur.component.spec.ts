import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AutoEntrepreneurComponent } from './auto-entrepreneur.component';

describe('AutoEntrepreneurComponent', () => {
  let component: AutoEntrepreneurComponent;
  let fixture: ComponentFixture<AutoEntrepreneurComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AutoEntrepreneurComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(AutoEntrepreneurComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
