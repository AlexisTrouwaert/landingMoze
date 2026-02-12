import {Component, inject, OnInit} from '@angular/core';
import {HeaderComponent} from "./header/header.component";
import {LandingSectionComponent} from "./landing-section/landing-section.component";
import {TarifComponent} from "./tarif/tarif.component";
import {ScreenSizeService} from "../../services/screen-size.service";
import {ToolComponent} from "./tool/tool.component";
import {FaqComponent} from "./faq/faq.component";
import {EmailComponent} from "./email/email.component";
import {FooterComponent} from "./footer/footer.component";

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
    FooterComponent
  ],
  templateUrl: './home.component.html',
  styleUrl: './home.component.scss'
})
export class HomeComponent implements OnInit {

  private screenSizeService = inject(ScreenSizeService)

  screenSize!: number;

  ngOnInit() {
    this.screenSizeService.screenSize$.subscribe(size => {
      this.screenSize = size;
    });
  }

}
