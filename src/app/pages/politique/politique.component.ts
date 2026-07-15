import { afterNextRender, ChangeDetectionStrategy, Component, ElementRef, inject, OnDestroy, OnInit, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Meta } from '@angular/platform-browser';
import { FloatingDockComponent } from '../../components/floating-dock/floating-dock.component';
import { CookieConsentService } from '../../services/cookie-consent.service';

interface TocItem { id: string; num: string; label: string; }

@Component({
    selector: 'app-politique',
    imports: [FloatingDockComponent],
    templateUrl: './politique.component.html',
    styleUrl: './politique.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class PolitiqueComponent implements OnInit, OnDestroy {
  private readonly router = inject(Router);
  private readonly meta = inject(Meta);
  private readonly host: ElementRef<HTMLElement> = inject(ElementRef);
  private readonly cookieConsent = inject(CookieConsentService);

  /** Sommaire généré automatiquement à partir des titres <h2> du contenu. */
  readonly toc = signal<TocItem[]>([]);
  /** Section visible (scroll-spy) → surlignée dans le sommaire. */
  readonly activeId = signal<string>('');
  /** Sommaire déplié (mobile uniquement). */
  readonly tocOpen = signal<boolean>(false);

  private headings: HTMLElement[] = [];
  private tocNav: HTMLElement | null = null;
  private rafId = 0;

  /** Un titre devient « actif » dès qu'il passe au-dessus de cette ligne (px depuis le haut). */
  private static readonly ACTIVE_OFFSET = 140;

  constructor() {
    afterNextRender(() => this.setupToc());
  }

  ngOnInit(): void {
    this.meta.updateTag({
      name: 'description',
      content: 'Politique de confidentialité de Moze : données collectées, usage et droits des utilisateurs.'
    });
  }

  ngOnDestroy(): void {
    if (typeof window !== 'undefined') window.removeEventListener('scroll', this.onScroll);
    if (this.rafId) cancelAnimationFrame(this.rafId);
  }

  goHome(): void { this.router.navigate(['/']); }

  /** Rouvre le bandeau de préférences cookies. */
  manageCookies(): void { this.cookieConsent.reset(); }

  toggleToc(): void { this.tocOpen.update(v => !v); }

  navigate(event: Event, id: string): void {
    event.preventDefault();
    this.tocOpen.set(false);
    const el = document.getElementById(id);
    if (!el) return;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    el.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
    if (typeof history !== 'undefined') history.replaceState(null, '', '#' + id);
  }

  private setupToc(): void {
    const root = this.host.nativeElement;
    this.headings = Array.from(root.querySelectorAll<HTMLHeadingElement>('.legal-doc h2'));
    if (!this.headings.length) return;

    const entries: TocItem[] = [];
    for (const h of this.headings) {
      const raw = (h.textContent ?? '').trim();
      const m = raw.match(/^(\d+)\.\s*(.+)$/s);
      const num = m ? m[1] : '';
      const label = m ? m[2].trim() : raw;
      const id = num ? `conf-${num}` : this.slug(label);
      h.id = id;

      if (m) {
        const badge = document.createElement('span');
        badge.className = 'sec-n';
        badge.textContent = num;
        const title = document.createElement('span');
        title.className = 'sec-t';
        title.textContent = label;
        h.replaceChildren(badge, title);
      }

      entries.push({ id, num, label });
    }
    this.toc.set(entries);
    this.tocNav = root.querySelector<HTMLElement>('.toc-nav');

    window.addEventListener('scroll', this.onScroll, { passive: true });
    this.updateActive();

    const hash = (typeof location !== 'undefined' ? location.hash : '').replace('#', '');
    if (hash && entries.some(e => e.id === hash)) {
      setTimeout(() => document.getElementById(hash)?.scrollIntoView({ block: 'start' }), 60);
    }
  }

  private readonly onScroll = (): void => {
    if (this.rafId) return;
    this.rafId = requestAnimationFrame(() => { this.rafId = 0; this.updateActive(); });
  };

  private updateActive(): void {
    if (!this.headings.length) return;

    let current: HTMLElement;
    // Bas de page atteint : les derniers titres ne peuvent pas toujours remonter
    // jusqu'à la ligne → on force la dernière section (le sommaire va jusqu'au bout).
    if (window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 2) {
      current = this.headings[this.headings.length - 1];
    } else {
      const line = PolitiqueComponent.ACTIVE_OFFSET;
      current = this.headings[0];
      for (const h of this.headings) {
        if (h.getBoundingClientRect().top - line <= 0) current = h;
        else break;
      }
    }

    const id = current.id;
    if (id && id !== this.activeId()) {
      this.activeId.set(id);
      this.scrollTocToActive(id);
    }
  }

  private scrollTocToActive(id: string): void {
    const nav = this.tocNav;
    if (!nav) return;
    const link = nav.querySelector<HTMLElement>(`[data-toc="${CSS.escape(id)}"]`);
    if (!link) return;
    const navRect = nav.getBoundingClientRect();
    const linkRect = link.getBoundingClientRect();
    if (linkRect.top >= navRect.top && linkRect.bottom <= navRect.bottom) return;
    const delta = (linkRect.top - navRect.top) - (nav.clientHeight - link.clientHeight) / 2;
    nav.scrollTo({ top: nav.scrollTop + delta, behavior: 'smooth' });
  }

  private slug(s: string): string {
    return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  }
}
