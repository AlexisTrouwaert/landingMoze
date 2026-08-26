import { PersistentCircuitBreaker } from './circuit-breaker';

/**
 * Ce disjoncteur existe pour une raison précise : une route en panne produisait une rafale
 * d'erreurs identiques depuis la même IP, qu'un pare-feu applicatif lit comme un scan et
 * sanctionne en bannissant le lecteur. Un compteur en mémoire ne suffisait pas — il repart à zéro
 * à chaque rechargement, et chaque onglet relance le quota pour son compte.
 */
describe('PersistentCircuitBreaker', () => {
  const KEY = 'test-breaker';
  const make = (max = 2, cooldown = 60_000) =>
    new PersistentCircuitBreaker(KEY, max, cooldown);

  beforeEach(() => localStorage.removeItem(KEY));
  afterEach(() => localStorage.removeItem(KEY));

  it('reste passant tant que le quota d’échecs n’est pas atteint', () => {
    const breaker = make(2);

    expect(breaker.isOpen()).toBeFalse();
    breaker.recordFailure();
    expect(breaker.isOpen()).toBeFalse();
  });

  it('coupe une fois le quota atteint', () => {
    const breaker = make(2);

    breaker.recordFailure();
    breaker.recordFailure();

    expect(breaker.isOpen()).toBeTrue();
  });

  it('un succès remet le compteur à zéro et lève la coupure', () => {
    const breaker = make(2);
    breaker.recordFailure();
    breaker.recordFailure();
    expect(breaker.isOpen()).toBeTrue();

    breaker.recordSuccess();

    expect(breaker.isOpen()).toBeFalse();
    expect(localStorage.getItem(KEY)).toBeNull();
  });

  /** Le cœur du correctif : la coupure survit au rechargement et vaut pour tous les onglets. */
  it('la coupure est partagée : une instance neuve la voit', () => {
    const premier = make(2);
    premier.recordFailure();
    premier.recordFailure();

    // Une autre instance = un autre onglet, ou la même page rechargée.
    const second = make(2);
    expect(second.isOpen()).toBeTrue();
  });

  it('se réarme une fois le délai de repos écoulé', () => {
    // Coupure déjà expirée, écrite directement pour ne pas dépendre de l'horloge.
    localStorage.setItem(KEY, String(Date.now() - 1));

    expect(make(2).isOpen()).toBeFalse();
    // Et l'entrée périmée est nettoyée au passage.
    expect(localStorage.getItem(KEY)).toBeNull();
  });

  it('une valeur illisible en stockage ne bloque rien', () => {
    localStorage.setItem(KEY, 'nawak');

    expect(make(2).isOpen()).toBeFalse();
  });
});
