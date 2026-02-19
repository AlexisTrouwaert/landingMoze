import {Component, inject} from '@angular/core';
import {Router} from "@angular/router";

@Component({
  selector: 'app-tarif',
  standalone: true,
  imports: [],
  templateUrl: './tarif.component.html',
  styleUrl: './tarif.component.scss'
})
export class TarifComponent {

  private router = inject(Router);

  redirect() {
    this.router.navigate(['/commencer']);
  }
}
