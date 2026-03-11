import {Component, signal} from '@angular/core';

@Component({
  selector: 'app-faq',
  standalone: true,
  imports: [],
  templateUrl: './faq.component.html',
  styleUrl: './faq.component.scss'
})
export class FaqComponent {

  selectedQ = signal<number | null>(null);

  changeSelectedQ(q: number) {
    this.selectedQ.update(current => current === q ? null : q);
  }
}
