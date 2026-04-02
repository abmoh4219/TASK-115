/**
 * ToastService Unit Tests
 */

import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import { ToastService, Toast } from '../../src/app/shared/components/toast/toast.service';

describe('ToastService', () => {
  let service: ToastService;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [ToastService] });
    service = TestBed.inject(ToastService);
  });

  afterEach(() => {
    service.clear();
    TestBed.resetTestingModule();
  });

  // --------------------------------------------------
  // show() basics
  // --------------------------------------------------

  it('adds a toast to the stack', () => {
    service.show('Hello', 'info');
    let toasts: Toast[] = [];
    service.toasts$.subscribe(t => (toasts = t));
    expect(toasts.length).toBe(1);
    expect(toasts[0].message).toBe('Hello');
    expect(toasts[0].type).toBe('info');
  });

  it('returns the toast ID', () => {
    const id = service.show('Test', 'success');
    expect(typeof id).toBe('string');
    expect(id.startsWith('toast-')).toBe(true);
  });

  it('success() sets type=success', () => {
    service.success('Done!');
    let toasts: Toast[] = [];
    service.toasts$.subscribe(t => (toasts = t));
    expect(toasts[0].type).toBe('success');
  });

  it('error() sets type=error with 6s duration', () => {
    service.error('Oops');
    let toasts: Toast[] = [];
    service.toasts$.subscribe(t => (toasts = t));
    expect(toasts[0].type).toBe('error');
    expect(toasts[0].durationMs).toBe(6000);
  });

  it('warning() sets type=warning', () => {
    service.warning('Caution');
    let toasts: Toast[] = [];
    service.toasts$.subscribe(t => (toasts = t));
    expect(toasts[0].type).toBe('warning');
  });

  it('info() sets type=info', () => {
    service.info('FYI');
    let toasts: Toast[] = [];
    service.toasts$.subscribe(t => (toasts = t));
    expect(toasts[0].type).toBe('info');
  });

  it('stores title when provided', () => {
    service.success('Saved!', 'Success');
    let toasts: Toast[] = [];
    service.toasts$.subscribe(t => (toasts = t));
    expect(toasts[0].title).toBe('Success');
  });

  // --------------------------------------------------
  // dismiss()
  // --------------------------------------------------

  it('dismiss() removes the specific toast', () => {
    const id = service.show('One', 'info', 0);
    service.show('Two', 'info', 0);
    let toasts: Toast[] = [];
    service.toasts$.subscribe(t => (toasts = t));
    expect(toasts.length).toBe(2);

    service.dismiss(id);
    service.toasts$.subscribe(t => (toasts = t));
    expect(toasts.length).toBe(1);
    expect(toasts[0].message).toBe('Two');
  });

  it('dismiss() with unknown id does nothing', () => {
    service.show('A', 'info', 0);
    service.dismiss('nonexistent-id');
    let toasts: Toast[] = [];
    service.toasts$.subscribe(t => (toasts = t));
    expect(toasts.length).toBe(1);
  });

  // --------------------------------------------------
  // clear()
  // --------------------------------------------------

  it('clear() removes all toasts', () => {
    service.show('1', 'info', 0);
    service.show('2', 'info', 0);
    service.show('3', 'info', 0);
    service.clear();
    let toasts: Toast[] = [];
    service.toasts$.subscribe(t => (toasts = t));
    expect(toasts.length).toBe(0);
  });

  // --------------------------------------------------
  // Max 5 toasts
  // --------------------------------------------------

  it('caps at 5 toasts (oldest dropped when 6th added)', () => {
    for (let i = 0; i < 6; i++) {
      service.show(`Message ${i}`, 'info', 0);
    }
    let toasts: Toast[] = [];
    service.toasts$.subscribe(t => (toasts = t));
    expect(toasts.length).toBe(5);
    // Oldest (Message 0) should have been dropped
    expect(toasts.some(t => t.message === 'Message 0')).toBe(false);
    expect(toasts[toasts.length - 1].message).toBe('Message 5');
  });

  // --------------------------------------------------
  // Auto-dismiss
  // --------------------------------------------------

  it('auto-dismisses after specified duration', fakeAsync(() => {
    service.show('Temp', 'info', 500);
    let toasts: Toast[] = [];
    service.toasts$.subscribe(t => (toasts = t));
    expect(toasts.length).toBe(1);

    tick(600);

    service.toasts$.subscribe(t => (toasts = t));
    expect(toasts.length).toBe(0);
  }));

  it('does NOT auto-dismiss when durationMs=0', fakeAsync(() => {
    service.show('Persistent', 'info', 0);
    tick(60_000); // wait a full minute
    let toasts: Toast[] = [];
    service.toasts$.subscribe(t => (toasts = t));
    expect(toasts.length).toBe(1);
  }));

  // --------------------------------------------------
  // count getter
  // --------------------------------------------------

  it('count returns correct number', () => {
    expect(service.count).toBe(0);
    service.show('1', 'info', 0);
    expect(service.count).toBe(1);
    service.show('2', 'info', 0);
    expect(service.count).toBe(2);
    service.clear();
    expect(service.count).toBe(0);
  });
});
