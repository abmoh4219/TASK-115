import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'app-unauthorized',
  standalone: true,
  imports: [CommonModule, RouterModule, MatButtonModule, MatIconModule],
  template: `
    <div class="unauthorized">
      <mat-icon class="unauthorized-icon">lock</mat-icon>
      <h1>Access Denied</h1>
      <p>You do not have permission to view this page.</p>
      <p class="unauthorized-hint">This area requires a different role. Please sign in with the appropriate credentials.</p>
      <button mat-raised-button color="primary" routerLink="/login">
        <mat-icon>login</mat-icon>
        Back to Sign In
      </button>
    </div>
  `,
  styles: [`
    .unauthorized {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      text-align: center;
      padding: 2rem;
      background: var(--hp-bg);
    }
    .unauthorized-icon {
      font-size: 5rem;
      width: 5rem;
      height: 5rem;
      color: var(--hp-danger);
      margin-bottom: 1rem;
    }
    h1 { color: var(--hp-navy); font-size: 2rem; }
    p { color: var(--hp-text-muted); max-width: 400px; }
    .unauthorized-hint { font-size: 0.875rem; }
  `],
})
export class UnauthorizedComponent {}
