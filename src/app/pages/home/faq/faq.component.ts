import { Component } from '@angular/core';

@Component({
  selector: 'app-faq',
  standalone: true,
  imports: [],
  templateUrl: './faq.component.html',
  styleUrl: './faq.component.scss'
})
export class FaqComponent {

  selectedQ: 0 | 1 | 2| 3 | 4 | 5 | 6 | 7 = 0;

  changeSelectedQ(q: 0 | 1 | 2| 3 | 4 | 5 | 6) {
    if(q === this.selectedQ) {
      this.selectedQ = 7
    } else {
      this.selectedQ = q;
    }
  }
}
