import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { LandingNavService } from '../../../services/landing-nav.service';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [],
  templateUrl: './header.component.html',
  styleUrl: './header.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class HeaderComponent {
  readonly nav = inject(LandingNavService);
}
