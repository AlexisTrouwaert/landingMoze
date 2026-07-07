import {
  ChangeDetectionStrategy,
  Component,
  inject,
  signal,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { PasswordInputComponent } from '../../components/password-input/password-input.component';
import { AuthService } from '../../services/auth.service';

@Component({
    selector: 'app-admin-login',
    imports: [ReactiveFormsModule, PasswordInputComponent],
    templateUrl: './admin-login.component.html',
    styleUrl: './admin-login.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class AdminLoginComponent {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  readonly loading = signal(false);
  readonly error = signal<string | null>(null);

  readonly form = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required]],
  });

  constructor() {
    // Déjà connecté ? On va directement au dashboard.
    if (this.auth.isAdmin()) {
      void this.router.navigate([
        this.auth.mustChangePassword() ? '/admin/compte' : '/admin/blog',
      ]);
    }
  }

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.loading.set(true);
    this.error.set(null);
    const { email, password } = this.form.getRawValue();
    this.auth.login(email, password).subscribe({
      next: () =>
        this.router.navigate([
          this.auth.mustChangePassword() ? '/admin/compte' : '/admin/blog',
        ]),
      error: (e: { status?: number }) => {
        this.error.set(
          e?.status === 401
            ? 'Identifiants invalides.'
            : 'Connexion au serveur impossible.',
        );
        this.loading.set(false);
      },
    });
  }
}
