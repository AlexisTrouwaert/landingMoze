import {Component, inject} from '@angular/core';
import {Router} from "@angular/router";

@Component({
  selector: 'app-footer',
  standalone: true,
  imports: [],
  templateUrl: './footer.component.html',
  styleUrl: './footer.component.scss'
})
export class FooterComponent {

  private router = inject(Router);

  cgv(){
    this.router.navigate(['/cgv-cgu']);
  }

  confidentialite(){
    this.router.navigate(['/politique-confidentialite']);
  }

  mention(){
    this.router.navigate(['/mentions-legales']);
  }

  auto(){
    window.open('https://www.autoentrepreneur.urssaf.fr/portail/accueil/sinformer-sur-le-statut/lessentiel-du-statut.html', '_blank');
  }
}
