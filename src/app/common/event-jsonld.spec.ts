import { SiteEvent } from '../model/event.model';
import { eventJsonLd, jsonLdIneligibility } from './event-jsonld';

const PAGE = 'https://www.moze.fr/evenements/afterwork-travailler-a-plusieurs-2026-10-08';

/** L'afterwork du 8 octobre, tel que le décrit la spec (section 05). */
function afterwork(overrides: Partial<SiteEvent> = {}): SiteEvent {
  return {
    id: 'e1',
    slug: 'afterwork-travailler-a-plusieurs-2026-10-08',
    title: 'Travailler à plusieurs — L’afterwork des indépendants du Grand Avignon',
    type: 'afterwork',
    typeLabel: null,
    tagline: 'Une soirée pour rencontrer ceux avec qui tu factureras demain.',
    summary: '',
    content: '',
    coverImageUrl: null,
    coverImageAlt: null,
    startAt: '2026-10-08T16:30:00.000Z',
    endAt: '2026-10-08T21:00:00.000Z',
    previousStartAt: null,
    mode: 'presentiel',
    venueName: 'Le 9 — Living Lab d’Agroparc',
    street: 'Technopôle Agroparc, Rez-de-chaussée du bâtiment Technicité',
    postalCode: '84000',
    city: 'Avignon',
    region: 'Vaucluse',
    country: 'FR',
    accessInfo: null,
    wheelchairAccessible: true,
    mapUrl: null,
    roleMoze: 'organisateur',
    organizerName: 'MOZE',
    organizerUrl: 'https://moze.fr',
    organizerLogoUrl: null,
    organizerContact: null,
    access: 'sur-inscription',
    priceLabel: 'Entrée libre, sur inscription',
    priceCents: null,
    registrationUrl: 'https://www.billetweb.fr/afterwork',
    capacity: 90,
    registrationDeadline: null,
    registrationInfo: null,
    partners: [],
    status: 'PUBLISHED',
    statusReason: null,
    updatedAt: '2026-09-14T10:00:00.000Z',
    ...overrides,
  };
}

describe('eventJsonLd', () => {
  it('reproduit le balisage de la spec pour l’afterwork du 8 octobre', () => {
    const ld = eventJsonLd(afterwork(), PAGE, ['https://api/og/x.jpg']) as Record<string, any>;

    expect(ld['@type']).toBe('Event');
    expect(ld['startDate']).toBe('2026-10-08T18:30:00+02:00');
    expect(ld['endDate']).toBe('2026-10-08T23:00:00+02:00');
    expect(ld['eventStatus']).toBe('https://schema.org/EventScheduled');
    expect(ld['eventAttendanceMode']).toBe('https://schema.org/OfflineEventAttendanceMode');
    expect(ld['location'].address).toEqual({
      '@type': 'PostalAddress',
      streetAddress: 'Technopôle Agroparc, Rez-de-chaussée du bâtiment Technicité',
      postalCode: '84000',
      addressLocality: 'Avignon',
      addressRegion: 'Vaucluse',
      addressCountry: 'FR',
    });
    expect(ld['organizer']).toEqual({ '@type': 'Organization', name: 'MOZE', url: 'https://moze.fr' });
    expect(ld['offers']).toEqual({
      '@type': 'Offer',
      price: 0,
      priceCurrency: 'EUR',
      availability: 'https://schema.org/InStock',
      url: 'https://www.billetweb.fr/afterwork',
    });
  });

  it('l’heure d’hiver porte +01:00', () => {
    const ld = eventJsonLd(afterwork({ startAt: '2026-12-10T17:30:00.000Z' }), PAGE, []);
    expect(ld?.['startDate']).toBe('2026-12-10T18:30:00+01:00');
  });

  it('suit le cycle de vie : complet, reporté, annulé', () => {
    expect((eventJsonLd(afterwork({ status: 'FULL' }), PAGE, []) as any).offers.availability).toBe(
      'https://schema.org/SoldOut',
    );

    const reporte = eventJsonLd(
      afterwork({ status: 'POSTPONED', previousStartAt: '2026-09-24T16:30:00.000Z' }),
      PAGE,
      [],
    );
    expect(reporte?.['eventStatus']).toBe('https://schema.org/EventPostponed');
    expect(reporte?.['previousStartDate']).toBe('2026-09-24T18:30:00+02:00');

    expect(eventJsonLd(afterwork({ status: 'CANCELLED' }), PAGE, [])?.['eventStatus']).toBe(
      'https://schema.org/EventCancelled',
    );
  });

  it('les trois cas de non-éligibilité ne produisent aucun balisage', () => {
    expect(eventJsonLd(afterwork({ access: 'sur-invitation' }), PAGE, [])).toBeNull();
    expect(eventJsonLd(afterwork({ mode: 'en-ligne' }), PAGE, [])).toBeNull();
    expect(eventJsonLd(afterwork({ street: null }), PAGE, [])).toBeNull();
    expect(jsonLdIneligibility(afterwork({ street: '' }))).toBe('sans adresse postale');
  });

  it('hybride : participation mixte', () => {
    expect(eventJsonLd(afterwork({ mode: 'hybride' }), PAGE, [])?.['eventAttendanceMode']).toBe(
      'https://schema.org/MixedEventAttendanceMode',
    );
  });

  it('payant : le prix en euros ; sans prix connu, pas de prix inventé', () => {
    expect((eventJsonLd(afterwork({ access: 'payant', priceCents: 1250 }), PAGE, []) as any).offers.price).toBe(12.5);
    const sansPrix = eventJsonLd(afterwork({ access: 'payant', priceCents: null }), PAGE, []) as any;
    expect(sansPrix.offers.price).toBeUndefined();
    expect(sansPrix.offers.priceCurrency).toBeUndefined();
  });

  it('co-organisé : les deux marques ; intervenants en performer', () => {
    const ld = eventJsonLd(
      afterwork({
        roleMoze: 'co-organisateur',
        organizerName: 'Créativa',
        organizerUrl: 'https://creativa.fr',
        partners: [
          { role: 'intervenant', name: 'Camille Martin', url: null, logoUrl: null, description: null },
          { role: 'lieu-accueil', name: 'Le 9', url: null, logoUrl: null, description: null },
        ],
      }),
      PAGE,
      [],
    ) as any;
    expect(ld.organizer.map((o: any) => o.name)).toEqual(['Créativa', 'Moze']);
    expect(ld.performer).toEqual([{ '@type': 'Person', name: 'Camille Martin' }]);
  });
});
