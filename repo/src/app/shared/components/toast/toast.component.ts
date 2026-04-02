import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { ToastService, Toast } from './toast.service';
import { Subscription } from 'rxjs';
import { trigger, transition, style, animate } from '@angular/animations';

@Component({
  selector: 'app-toast',
  standalone: true,
  imports: [CommonModule, MatIconModule, MatButtonModule],
  animations: [
    trigger('toastAnim', [
      transition(':enter', [
        style({ opacity: 0, transform: 'translateX(100%)' }),
        animate('200ms ease-out', style({ opacity: 1, transform: 'translateX(0)' })),
      ]),
      transition(':leave', [
        animate('150ms ease-in', style({ opacity: 0, transform: 'translateX(100%)' })),
      ]),
    ]),
  ],
  template: `
    <div class="toast-container" aria-live="polite" aria-atomic="false">
      <div
        *ngFor="let toast of toasts; trackBy: trackById"
        [@toastAnim]
        class="toast toast--{{ toast.type }}"
        role="alert"
      >
        <mat-icon class="toast-icon">{{ iconFor(toast.type) }}</mat-icon>
        <div class="toast-body">
          <strong *ngIf="toast.title">{{ toast.title }}</strong>
          <span>{{ toast.message }}</span>
        </div>
        <button mat-icon-button class="toast-close" (click)="dismiss(toast.id)" aria-label="Dismiss">
          <mat-icon>close</mat-icon>
        </button>
      </div>
    </div>
  `,
  styles: [`
    .toast-container {
      position: fixed;
      top: 1rem;
      right: 1rem;
      z-index: 9999;
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
      max-width: 380px;
      width: 100%;
    }
    .toast {
      display: flex;
      align-items: flex-start;
      gap: 0.75rem;
      padding: 0.75rem 1rem;
      border-radius: var(--hp-radius);
      background: var(--hp-white);
      border-left: 4px solid;
      box-shadow: var(--hp-shadow-md);
    }
    .toast--success { border-color: var(--hp-success); }
    .toast--error   { border-color: var(--hp-danger); }
    .toast--warning { border-color: var(--hp-warning); }
    .toast--info    { border-color: var(--hp-teal); }
    .toast-icon { flex-shrink: 0; }
    .toast--success .toast-icon { color: var(--hp-success); }
    .toast--error   .toast-icon { color: var(--hp-danger); }
    .toast--warning .toast-icon { color: var(--hp-warning); }
    .toast--info    .toast-icon { color: var(--hp-teal); }
    .toast-body {
      flex: 1;
      display: flex;
      flex-direction: column;
      gap: 0.125rem;
      font-size: 0.875rem;
    }
    .toast-close { flex-shrink: 0; margin: -0.5rem -0.5rem -0.5rem 0; }
  `],
})
export class ToastComponent implements OnInit, OnDestroy {
  toasts: Toast[] = [];
  private sub?: Subscription;

  constructor(private toastService: ToastService) {}

  ngOnInit(): void {
    this.sub = this.toastService.toasts$.subscribe(toasts => {
      this.toasts = toasts;
    });
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
  }

  dismiss(id: string): void {
    this.toastService.dismiss(id);
  }

  iconFor(type: string): string {
    const icons: Record<string, string> = {
      success: 'check_circle',
      error:   'error',
      warning: 'warning',
      info:    'info',
    };
    return icons[type] ?? 'info';
  }

  trackById(_: number, toast: Toast): string {
    return toast.id;
  }
}
