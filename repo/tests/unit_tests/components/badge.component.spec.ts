import { ComponentFixture, TestBed } from '@angular/core/testing';
import { BadgeComponent } from '../../../src/app/shared/components/badge/badge.component';

describe('BadgeComponent', () => {
  let fixture: ComponentFixture<BadgeComponent>;
  let component: BadgeComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BadgeComponent],
    }).compileComponents();
    fixture = TestBed.createComponent(BadgeComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should hide badge when count is 0', () => {
    fixture.componentRef.setInput('count', 0);
    fixture.detectChanges();
    const el = fixture.nativeElement.querySelector('.hp-unread-badge');
    expect(el).toBeNull();
  });

  it('should show badge when count > 0', () => {
    fixture.componentRef.setInput('count', 5);
    fixture.detectChanges();
    const el = fixture.nativeElement.querySelector('.hp-unread-badge');
    expect(el).not.toBeNull();
    expect(el.textContent.trim()).toBe('5');
  });

  it('should show max+ when count exceeds max', () => {
    component.count = 120;
    component.max = 99;
    expect(component.displayCount).toBe('99+');
  });

  it('should show exact count when count equals max', () => {
    component.count = 99;
    component.max = 99;
    expect(component.displayCount).toBe('99');
  });

  it('displayCount returns string for small count', () => {
    component.count = 7;
    expect(component.displayCount).toBe('7');
  });

  it('ariaLabel says "More than X unread" when count exceeds max', () => {
    component.count = 200;
    component.max = 99;
    expect(component.ariaLabel).toBe('More than 99 unread');
  });

  it('ariaLabel says "N unread" when count is within max', () => {
    component.count = 3;
    component.max = 99;
    expect(component.ariaLabel).toBe('3 unread');
  });

  it('applies correct color class', () => {
    fixture.componentRef.setInput('count', 1);
    fixture.componentRef.setInput('color', 'primary');
    fixture.detectChanges();
    const el = fixture.nativeElement.querySelector('.hp-unread-badge--primary');
    expect(el).not.toBeNull();
  });
});
