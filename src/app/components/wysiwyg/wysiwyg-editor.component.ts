import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  forwardRef,
  signal,
  ViewChild,
} from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

/**
 * Éditeur WYSIWYG maison (sans librairie externe, cf. BLOG_DETAILLE §7).
 * `contentEditable` + barre d'outils, sortie = chaîne HTML.
 * S'intègre aux formulaires via `ControlValueAccessor` (formControlName).
 *
 * NB : l'insertion d'images/fichiers est volontairement désactivée pour l'instant ;
 * seuls les liens sont autorisés. `document.execCommand` est déprécié mais reste
 * fonctionnel sur les navigateurs actuels — choix assumé pour le MVP.
 */
@Component({
    selector: 'app-wysiwyg-editor',
    imports: [],
    templateUrl: './wysiwyg-editor.component.html',
    styleUrl: './wysiwyg-editor.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
    providers: [
        {
            provide: NG_VALUE_ACCESSOR,
            useExisting: forwardRef(() => WysiwygEditorComponent),
            multi: true,
        },
    ]
})
export class WysiwygEditorComponent
  implements ControlValueAccessor, AfterViewInit
{
  @ViewChild('editor') private editorRef?: ElementRef<HTMLDivElement>;

  readonly disabled = signal(false);

  private pendingValue = '';
  private onChange: (value: string) => void = () => {};
  onTouched: () => void = () => {};

  ngAfterViewInit(): void {
    if (this.editorRef) {
      this.editorRef.nativeElement.innerHTML = this.pendingValue;
    }
  }

  // --- ControlValueAccessor ---
  writeValue(value: string): void {
    this.pendingValue = value ?? '';
    if (this.editorRef) {
      this.editorRef.nativeElement.innerHTML = this.pendingValue;
    }
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

  // --- Édition ---
  onInput(): void {
    if (this.editorRef) this.onChange(this.editorRef.nativeElement.innerHTML);
  }

  onBlur(): void {
    this.onTouched();
  }

  /** Colle en texte brut pour éviter le HTML parasite (Word, images, etc.). */
  onPaste(event: ClipboardEvent): void {
    event.preventDefault();
    const text = event.clipboardData?.getData('text/plain') ?? '';
    document.execCommand('insertText', false, text);
    this.onInput();
  }

  exec(command: string, value?: string): void {
    if (this.disabled()) return;
    document.execCommand(command, false, value);
    this.editorRef?.nativeElement.focus();
    this.onInput();
  }

  formatBlock(tag: string): void {
    this.exec('formatBlock', tag);
  }

  addLink(): void {
    const url = prompt('URL du lien ?');
    if (url) this.exec('createLink', url);
  }
}
