import { ChangeDetectionStrategy, Component, inject, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { Meta } from '@angular/platform-browser';
import { FloatingDockComponent } from '../../components/floating-dock/floating-dock.component';

@Component({
  selector: 'app-mention',
  standalone: true,
  imports: [FloatingDockComponent],
  templateUrl: './mention.component.html',
  styleUrl: './mention.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class MentionComponent implements OnInit {
  private readonly router = inject(Router);
  private readonly meta = inject(Meta);

  ngOnInit(): void {
    this.meta.updateTag({
      name: 'description',
      content: 'Mentions légales de Moze : éditeur, hébergeur et responsable de publication.'
    });
  }

  goHome(): void { this.router.navigate(['/']); }
}
