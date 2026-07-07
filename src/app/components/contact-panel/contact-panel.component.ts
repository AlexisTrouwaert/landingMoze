import {
  ChangeDetectionStrategy,
  Component,
  HostListener,
  inject,
  signal
} from '@angular/core';
import { ContactPanelService } from '../../services/contact-panel.service';

@Component({
    selector: 'app-contact-panel',
    imports: [],
    templateUrl: './contact-panel.component.html',
    styleUrl: './contact-panel.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class ContactPanelComponent {
  panel = inject(ContactPanelService);

  emailCopied = signal(false);

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.panel.isOpen()) this.panel.close();
  }

  copyEmail(): void {
    navigator.clipboard.writeText('support@moze.fr').then(() => {
      this.emailCopied.set(true);
      setTimeout(() => this.emailCopied.set(false), 2000);
    });
  }
}
