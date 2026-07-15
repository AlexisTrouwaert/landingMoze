import {
  ChangeDetectionStrategy,
  Component,
  HostListener,
  effect,
  input,
  output,
  signal,
} from '@angular/core';

/**
 * Modale de saisie réutilisable (overlay + champ texte).
 * Pilotée par le parent via `open` ; émet `confirmed` (avec la valeur) / `cancelled`.
 */
@Component({
    selector: 'app-prompt-dialog',
    imports: [],
    templateUrl: './prompt-dialog.component.html',
    styleUrl: './prompt-dialog.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class PromptDialogComponent {
  readonly open = input(false);
  readonly title = input('');
  readonly label = input('');
  readonly initialValue = input('');
  readonly confirmLabel = input('Valider');
  readonly cancelLabel = input('Annuler');

  readonly confirmed = output<string>();
  readonly cancelled = output<void>();

  readonly value = signal('');

  constructor() {
    // À l'ouverture, pré-remplit le champ avec la valeur initiale.
    // allowSignalWrites : on écrit dans un signal depuis l'effect (requis en Angular 18).
    effect(
      () => {
        if (this.open()) this.value.set(this.initialValue());
      },
      { allowSignalWrites: true },
    );
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.open()) this.cancelled.emit();
  }

  onInput(event: Event): void {
    this.value.set((event.target as HTMLInputElement).value);
  }

  onConfirm(): void {
    const v = this.value().trim();
    if (v) this.confirmed.emit(v);
  }

  onCancel(): void {
    this.cancelled.emit();
  }
}
