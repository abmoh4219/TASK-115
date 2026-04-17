import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { ToastComponent } from '../../../src/app/shared/components/toast/toast.component';
import { ToastService } from '../../../src/app/shared/components/toast/toast.service';
import type { Toast } from '../../../src/app/shared/components/toast/toast.service';
import { MatIconModule } from '@angular/material/icon';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { BehaviorSubject } from 'rxjs';

describe('ToastComponent', () => {
  let fixture: ComponentFixture<ToastComponent>;
  let component: ToastComponent;
  let toastSpy: { toasts$: BehaviorSubject<any[]>; dismiss: jest.Mock };

  beforeEach(async () => {
    toastSpy = {
      toasts$: new BehaviorSubject<any[]>([]),
      dismiss: jest.fn(),
    };

    await TestBed.configureTestingModule({
      imports: [ToastComponent, MatIconModule, NoopAnimationsModule],
      providers: [{ provide: ToastService, useValue: toastSpy }],
    }).compileComponents();

    fixture = TestBed.createComponent(ToastComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('starts with empty toasts', () => {
    expect(component.toasts).toEqual([]);
  });

  it('subscribes to toasts$ on init and shows toasts', () => {
    const toasts = [{ id: 't1', type: 'success' as const, message: 'Done', title: '', durationMs: 3000 } as Toast];
    toastSpy.toasts$.next(toasts);
    fixture.detectChanges();
    expect(component.toasts.length).toBe(1);
  });

  it('iconFor returns correct icon for success', () => {
    expect(component.iconFor('success')).toBe('check_circle');
  });

  it('iconFor returns correct icon for error', () => {
    expect(component.iconFor('error')).toBe('error');
  });

  it('iconFor returns correct icon for warning', () => {
    expect(component.iconFor('warning')).toBe('warning');
  });

  it('iconFor returns correct icon for info', () => {
    expect(component.iconFor('info')).toBe('info');
  });

  it('iconFor returns "info" for unknown type', () => {
    expect(component.iconFor('unknown')).toBe('info');
  });

  it('dismiss() calls toastService.dismiss', () => {
    component.dismiss('t1');
    expect(toastSpy.dismiss).toHaveBeenCalledWith('t1');
  });

  it('trackById returns toast id', () => {
    const toast = { id: 'abc', type: 'info' as const, message: 'test', title: '', durationMs: 3000 } as Toast;
    expect(component.trackById(0, toast)).toBe('abc');
  });

  it('isEntering returns false when not entering', () => {
    expect(component.isEntering('non-existent')).toBe(false);
  });

  it('unsubscribes on destroy', () => {
    const spy = jest.spyOn(component['sub'] as any, 'unsubscribe');
    component.ngOnDestroy();
    expect(spy).toHaveBeenCalled();
  });

  it('new toast marks as entering briefly', fakeAsync(() => {
    const toast = { id: 'new1', type: 'info' as const, message: 'hello', title: '', durationMs: 3000 } as Toast;
    toastSpy.toasts$.next([toast]);
    fixture.detectChanges();
    expect(component.isEntering('new1')).toBe(true);
    tick(300);
    expect(component.isEntering('new1')).toBe(false);
  }));
});
