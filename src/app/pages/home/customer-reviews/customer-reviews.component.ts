import { Component, signal } from '@angular/core';

@Component({
  selector: 'app-customer-reviews',
  standalone: true,
  imports: [],
  templateUrl: './customer-reviews.component.html',
  styleUrl: './customer-reviews.component.scss'
})
export class CustomerReviewsComponent {

  public starsArray = [1, 2, 3, 4, 5];

  public reviews = signal([
    {
      name: 'Anthony',
      avis: "Mon chiffre d'affaire a augmenté de 50% en 3 mois",
      rating: 5,
      image: '/assets/images/anthony.jpg'
    },
    {
      name: 'Fanny',
      avis: "Je ne me sens plus seule, je peux poser toutes mes questions à la communauté",
      rating: 4,
      image: '/assets/images/fanny.jpg'
    },
    {
      name: 'Mohammed',
      avis: "Plus de problème de gestion de mon entreprise avec Moze Connect",
      rating: 5,
      image: '/assets/images/mohammed.jpg'
    }
  ]);
}
