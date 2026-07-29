import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { FloatingDockComponent } from '../../components/floating-dock/floating-dock.component';

/**
 * Page servie pour une URL inconnue.
 *
 * Remplace le `redirectTo: ''` qui renvoyait toute adresse inconnue vers l'accueil : côté
 * serveur, Angular traduisait ce `redirectTo` en **302**, et la Search Console comptabilisait
 * autant de « pages avec redirection ». Une redirection dit « ce contenu a déménagé ici » ;
 * pour une URL qui n'a jamais existé, c'est faux, et le lecteur se retrouvait sur l'accueil sans
 * comprendre pourquoi.
 *
 * Le statut 404 lui-même est posé par la route serveur (cf. `app.routes.server.ts`) : un
 * composant ne choisit pas le code HTTP de sa réponse.
 */
@Component({
  selector: 'app-not-found',
  imports: [RouterLink, FloatingDockComponent],
  templateUrl: './not-found.component.html',
  styleUrl: './not-found.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NotFoundComponent {
  private readonly router = inject(Router);

  goHome(): void {
    void this.router.navigate(['/']);
  }
}
