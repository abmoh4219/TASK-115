import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { DrawerComponent } from '../../../src/app/shared/components/drawer/drawer.component';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';

describe('DrawerComponent', () => {
  let fixture: ComponentFixture<DrawerComponent>;
  let component: DrawerComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DrawerComponent, MatIconModule, MatButtonModule, NoopAnimationsModule],
    }).compileComponents();
    fixture = TestBed.createComponent(DrawerComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('starts closed', () => {
    expect(component.visible).toBe(false);
  });

  it('sets visible=true when open input becomes true', () => {
    fixture.componentRef.setInput('open', true);
    fixture.detectChanges();
    expect(component.visible).toBe(true);
  });

  it('sets animating=false when open becomes false', fakeAsync(() => {
    fixture.componentRef.setInput('open', true);
    fixture.detectChanges();
    fixture.componentRef.setInput('open', false);
    fixture.detectChanges();
    expect(component.animating).toBe(false);
    tick(350);
  }));

  it('close() emits closed event', () => {
    const spy = jest.spyOn(component.closed, 'emit');
    component.close();
    expect(spy).toHaveBeenCalled();
  });

  it('onBackdropClick() calls close()', () => {
    const spy = jest.spyOn(component, 'close');
    component.onBackdropClick();
    expect(spy).toHaveBeenCalled();
  });

  it('onEscKey closes when open', () => {
    component.open = true;
    const spy = jest.spyOn(component, 'close');
    component.onEscKey();
    expect(spy).toHaveBeenCalled();
  });

  it('onEscKey does nothing when not open', () => {
    component.open = false;
    const spy = jest.spyOn(component, 'close');
    component.onEscKey();
    expect(spy).not.toHaveBeenCalled();
  });
});
