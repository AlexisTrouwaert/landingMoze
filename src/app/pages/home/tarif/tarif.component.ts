import { Component } from '@angular/core';

@Component({
  selector: 'app-tarif',
  standalone: true,
  imports: [],
  templateUrl: './tarif.component.html',
  styleUrl: './tarif.component.scss'
})
export class TarifComponent {

  inscription: string = "https://app.mozeconnect.fr/connexion"

  redirect() {
    window.open(this.inscription, "_blank");
  }
}
