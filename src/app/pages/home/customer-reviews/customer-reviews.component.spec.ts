import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CustomerReviewsComponent } from './customer-reviews.component';

describe('CustomerReviewsComponent', () => {
  let fixture: ComponentFixture<CustomerReviewsComponent>;
  let component: CustomerReviewsComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CustomerReviewsComponent],
    }).compileComponents();
    fixture = TestBed.createComponent(CustomerReviewsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('starsArray should be exactly [1..5]', () => {
    expect(component.starsArray).toEqual([1, 2, 3, 4, 5]);
  });

  it('should expose three reviews with all fields populated', () => {
    const reviews = component.reviews();
    expect(reviews.length).toBe(3);
    reviews.forEach((r) => {
      expect(r.name).toBeTruthy();
      expect(r.avis).toBeTruthy();
      expect(r.rating).toBe(5);
      expect(r.image).toMatch(/\.webp$/);
    });
  });
});
