import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

@Injectable({
  providedIn: 'root'
})
export class ValidationService {
  private http = inject(HttpClient);
  private apiUrl = 'https://moze.fr/mozeapp';

  /**
   * Vérifie si un email est déjà enregistré en base de données.
   */
  validateEmail(email: string): Observable<boolean> {
    return this.http.get<{ emailExists: boolean }>(`${this.apiUrl}/inscription/validate-email?email=${email}`).pipe(
      map(response => response.emailExists)
    );
  }
}
