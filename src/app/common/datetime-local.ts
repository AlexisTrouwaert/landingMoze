/**
 * Conversions autour d'`<input type="datetime-local">`.
 *
 * Partagé par l'éditeur et le pupitre de relecture : les deux manipulent une échéance de
 * parution, et l'erreur de fuseau se paie de la même façon des deux côtés.
 */

/**
 * Une `Date` au format d'un `<input type="datetime-local">` : heure **locale**, sans fuseau.
 *
 * `toISOString()` ne convient pas — il bascule en UTC, et « demain 8 h » s'afficherait 6 h.
 */
export function toDatetimeLocal(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/**
 * L'inverse : la valeur d'un `datetime-local` en `Date`, ou `null` si elle est vide ou
 * invalide. `new Date('2026-09-14T08:00')` interprète bien l'heure comme locale — c'est le
 * format sans fuseau qui le garantit.
 */
export function fromDatetimeLocal(value: string): Date | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}
