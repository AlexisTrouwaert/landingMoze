import {Component, inject, OnInit} from '@angular/core';
import {ScreenSizeService} from "../../../services/screen-size.service";

@Component({
  selector: 'app-landing-section',
  standalone: true,
  imports: [],
  templateUrl: './landing-section.component.html',
  styleUrl: './landing-section.component.scss'
})
export class LandingSectionComponent implements OnInit {

  private screenSizeService = inject(ScreenSizeService)

  screenSize!: number;

  ngOnInit() {
    this.screenSizeService.screenSize$.subscribe(size => {
      this.screenSize = size;
    });
  }

}
