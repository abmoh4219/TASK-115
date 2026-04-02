import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface Toast {
  id: string;
  type: ToastType;
  message: string;
  title?: string;
  durationMs: number;
}

const MAX_TOASTS = 5;

const DEFAULT_DURATIONS: Record<ToastType, number> = {
  success: 4000,
  error:   6000,
  warning: 5000,
  info:    4000,
};

@Injectable({ providedIn: 'root' })
export class ToastService {

  private _toasts$ = new BehaviorSubject<Toast[]>([]);
  readonly toasts$ = this._toasts$.asObservable();

  // --------------------------------------------------
  // Core show method
  // --------------------------------------------------

  show(message: string, type: ToastType = 'info', duration?: number, title?: string): string {
    const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const durationMs = duration ?? DEFAULT_DURATIONS[type];

    const toast: Toast = { id, type, message, title, durationMs };

    // Cap at MAX_TOASTS — remove oldest if needed
    const current = this._toasts$.value;
    const next = current.length >= MAX_TOASTS
      ? [...current.slice(1), toast]
      : [...current, toast];

    this._toasts$.next(next);

    // Auto-dismiss
    if (durationMs > 0) {
      setTimeout(() => this.dismiss(id), durationMs);
    }

    return id;
  }

  // --------------------------------------------------
  // Convenience methods
  // --------------------------------------------------

  success(message: string, title?: string, duration?: number): string {
    return this.show(message, 'success', duration, title);
  }

  error(message: string, title?: string, duration?: number): string {
    return this.show(message, 'error', duration, title);
  }

  warning(message: string, title?: string, duration?: number): string {
    return this.show(message, 'warning', duration, title);
  }

  info(message: string, title?: string, duration?: number): string {
    return this.show(message, 'info', duration, title);
  }

  // --------------------------------------------------
  // Dismiss
  // --------------------------------------------------

  dismiss(id: string): void {
    this._toasts$.next(this._toasts$.value.filter(t => t.id !== id));
  }

  clear(): void {
    this._toasts$.next([]);
  }

  get count(): number {
    return this._toasts$.value.length;
  }
}
