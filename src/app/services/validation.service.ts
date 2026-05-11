import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpContext, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

export interface SireneResponse {
  siret: string;
  denomination: string;
  nomCommercial?: string;
  statutJuridique: string;
  ape: string;
  adresseComplete?: string;
}

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

  /**
   * Récupère les informations d'une entreprise via son numéro SIRET.
   */
  getEtablissementInfo(siret: string, context?: HttpContext): Observable<SireneResponse> {
    const cleanSiret = siret.replace(/[\s-]/g, '');
    const headers = new HttpHeaders({ 'Accept': 'application/json' });
    const options = context ? { headers, context } : { headers };
    return this.http.get<SireneResponse>(`${this.apiUrl}/sirene/etablissement/${cleanSiret}`, options);
  }
}
