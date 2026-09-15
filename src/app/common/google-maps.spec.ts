import { FormControl } from '@angular/forms';
import { googleMapsUrlValidator, isGoogleMapsUrl } from './google-maps';

/** Mêmes cas que `google-maps.spec.ts` du back : les deux copies doivent trancher pareil. */
describe('isGoogleMapsUrl', () => {
  const ACCEPTED = [
    'https://maps.app.goo.gl/AbCdEf123',
    'https://www.google.com/maps/place/Tour+Eiffel/@48.858,2.294,17z',
    'https://www.google.fr/maps/place/Lyon',
    'https://google.com/maps?q=48.85,2.29',
    'https://www.google.co.uk/maps/dir/Paris/Lyon',
    'https://maps.google.com/?q=Paris',
    'https://goo.gl/maps/xyz',
  ];

  const REFUSED = [
    'http://maps.app.goo.gl/AbCdEf123',
    'javascript:alert(1)',
    'https://www.google.com/search?q=maps',
    'https://www.google.com/mapsearch',
    'https://goo.gl/abc',
    'https://www.google.com.evil.example/maps',
    'https://google.fr.example.com/maps',
    'https://maps.apple.com/?q=Paris',
    'pas une adresse',
  ];

  for (const url of ACCEPTED) {
    it(`accepte ${url}`, () => expect(isGoogleMapsUrl(url)).toBeTrue());
  }

  for (const url of REFUSED) {
    it(`refuse ${url}`, () => expect(isGoogleMapsUrl(url)).toBeFalse());
  }

  it('le validateur laisse passer un champ vide (le lien est facultatif)', () => {
    expect(googleMapsUrlValidator(new FormControl('', { nonNullable: true }))).toBeNull();
  });

  it('le validateur signale un lien étranger', () => {
    expect(
      googleMapsUrlValidator(new FormControl('https://maps.apple.com/?q=Paris', { nonNullable: true })),
    ).toEqual({ googleMapsUrl: true });
  });
});
