import { Injectable } from '@angular/core';
import {BehaviorSubject, fromEvent, Observable} from "rxjs";

@Injectable({
  providedIn: 'root'
})
export class ScreenSizeService {

  private screenSizeSubject = new BehaviorSubject<number>(0);
  public screenSize$: Observable<number> = this.screenSizeSubject.asObservable();

  constructor() {
    this.calculateScreenSize();

    fromEvent(window, 'resize').subscribe(() => {
      this.calculateScreenSize();
    })
  }

  calculateScreenSize() {
    this.screenSizeSubject.next(window.innerWidth)
  }
}
