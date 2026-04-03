import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-role-picker',
  standalone: true,
  imports: [
    CommonModule, FormsModule,
    MatCardModule, MatButtonModule, MatInputModule,
    MatFormFieldModule, MatIconModule,
    MatProgressSpinnerModule,
  ],
  template: `
    <div class="login-bg">
      <div class="login-card mat-elevation-z8">
        <div class="login-brand">
          <div class="login-logo">⚓</div>
          <h1 class="login-title">HarborPoint</h1>
          <p class="login-subtitle">Resident &amp; Services Management</p>
        </div>

        <form (ngSubmit)="onSubmit()" #loginForm="ngForm" class="login-form">
          <mat-form-field appearance="outline">
            <mat-label>Username</mat-label>
            <input
              matInput
              type="text"
              [(ngModel)]="username"
              name="username"
              required
              placeholder="Enter your username"
              autocomplete="username"
              (input)="clearError()"
            />
            <mat-icon matSuffix>person</mat-icon>
          </mat-form-field>

          <mat-form-field appearance="outline">
            <mat-label>Password</mat-label>
            <input
              matInput
              [type]="showPassword ? 'text' : 'password'"
              [(ngModel)]="password"
              name="password"
              required
              placeholder="Enter your password"
              autocomplete="current-password"
              (input)="clearError()"
            />
            <button mat-icon-button matSuffix type="button" (click)="showPassword = !showPassword">
              <mat-icon>{{ showPassword ? 'visibility_off' : 'visibility' }}</mat-icon>
            </button>
          </mat-form-field>

          <div *ngIf="errorMessage" class="login-error">
            <mat-icon>error_outline</mat-icon>
            {{ errorMessage }}
          </div>

          <button
            mat-raised-button
            color="primary"
            type="submit"
            class="login-btn"
            [disabled]="loading || !loginForm.valid"
          >
            <mat-spinner *ngIf="loading" diameter="20" class="btn-spinner"></mat-spinner>
            <span *ngIf="!loading">Sign In</span>
          </button>
        </form>
      </div>
    </div>
  `,
  styles: [`
    .login-bg {
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      background: linear-gradient(135deg, var(--hp-navy) 0%, var(--hp-navy-dark) 100%);
    }
    .login-card {
      background: var(--hp-white);
      border-radius: 16px;
      padding: 2.5rem;
      width: 100%;
      max-width: 400px;
      margin: 1rem;
    }
    .login-brand {
      text-align: center;
      margin-bottom: 2rem;
    }
    .login-logo {
      font-size: 3rem;
      margin-bottom: 0.5rem;
    }
    .login-title {
      font-size: 1.75rem;
      color: var(--hp-navy);
      margin: 0 0 0.25rem;
    }
    .login-subtitle {
      color: var(--hp-text-muted);
      margin: 0;
      font-size: 0.875rem;
    }
    .login-form {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }
    .login-error {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      color: var(--hp-danger);
      font-size: 0.875rem;
      padding: 0.5rem;
      background: #fee2e2;
      border-radius: var(--hp-radius);
    }
    .login-btn {
      margin-top: 0.5rem;
      height: 48px;
      font-size: 1rem;
      background: var(--hp-navy) !important;
    }
    .btn-spinner {
      display: inline-block;
      margin: 0 auto;
    }
  `],
})
export class RolePickerComponent implements OnInit {
  username = '';
  password = '';
  showPassword = false;
  loading = false;
  errorMessage = '';

  constructor(
    private auth: AuthService,
    private router: Router,
  ) {}

  ngOnInit(): void {
    if (this.auth.isLoggedIn()) {
      this.navigateToDashboard();
    }
  }

  clearError(): void {
    this.errorMessage = '';
  }

  async onSubmit(): Promise<void> {
    this.loading = true;
    this.errorMessage = '';

    try {
      const result = await this.auth.login(this.username, this.password);
      if (result.success) {
        this.navigateToDashboard();
      } else {
        this.errorMessage = result.error ?? 'Invalid username or password';
      }
    } finally {
      this.loading = false;
    }
  }

  private navigateToDashboard(): void {
    const role = this.auth.getCurrentRole();
    switch (role) {
      case 'admin':      this.router.navigate(['/dashboard']); break;
      case 'resident':   this.router.navigate(['/my-profile']); break;
      case 'compliance': this.router.navigate(['/documents']); break;
      case 'analyst':    this.router.navigate(['/analytics']); break;
      default:           this.router.navigate(['/login']); break;
    }
  }
}
