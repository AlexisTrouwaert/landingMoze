import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '../../environements/environment';

@Injectable({
  providedIn: 'root'
})
export class ValidationService {
  private http = inject(HttpClient);
  // Même base que FunnelService / environment (app.mozeconnect.fr). L'ancienne valeur
  // 'https://moze.fr/mozeapp' ne servait pas cette API → l'appel échouait et le doublon
  // n'était jamais détecté avant le POST (catchError → of(false) côté composant).
  private apiUrl = `${environment.apiUrl}/mozeapp`;

  /**
   * Vérifie si un email est déjà enregistré en base de données.
   */
  validateEmail(email: string): Observable<boolean> {
    return this.http.get<{ emailExists: boolean }>(`${this.apiUrl}/inscription/validate-email?email=${email}`).pipe(
      map(response => response.emailExists)
    );
  }
}
