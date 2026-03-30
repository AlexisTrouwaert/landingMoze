import { Component, signal } from '@angular/core';

interface Review {
  text: string;
  author: string;
  avatar: string;
}

@Component({
  selector: 'app-customer-reviews',
  standalone: true,
  imports: [],
  templateUrl: './customer-reviews.component.html',
  styleUrl: './customer-reviews.component.scss'
})
export class CustomerReviewsComponent {

  public reviews = signal<Review[]>([
    {
      avatar: '/assets/images/11.png',
      text: "L'appli est top, j'augmente tous les mois mes revenus grâce à l'apport d'affaires en direct sur la plateforme, c'est super pour développer son business.",
      author: 'Jérôme - commercial'
    },
    {
      avatar: '/assets/images/14.png',
      text: "Expérience au top, enfin une appli où on peut facturer à plusieurs !!",
      author: 'Samuel - artisan BTP'
    },
    {
      avatar: '/assets/images/13.png',
      text: "Moze est hyper intuitif, tout est centralisé, et surtout ça évolue avec ma manière de travailler. Mention spéciale pour la facturation collaborative, indispensable dans mon métier.",
      author: 'Lina - architecte'
    },
    {
      avatar: '/assets/images/12.png',
      text: "Je suis dans le service à la personne, et la partie crédit d'impôt immédiat avec Moze Coop m'a clairement simplifié la vie. En plus l'outil est simple d'utilisation.",
      author: 'Sarah - aide à domicile'
    }
  ]);

}
