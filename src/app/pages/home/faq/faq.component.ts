import { Component } from '@angular/core';

@Component({
  selector: 'app-faq',
  standalone: true,
  imports: [],
  templateUrl: './faq.component.html',
  styleUrl: './faq.component.scss'
})
export class FaqComponent {

  selectedQ: 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 = 8;

  changeSelectedQ(q: 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7) {
    if (q === this.selectedQ) {
      this.selectedQ = 8;
    } else {
      this.selectedQ = q;
    }
  }
}
