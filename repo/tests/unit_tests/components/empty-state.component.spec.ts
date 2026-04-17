import { ComponentFixture, TestBed } from '@angular/core/testing';
import { EmptyStateComponent } from '../../../src/app/shared/components/empty-state/empty-state.component';
import { MatIconModule } from '@angular/material/icon';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';

describe('EmptyStateComponent', () => {
  let fixture: ComponentFixture<EmptyStateComponent>;
  let component: EmptyStateComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [EmptyStateComponent, MatIconModule, NoopAnimationsModule],
    }).compileComponents();
    fixture = TestBed.createComponent(EmptyStateComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('shows title', () => {
    fixture.componentRef.setInput('title', 'No results found');
    fixture.detectChanges();
    const h3 = fixture.nativeElement.querySelector('.empty-state__title');
    expect(h3.textContent.trim()).toBe('No results found');
  });

  it('default title is "Nothing here yet"', () => {
    const h3 = fixture.nativeElement.querySelector('.empty-state__title');
    expect(h3.textContent.trim()).toBe('Nothing here yet');
  });

  it('shows description when set', () => {
    fixture.componentRef.setInput('description', 'Try adjusting your filters.');
    fixture.detectChanges();
    const p = fixture.nativeElement.querySelector('.empty-state__desc');
    expect(p.textContent.trim()).toBe('Try adjusting your filters.');
  });

  it('hides description when empty', () => {
    fixture.componentRef.setInput('description', '');
    fixture.detectChanges();
    const p = fixture.nativeElement.querySelector('.empty-state__desc');
    expect(p).toBeNull();
  });

  it('applies compact class when compact=true', () => {
    fixture.componentRef.setInput('compact', true);
    fixture.detectChanges();
    const el = fixture.nativeElement.querySelector('.empty-state--compact');
    expect(el).not.toBeNull();
  });

  it('does not apply compact class when compact=false', () => {
    fixture.componentRef.setInput('compact', false);
    fixture.detectChanges();
    const el = fixture.nativeElement.querySelector('.empty-state--compact');
    expect(el).toBeNull();
  });

  it('default icon is "inbox"', () => {
    expect(component.icon).toBe('inbox');
  });
});
