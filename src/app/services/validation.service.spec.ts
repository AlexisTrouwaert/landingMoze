import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';

import { ValidationService } from './validation.service';

describe('ValidationService', () => {
  let service: ValidationService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(ValidationService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should hit the expected URL with the email query param', () => {
    service.validateEmail('foo@bar.fr').subscribe();
    const req = httpMock.expectOne(
      'https://app.mozeconnect.fr/mozeapp/inscription/validate-email?email=foo@bar.fr'
    );
    expect(req.request.method).toBe('GET');
    req.flush({ emailExists: false });
  });

  it('should map emailExists:true to true', (done) => {
    service.validateEmail('exists@moze.fr').subscribe((result) => {
      expect(result).toBe(true);
      done();
    });
    const req = httpMock.expectOne((r) => r.url.includes('validate-email'));
    req.flush({ emailExists: true });
  });

  it('should map emailExists:false to false', (done) => {
    service.validateEmail('new@moze.fr').subscribe((result) => {
      expect(result).toBe(false);
      done();
    });
    const req = httpMock.expectOne((r) => r.url.includes('validate-email'));
    req.flush({ emailExists: false });
  });

  it('should propagate errors to the subscriber', (done) => {
    service.validateEmail('err@moze.fr').subscribe({
      next: () => done.fail('Expected error'),
      error: (err) => {
        expect(err.status).toBe(500);
        done();
      },
    });
    const req = httpMock.expectOne((r) => r.url.includes('validate-email'));
    req.flush('boom', { status: 500, statusText: 'Server Error' });
  });
});
