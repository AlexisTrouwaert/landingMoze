/**
 * Disjoncteur pour un appel réseau accessoire, **partagé entre les onglets et conservé d'un
 * rechargement à l'autre**.
 *
 * Un compteur en mémoire ne suffit pas : il repart de zéro à chaque chargement de page et vaut
 * pour un seul onglet. Quelqu'un qui ouvre cinq articles dans cinq onglets relance donc cinq fois
 * le quota d'échecs — et une route en panne produit à nouveau la rafale d'erreurs qu'un pare-feu
 * applicatif lit comme un scan, en bannissant l'adresse IP du lecteur.
 *
 * L'état vit dans `localStorage`, partagé par toutes les fenêtres de la même origine. La coupure
 * est **temporaire** : passé le délai de repos, une tentative est à nouveau autorisée, ce qui fait
 * repartir la fonctionnalité toute seule une fois le service rétabli — sans intervention du
 * visiteur, et sans le condamner définitivement sur une panne d'une minute.
 */
export class PersistentCircuitBreaker {
  /**
   * @param key identifiant de stockage, propre à l'appel protégé.
   * @param maxFailures échecs consécutifs tolérés avant la coupure.
   * @param cooldownMs durée de la coupure, avant d'autoriser une nouvelle tentative.
   */
  constructor(
    private readonly key: string,
    private readonly maxFailures: number,
    private readonly cooldownMs: number,
  ) {}

  /** Compteur du chargement courant : seule la coupure franchie est partagée. */
  private failures = 0;

  /**
   * Vrai tant que la coupure court. Relire le stockage à chaque appel (plutôt que mémoriser)
   * est ce qui rend l'état commun aux onglets ouverts simultanément.
   */
  isOpen(): boolean {
    const until = this.read();
    if (until === null) return false;

    if (Date.now() >= until) {
      // Délai écoulé : on réarme, la prochaine tentative dira si le service est revenu.
      this.clear();
      this.failures = 0;
      return false;
    }

    return true;
  }

  /** L'appel a abouti : le service répond, tout repart de zéro. */
  recordSuccess(): void {
    this.failures = 0;
    this.clear();
  }

  /** L'appel a échoué ; au-delà du quota, la coupure est posée pour tous les onglets. */
  recordFailure(): void {
    this.failures++;
    if (this.failures >= this.maxFailures) {
      this.write(Date.now() + this.cooldownMs);
    }
  }

  /**
   * Les accès au stockage sont tous protégés : `localStorage` n'existe pas pendant le rendu
   * serveur, et lève en navigation privée stricte. Un disjoncteur indisponible ne doit jamais
   * empêcher la page de fonctionner — au pire il ne protège pas, il ne casse rien.
   */
  private read(): number | null {
    try {
      const raw = localStorage.getItem(this.key);
      if (!raw) return null;
      const until = Number(raw);
      return Number.isFinite(until) ? until : null;
    } catch {
      return null;
    }
  }

  private write(until: number): void {
    try {
      localStorage.setItem(this.key, String(until));
    } catch {
      /* pas de stockage : on reste sur le compteur en mémoire */
    }
  }

  private clear(): void {
    try {
      localStorage.removeItem(this.key);
    } catch {
      /* idem */
    }
  }
}
