import { Injectable, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class ContactPanelService {
  readonly isOpen = signal(false);

  open(): void {
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
    document.body.style.paddingRight = `${scrollbarWidth}px`;
    document.body.style.overflow = 'hidden';
    this.isOpen.set(true);
  }

  close(): void {
    this.isOpen.set(false);
    document.body.style.overflow = '';
    document.body.style.paddingRight = '';
  }
}
