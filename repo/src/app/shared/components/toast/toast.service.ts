import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface Toast {
  id: string;
  type: ToastType;
  message: string;
  title?: string;
  durationMs?: number;
}

@Injectable({ providedIn: 'root' })
export class ToastService {

  private _toasts$ = new BehaviorSubject<Toast[]>([]);
  readonly toasts$ = this._toasts$.asObservable();

  show(type: ToastType, message: string, title?: string, durationMs = 4000): void {
    const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const toast: Toast = { id, type, message, title, durationMs };

    this._toasts$.next([...this._toasts$.value, toast]);

    if (durationMs > 0) {
      setTimeout(() => this.dismiss(id), durationMs);
    }
  }

  success(message: string, title?: string): void {
    this.show('success', message, title);
  }

  error(message: string, title?: string): void {
    this.show('error', message, title, 6000);
  }

  warning(message: string, title?: string): void {
    this.show('warning', message, title, 5000);
  }

  info(message: string, title?: string): void {
    this.show('info', message, title);
  }

  dismiss(id: string): void {
    this._toasts$.next(this._toasts$.value.filter(t => t.id !== id));
  }

  clear(): void {
    this._toasts$.next([]);
  }
}
