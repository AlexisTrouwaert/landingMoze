import {
  ChangeDetectionStrategy,
  Component,
  forwardRef,
  input,
  signal,
} from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

/**
 * Champ mot de passe avec bouton « œil » pour afficher/masquer la saisie.
 * S'utilise comme un input dans un formulaire réactif (`formControlName`).
 */
@Component({
    selector: 'app-password-input',
    imports: [],
    templateUrl: './password-input.component.html',
    styleUrl: './password-input.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
    providers: [
        {
            provide: NG_VALUE_ACCESSOR,
            useExisting: forwardRef(() => PasswordInputComponent),
            multi: true,
        },
    ]
})
export class PasswordInputComponent implements ControlValueAccessor {
  readonly placeholder = input('');
  readonly autocomplete = input('');

  readonly value = signal('');
  readonly visible = signal(false);
  readonly disabled = signal(false);

  private onChange: (value: string) => void = () => {};
  onTouched: () => void = () => {};

  toggle(): void {
    this.visible.update((v) => !v);
  }

  onInput(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.value.set(value);
    this.onChange(value);
  }

  // --- ControlValueAccessor ---
  writeValue(value: string): void {
    this.value.set(value ?? '');
  }
  registerOnChange(fn: (value: string) => void): void {
    this.onChange = fn;
  }
  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }
  setDisabledState(isDisabled: boolean): void {
    this.disabled.set(isDisabled);
  }
}
