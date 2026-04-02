import {
  Component, OnInit, OnDestroy,
  ChangeDetectionStrategy, ChangeDetectorRef,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { ToastService, Toast } from './toast.service';
import { Subscription } from 'rxjs';

const TOAST_ICONS: Record<string, string> = {
  success: 'check_circle',
  error:   'error',
  warning: 'warning',
  info:    'info',
};

@Component({
  selector: 'app-toast',
  standalone: true,
  imports: [CommonModule, MatIconModule],
  template: `
    <div class="toast-stack" role="region" aria-label="Notifications" aria-live="polite">
      <div
        *ngFor="let toast of toasts; trackBy: trackById"
        class="toast toast--{{ toast.type }}"
        [class.toast--entering]="isEntering(toast.id)"
        role="alert"
        [attr.aria-label]="toast.title || toast.message"
      >
        <mat-icon class="toast__icon" aria-hidden="true">{{ iconFor(toast.type) }}</mat-icon>

        <div class="toast__body">
          <p *ngIf="toast.title" class="toast__title">{{ toast.title }}</p>
          <p class="toast__message">{{ toast.message }}</p>
        </div>

        <button
          class="toast__dismiss"
          (click)="dismiss(toast.id)"
          [attr.aria-label]="'Dismiss: ' + toast.message"
          type="button"
        >
          <mat-icon>close</mat-icon>
        </button>
      </div>
    </div>
  `,
  styles: [`
    .toast-stack {
      position: fixed;
      top: 1rem;
      right: 1rem;
      z-index: 9999;
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
      width: 100%;
      max-width: 380px;
      pointer-events: none;
    }

    .toast {
      display: flex;
      align-items: flex-start;
      gap: 0.75rem;
      padding: 0.875rem 1rem;
      border-radius: 8px;
      background: #ffffff;
      border-left: 4px solid;
      box-shadow: 0 4px 16px rgba(0,0,0,0.12);
      pointer-events: all;

      // Slide-in from right
      animation: toast-in 220ms ease forwards;

      &--success { border-color: #10b981; .toast__icon { color: #10b981; } }
      &--error   { border-color: #ef4444; .toast__icon { color: #ef4444; } }
      &--warning { border-color: #f59e0b; .toast__icon { color: #f59e0b; } }
      &--info    { border-color: #3b82f6; .toast__icon { color: #3b82f6; } }
    }

    @keyframes toast-in {
      from { opacity: 0; transform: translateX(100%); }
      to   { opacity: 1; transform: translateX(0); }
    }

    .toast__icon {
      font-size: 1.25rem;
      width: 1.25rem;
      height: 1.25rem;
      flex-shrink: 0;
      margin-top: 1px;
    }

    .toast__body {
      flex: 1;
      min-width: 0;
    }

    .toast__title {
      font-size: 0.875rem;
      font-weight: 600;
      color: #111827;
      margin: 0 0 0.125rem;
    }

    .toast__message {
      font-size: 0.8125rem;
      color: #374151;
      margin: 0;
      line-height: 1.5;
    }

    .toast__dismiss {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 28px;
      height: 28px;
      border: none;
      background: transparent;
      border-radius: 4px;
      cursor: pointer;
      color: #9ca3af;
      flex-shrink: 0;
      margin: -2px -4px -2px 0;
      transition: background 120ms, color 120ms;

      mat-icon {
        font-size: 1rem;
        width: 1rem;
        height: 1rem;
      }

      &:hover {
        background: #f3f4f6;
        color: #374151;
      }
    }

    @media (max-width: 479px) {
      .toast-stack {
        left: 1rem;
        right: 1rem;
        max-width: none;
      }
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ToastComponent implements OnInit, OnDestroy {

  toasts: Toast[] = [];
  private enteringIds = new Set<string>();
  private sub?: Subscription;

  constructor(
    private toastService: ToastService,
    private cdr: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    this.sub = this.toastService.toasts$.subscribe(toasts => {
      // Track new IDs for entrance animation
      toasts.forEach(t => {
        if (!this.toasts.find(existing => existing.id === t.id)) {
          this.enteringIds.add(t.id);
          setTimeout(() => { this.enteringIds.delete(t.id); }, 250);
        }
      });
      this.toasts = toasts;
      this.cdr.markForCheck();
    });
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
  }

  dismiss(id: string): void {
    this.toastService.dismiss(id);
  }

  iconFor(type: string): string {
    return TOAST_ICONS[type] ?? 'info';
  }

  isEntering(id: string): boolean {
    return this.enteringIds.has(id);
  }

  trackById(_: number, toast: Toast): string {
    return toast.id;
  }
}
