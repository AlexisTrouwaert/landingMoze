import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { MetaPixelService } from '../../../services/meta-pixel.service';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [],
  templateUrl: './header.component.html',
  styleUrl: './header.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class HeaderComponent {
  private router = inject(Router);
  private readonly metaPixel = inject(MetaPixelService);

  goToFunnel() {
    this.metaPixel.trackLeadCTA('inscription_generic');
    this.router.navigate(['/commencer']);
  }
}
