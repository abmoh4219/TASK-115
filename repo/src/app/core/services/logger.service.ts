import { Injectable, isDevMode } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class LoggerService {

  error(context: string, message: string, err?: unknown): void {
    const safeErr = err instanceof Error
      ? { name: err.name, message: err.message }
      : typeof err === 'string' ? err : 'unknown error';

    if (isDevMode()) {
      console.error(`[${context}] ${message}`, safeErr);
    } else {
      console.error(`[${context}] ${message}`);
    }
  }

  warn(context: string, message: string): void {
    if (isDevMode()) {
      console.warn(`[${context}] ${message}`);
    }
  }
}
