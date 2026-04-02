import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

export type ThemeMode = 'light' | 'dark';
export type UiDensity = 'compact' | 'comfortable' | 'spacious';

const LS_THEME   = 'hp_theme';
const LS_DENSITY = 'hp_density';

@Injectable({ providedIn: 'root' })
export class ThemeService {

  private _theme   = new BehaviorSubject<ThemeMode>('light');
  private _density = new BehaviorSubject<UiDensity>('comfortable');

  readonly theme$   = this._theme.asObservable();
  readonly density$ = this._density.asObservable();

  get currentTheme(): ThemeMode  { return this._theme.value; }
  get currentDensity(): UiDensity { return this._density.value; }

  /** Call once at app startup — before first render if possible */
  init(): void {
    const saved = localStorage.getItem(LS_THEME) as ThemeMode | null;
    if (saved === 'dark' || saved === 'light') {
      this.setTheme(saved);
    }
    const density = localStorage.getItem(LS_DENSITY) as UiDensity | null;
    if (density === 'compact' || density === 'comfortable' || density === 'spacious') {
      this.setDensity(density);
    }
  }

  setTheme(mode: ThemeMode): void {
    this._theme.next(mode);
    localStorage.setItem(LS_THEME, mode);

    if (mode === 'dark') {
      document.body.classList.add('dark-theme');
    } else {
      document.body.classList.remove('dark-theme');
    }
  }

  toggleTheme(): void {
    this.setTheme(this.currentTheme === 'light' ? 'dark' : 'light');
  }

  setDensity(d: UiDensity): void {
    this._density.next(d);
    localStorage.setItem(LS_DENSITY, d);

    document.body.classList.remove('density-compact', 'density-comfortable', 'density-spacious');
    document.body.classList.add(`density-${d}`);
  }
}
