import {AfterViewInit, ChangeDetectionStrategy, Component, inject, OnDestroy, OnInit} from '@angular/core';
import {toSignal} from '@angular/core/rxjs-interop';
import {Router} from "@angular/router";
import {DockGroup, FloatingDockComponent} from "../../components/floating-dock/floating-dock.component";
import {ScrollTopComponent} from "../../components/scroll-top/scroll-top.component";
import {LandingSectionComponent} from "./landing-section/landing-section.component";
import {TarifComponent} from "./tarif/tarif.component";
import {ScreenSizeService} from "../../services/screen-size.service";
import {ToolComponent} from "./tool/tool.component";
import {FaqComponent} from "./faq/faq.component";
import {EmailComponent} from "./email/email.component";
import {FooterComponent} from "./footer/footer.component";
import {CustomerReviewsComponent} from "./customer-reviews/customer-reviews.component";
import {MetaPixelService} from "../../services/meta-pixel.service";
import {ActivityStepsComponent} from "./activity-steps/activity-steps.component";
import {DownloadAppsComponent} from "./download-apps/download-apps.component";
import {MediaPressComponent} from "./media-press/media-press.component";
import {FollowUsComponent} from "./follow-us/follow-us.component";

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [
    FloatingDockComponent,
    ScrollTopComponent,
    LandingSectionComponent,
    TarifComponent,
    ToolComponent,
    FaqComponent,
    EmailComponent,
    FooterComponent,
    CustomerReviewsComponent,
    ActivityStepsComponent,
    DownloadAppsComponent,
    MediaPressComponent,
    FollowUsComponent
  ],
  templateUrl: './home.component.html',
  styleUrl: './home.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class HomeComponent implements OnInit, AfterViewInit, OnDestroy {

  private readonly screenSizeService = inject(ScreenSizeService);
  private readonly metaPixelService  = inject(MetaPixelService);
  private readonly router            = inject(Router);

  public screenSize = toSignal(this.screenSizeService.screenSize$, { initialValue: 1200 });

  /** Navigation du dock. Les `id` correspondent aux ancres des sections. */
  readonly navGroups: DockGroup[] = [
    { title: 'Découvrir', links: [
      { id: 'etapes', label: 'Étapes', icon: 'steps', desc: 'Comment ça marche' },
      { id: 'outils', label: 'Outils', icon: 'tools', desc: 'Tout ce que Moze offre' },
      { id: 'offres', label: 'Offres', icon: 'offres', desc: 'Nos formules' },
      { id: 'presse', label: 'Presse', icon: 'news',  desc: 'On parle de nous' },
      { id: 'avis',   label: 'Avis',   icon: 'star',  desc: 'La parole aux membres' }
    ]},
    { links: [
      { id: 'faq', label: 'FAQ' },
      { id: 'app', label: "L'app" }
    ]}
  ];

  /** CTA du dock — conserve le comportement de l'ancien header (inscription → tunnel). */
  goToFunnel(): void {
    this.metaPixelService.trackLeadCTA('inscription_generic');
    this.router.navigate(['/commencer']);
  }

  /* === Tracking curseur → spotlight localisé sur chaque grid-patch === */
  private patches: HTMLElement[]      = [];
  private mutationObserver: MutationObserver | null = null;
  private rafId    = 0;
  private cursorX  = -9999;
  private cursorY  = -9999;

  private readonly onPointerMove = (e: PointerEvent): void => {
    this.cursorX = e.clientX;
    this.cursorY = e.clientY;
    this.scheduleUpdate();
  };

  private readonly onScroll = (): void => {
    /* Le scroll change la position des patches dans le viewport,
       donc on recalcule même sans mouvement souris. */
    this.scheduleUpdate();
  };

  private scheduleUpdate(): void {
    if (!this.rafId) this.rafId = requestAnimationFrame(() => this.updateProximity());
  }

  private updateProximity(): void {
    this.rafId = 0;

    for (const patch of this.patches) {
      const rect = patch.getBoundingClientRect();
      /* Coordonnées du curseur relatives au coin supérieur-gauche du patch */
      patch.style.setProperty('--patch-x', `${this.cursorX - rect.left}px`);
      patch.style.setProperty('--patch-y', `${this.cursorY - rect.top}px`);
    }
  }

  ngOnInit(): void {
    this.metaPixelService.trackViewContent();
  }

  ngAfterViewInit(): void {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    // Requête initiale + re-scan automatique quand les sections @defer(on idle)
    // injectent leurs patches dans le DOM
    const refreshPatches = () => {
      this.patches = Array.from(document.querySelectorAll<HTMLElement>('.grid-patch'));
    };

    refreshPatches();

    this.mutationObserver = new MutationObserver(refreshPatches);
    this.mutationObserver.observe(document.body, { childList: true, subtree: true });

    document.addEventListener('pointermove', this.onPointerMove, { passive: true });
    document.addEventListener('scroll',      this.onScroll,      { passive: true });
  }

  ngOnDestroy(): void {
    this.metaPixelService.resetViewContent();

    this.mutationObserver?.disconnect();
    document.removeEventListener('pointermove', this.onPointerMove);
    document.removeEventListener('scroll',      this.onScroll);
    if (this.rafId) cancelAnimationFrame(this.rafId);
  }
}
