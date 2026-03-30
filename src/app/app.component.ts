import {Component, inject} from '@angular/core';
import { RouterOutlet } from '@angular/router';
import {SeoService} from "./services/seo.service";

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss'
})
export class AppComponent {
  title = 'landing';

  private readonly seoService = inject(SeoService);
}
