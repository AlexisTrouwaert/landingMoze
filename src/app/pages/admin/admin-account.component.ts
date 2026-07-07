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
    selector: 'app-admin-account',
    imports: [ReactiveFormsModule, PasswordInputComponent],
    templateUrl: './admin-account.component.html',
    styleUrl: './admin-account.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class AdminAccountComponent {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  /** Changement de mot de passe imposé (1ère connexion) ? */
  readonly forced = this.auth.mustChangePassword;

  readonly pwdLoading = signal(false);
  readonly pwdError = signal<string | null>(null);

  readonly emailLoading = signal(false);
  readonly emailError = signal<string | null>(null);
  readonly emailSuccess = signal(false);

  readonly pwdForm = this.fb.nonNullable.group({
    currentPassword: ['', Validators.required],
    newPassword: ['', [Validators.required, Validators.minLength(8)]],
    confirm: ['', Validators.required],
  });

  readonly emailForm = this.fb.nonNullable.group({
    password: ['', Validators.required],
    newEmail: ['', [Validators.required, Validators.email]],
  });

  submitPassword(): void {
    if (this.pwdForm.invalid) {
      this.pwdForm.markAllAsTouched();
      return;
    }
    const { currentPassword, newPassword, confirm } = this.pwdForm.getRawValue();
    if (newPassword !== confirm) {
      this.pwdError.set('Les deux mots de passe ne correspondent pas.');
      return;
    }
    this.pwdLoading.set(true);
    this.pwdError.set(null);
    this.auth.changePassword(currentPassword, newPassword).subscribe({
      next: () => this.router.navigate(['/admin/blog']),
      error: (e: { status?: number }) => {
        this.pwdError.set(
          e?.status === 400
            ? 'Mot de passe actuel incorrect.'
            : 'Erreur lors du changement de mot de passe.',
        );
        this.pwdLoading.set(false);
      },
    });
  }

  submitEmail(): void {
    if (this.emailForm.invalid) {
      this.emailForm.markAllAsTouched();
      return;
    }
    const { password, newEmail } = this.emailForm.getRawValue();
    this.emailLoading.set(true);
    this.emailError.set(null);
    this.emailSuccess.set(false);
    this.auth.changeEmail(password, newEmail).subscribe({
      next: () => {
        this.emailSuccess.set(true);
        this.emailLoading.set(false);
        this.emailForm.reset();
      },
      error: (e: { status?: number }) => {
        this.emailError.set(
          e?.status === 409
            ? 'Cet email est déjà utilisé.'
            : e?.status === 400
              ? 'Mot de passe incorrect.'
              : "Erreur lors du changement d'email.",
        );
        this.emailLoading.set(false);
      },
    });
  }

  backToDashboard(): void {
    void this.router.navigate(['/admin/blog']);
  }

  logout(): void {
    this.auth.logout();
    void this.router.navigate(['/admin/login']);
  }
}
