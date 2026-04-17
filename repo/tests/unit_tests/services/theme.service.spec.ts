import { TestBed } from '@angular/core/testing';
import { ThemeService } from '../../../src/app/core/services/theme.service';

describe('ThemeService', () => {
  let service: ThemeService;

  beforeEach(() => {
    localStorage.clear();
    document.body.className = '';
    TestBed.configureTestingModule({});
    service = TestBed.inject(ThemeService);
  });

  afterEach(() => {
    localStorage.clear();
    document.body.className = '';
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('defaults to light theme', () => {
    expect(service.currentTheme).toBe('light');
  });

  it('defaults to comfortable density', () => {
    expect(service.currentDensity).toBe('comfortable');
  });

  it('setTheme sets dark theme and updates body class', () => {
    service.setTheme('dark');
    expect(service.currentTheme).toBe('dark');
    expect(document.body.classList.contains('dark-theme')).toBe(true);
    expect(localStorage.getItem('hp_theme')).toBe('dark');
  });

  it('setTheme removes dark-theme class on light', () => {
    service.setTheme('dark');
    service.setTheme('light');
    expect(document.body.classList.contains('dark-theme')).toBe(false);
    expect(localStorage.getItem('hp_theme')).toBe('light');
  });

  it('toggleTheme switches from light to dark', () => {
    service.toggleTheme();
    expect(service.currentTheme).toBe('dark');
  });

  it('toggleTheme switches from dark to light', () => {
    service.setTheme('dark');
    service.toggleTheme();
    expect(service.currentTheme).toBe('light');
  });

  it('setDensity changes density and adds body class', () => {
    service.setDensity('compact');
    expect(service.currentDensity).toBe('compact');
    expect(document.body.classList.contains('density-compact')).toBe(true);
    expect(localStorage.getItem('hp_density')).toBe('compact');
  });

  it('setDensity removes old density class', () => {
    service.setDensity('compact');
    service.setDensity('spacious');
    expect(document.body.classList.contains('density-compact')).toBe(false);
    expect(document.body.classList.contains('density-spacious')).toBe(true);
  });

  it('init restores saved dark theme from localStorage', () => {
    localStorage.setItem('hp_theme', 'dark');
    service.init();
    expect(service.currentTheme).toBe('dark');
  });

  it('init restores saved density from localStorage', () => {
    localStorage.setItem('hp_density', 'compact');
    service.init();
    expect(service.currentDensity).toBe('compact');
  });

  it('init ignores invalid theme values', () => {
    localStorage.setItem('hp_theme', 'invalid');
    service.init();
    expect(service.currentTheme).toBe('light');
  });

  it('init ignores invalid density values', () => {
    localStorage.setItem('hp_density', 'huge');
    service.init();
    expect(service.currentDensity).toBe('comfortable');
  });

  it('theme$ emits current theme', (done) => {
    service.theme$.subscribe(t => {
      expect(t).toBe('light');
      done();
    });
  });

  it('density$ emits current density', (done) => {
    service.density$.subscribe(d => {
      expect(d).toBe('comfortable');
      done();
    });
  });
});
