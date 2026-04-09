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
  styleUrls: ['./toast.component.scss'],
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
