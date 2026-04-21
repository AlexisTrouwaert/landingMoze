import {Component, inject, OnDestroy, OnInit} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { HeaderComponent } from "./header/header.component";
import { LandingSectionComponent } from "./landing-section/landing-section.component";
import { TarifComponent } from "./tarif/tarif.component";
import { ScreenSizeService } from "../../services/screen-size.service";
import { ToolComponent } from "./tool/tool.component";
import { FaqComponent } from "./faq/faq.component";
import { EmailComponent } from "./email/email.component";
import { FooterComponent } from "./footer/footer.component";
import { PlatformDiscoveryComponent } from "./platform-discovery/platform-discovery.component";
import { CustomerReviewsComponent } from "./customer-reviews/customer-reviews.component";
import { MetaPixelService } from "../../services/meta-pixel.service";
import {ActivityStepsComponent} from "./activity-steps/activity-steps.component";
import {DownloadAppsComponent} from "./download-apps/download-apps.component";

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [
    HeaderComponent,
    LandingSectionComponent,
    TarifComponent,
    ToolComponent,
    FaqComponent,
    EmailComponent,
    FooterComponent,
    PlatformDiscoveryComponent,
    CustomerReviewsComponent,
    ActivityStepsComponent,
    DownloadAppsComponent
  ],
  templateUrl: './home.component.html',
  styleUrl: './home.component.scss'
})
export class HomeComponent implements OnInit, OnDestroy {

  private readonly screenSizeService = inject(ScreenSizeService);
  private readonly metaPixelService = inject(MetaPixelService);

  public screenSize = toSignal(this.screenSizeService.screenSize$, { initialValue: 1200 });

  ngOnInit(): void {
    this.metaPixelService.trackViewContent();
  }

  ngOnDestroy(): void {
    this.metaPixelService.resetViewContent();
  }
}
