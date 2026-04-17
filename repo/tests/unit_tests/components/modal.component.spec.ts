import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { ModalComponent } from '../../../src/app/shared/components/modal/modal.component';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';

describe('ModalComponent', () => {
  let fixture: ComponentFixture<ModalComponent>;
  let component: ModalComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ModalComponent, MatIconModule, MatButtonModule, MatProgressSpinnerModule, NoopAnimationsModule],
    }).compileComponents();
    fixture = TestBed.createComponent(ModalComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  afterEach(() => {
    document.body.style.overflow = '';
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('defaults to closed and not visible', () => {
    expect(component.visible).toBe(false);
    expect(component.animating).toBe(false);
  });

  it('sets visible=true when open becomes true', () => {
    fixture.componentRef.setInput('open', true);
    fixture.detectChanges();
    expect(component.visible).toBe(true);
  });

  it('locks body scroll when opened', () => {
    fixture.componentRef.setInput('open', true);
    fixture.detectChanges();
    expect(document.body.style.overflow).toBe('hidden');
  });

  it('sets animating=false when open becomes false', fakeAsync(() => {
    fixture.componentRef.setInput('open', true);
    fixture.detectChanges();
    fixture.componentRef.setInput('open', false);
    fixture.detectChanges();
    expect(component.animating).toBe(false);
    tick(300);
  }));

  it('iconForType returns "error" for danger type', () => {
    component.type = 'danger';
    expect(component.iconForType).toBe('error');
  });

  it('iconForType returns "warning" for warning type', () => {
    component.type = 'warning';
    expect(component.iconForType).toBe('warning');
  });

  it('iconForType returns "" for default type', () => {
    component.type = 'default';
    expect(component.iconForType).toBe('');
  });

  it('confirmColor returns "warn" for danger type', () => {
    component.type = 'danger';
    expect(component.confirmColor).toBe('warn');
  });

  it('confirmColor returns "primary" for default type', () => {
    component.type = 'default';
    expect(component.confirmColor).toBe('primary');
  });

  it('onConfirm emits confirmed event', () => {
    const spy = jest.spyOn(component.confirmed, 'emit');
    component.onConfirm();
    expect(spy).toHaveBeenCalled();
  });

  it('onConfirm does nothing when loading', () => {
    component.loading = true;
    const spy = jest.spyOn(component.confirmed, 'emit');
    component.onConfirm();
    expect(spy).not.toHaveBeenCalled();
  });

  it('onConfirm does nothing when confirmDisabled', () => {
    component.confirmDisabled = true;
    const spy = jest.spyOn(component.confirmed, 'emit');
    component.onConfirm();
    expect(spy).not.toHaveBeenCalled();
  });

  it('onCancel emits cancelled event', () => {
    const spy = jest.spyOn(component.cancelled, 'emit');
    component.onCancel();
    expect(spy).toHaveBeenCalled();
  });

  it('onCancel does nothing when loading', () => {
    component.loading = true;
    const spy = jest.spyOn(component.cancelled, 'emit');
    component.onCancel();
    expect(spy).not.toHaveBeenCalled();
  });

  it('onOverlayClick closes when clicking the overlay element', () => {
    const spy = jest.spyOn(component, 'onCancel');
    const mockEvent = {
      target: { classList: { contains: jest.fn().mockReturnValue(true) } },
    } as unknown as MouseEvent;
    component.onOverlayClick(mockEvent);
    expect(spy).toHaveBeenCalled();
  });

  it('onOverlayClick does not close when clicking inside panel', () => {
    const spy = jest.spyOn(component, 'onCancel');
    const mockEvent = {
      target: { classList: { contains: jest.fn().mockReturnValue(false) } },
    } as unknown as MouseEvent;
    component.onOverlayClick(mockEvent);
    expect(spy).not.toHaveBeenCalled();
  });

  it('Escape key closes modal when open', () => {
    component.open = true;
    const spy = jest.spyOn(component, 'onCancel');
    const event = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true });
    jest.spyOn(event, 'preventDefault').mockImplementation(() => {});
    component.onKeydown(event);
    expect(spy).toHaveBeenCalled();
  });

  it('Escape key does nothing when modal is closed', () => {
    component.open = false;
    const spy = jest.spyOn(component, 'onCancel');
    const event = new KeyboardEvent('keydown', { key: 'Escape' });
    component.onKeydown(event);
    expect(spy).not.toHaveBeenCalled();
  });

  it('ngAfterViewInit runs without errors', () => {
    expect(() => component.ngAfterViewInit()).not.toThrow();
  });

  it('animating=true inside requestAnimationFrame when open', fakeAsync(() => {
    const origRaf = window.requestAnimationFrame;
    window.requestAnimationFrame = (fn: FrameRequestCallback) => { fn(0); return 0; };
    fixture.componentRef.setInput('open', true);
    fixture.detectChanges();
    expect(component.animating).toBe(true);
    window.requestAnimationFrame = origRaf;
    tick(300);
  }));

  it('Tab key does not throw when modal is open', () => {
    component.open = true;
    const event = new KeyboardEvent('keydown', { key: 'Tab' });
    jest.spyOn(event, 'preventDefault').mockImplementation(() => {});
    expect(() => component.onKeydown(event)).not.toThrow();
  });
});
