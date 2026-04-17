import { ComponentFixture, TestBed } from '@angular/core/testing';
import { StatCardComponent } from '../../../src/app/shared/components/stat-card/stat-card.component';
import { MatIconModule } from '@angular/material/icon';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';

describe('StatCardComponent', () => {
  let fixture: ComponentFixture<StatCardComponent>;
  let component: StatCardComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [StatCardComponent, MatIconModule, NoopAnimationsModule],
    }).compileComponents();
    fixture = TestBed.createComponent(StatCardComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('trendDirection is "up" when trend > 0', () => {
    component.trend = 5;
    expect(component.trendDirection).toBe('up');
  });

  it('trendDirection is "down" when trend < 0', () => {
    component.trend = -3;
    expect(component.trendDirection).toBe('down');
  });

  it('trendDirection is "flat" when trend is 0', () => {
    component.trend = 0;
    expect(component.trendDirection).toBe('flat');
  });

  it('trendDirection is "flat" when trend is null', () => {
    component.trend = null;
    expect(component.trendDirection).toBe('flat');
  });

  it('shows loading skeleton when loading=true', () => {
    fixture.componentRef.setInput('loading', true);
    fixture.detectChanges();
    const skeleton = fixture.nativeElement.querySelector('.skeleton--value');
    expect(skeleton).not.toBeNull();
  });

  it('shows value when not loading', () => {
    fixture.componentRef.setInput('loading', false);
    fixture.componentRef.setInput('value', '42');
    fixture.detectChanges();
    const text = fixture.nativeElement.querySelector('.stat-card__value').textContent;
    expect(text).toContain('42');
  });

  it('applies clickable class when clickable=true', () => {
    fixture.componentRef.setInput('clickable', true);
    fixture.detectChanges();
    const el = fixture.nativeElement.querySelector('.stat-card--clickable');
    expect(el).not.toBeNull();
  });

  it('does not apply clickable class when clickable=false', () => {
    fixture.componentRef.setInput('clickable', false);
    fixture.detectChanges();
    const el = fixture.nativeElement.querySelector('.stat-card--clickable');
    expect(el).toBeNull();
  });

  it('shows label', () => {
    fixture.componentRef.setInput('label', 'Total Residents');
    fixture.detectChanges();
    const text = fixture.nativeElement.querySelector('.stat-card__label').textContent;
    expect(text).toContain('Total Residents');
  });

  it('hides trend chip when trend is null', () => {
    fixture.componentRef.setInput('trend', null);
    fixture.detectChanges();
    const trendEl = fixture.nativeElement.querySelector('.stat-card__trend--up');
    expect(trendEl).toBeNull();
  });

  it('shows trend chip when trend > 0 and not loading', () => {
    fixture.componentRef.setInput('trend', 10);
    fixture.componentRef.setInput('trendLabel', '+10%');
    fixture.componentRef.setInput('loading', false);
    fixture.detectChanges();
    const trendEl = fixture.nativeElement.querySelector('.stat-card__trend--up');
    expect(trendEl).not.toBeNull();
  });
});
