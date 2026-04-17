import { ComponentFixture, TestBed } from '@angular/core/testing';
import { StatusBadgeComponent } from '../../../src/app/shared/components/status-badge/status-badge.component';

describe('StatusBadgeComponent', () => {
  let fixture: ComponentFixture<StatusBadgeComponent>;
  let component: StatusBadgeComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [StatusBadgeComponent],
    }).compileComponents();
    fixture = TestBed.createComponent(StatusBadgeComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('defaults to neutral status', () => {
    expect(component.status).toBe('neutral');
    expect(component.config.label).toBe('Neutral');
  });

  it('returns correct config for active', () => {
    component.status = 'active';
    expect(component.config.label).toBe('Active');
    expect(component.config.bg).toBe('#dcfce7');
  });

  it('returns correct config for rejected', () => {
    component.status = 'rejected';
    expect(component.config.label).toBe('Rejected');
    expect(component.config.bg).toBe('#fee2e2');
  });

  it('returns fallback for unknown status', () => {
    component.status = 'nonexistent_status';
    expect(component.config.label).toBe('Unknown');
  });

  it('shows labelOverride when provided', () => {
    fixture.componentRef.setInput('status', 'active');
    fixture.componentRef.setInput('labelOverride', 'Custom Label');
    fixture.detectChanges();
    const text = fixture.nativeElement.querySelector('.status-badge').textContent;
    expect(text).toContain('Custom Label');
  });

  it('shows status label when labelOverride is empty', () => {
    fixture.componentRef.setInput('status', 'pending');
    fixture.componentRef.setInput('labelOverride', '');
    fixture.detectChanges();
    const text = fixture.nativeElement.querySelector('.status-badge').textContent;
    expect(text).toContain('Pending');
  });

  it('renders dot element', () => {
    fixture.detectChanges();
    const dot = fixture.nativeElement.querySelector('.status-badge__dot');
    expect(dot).not.toBeNull();
  });

  const allStatuses = [
    'active', 'inactive', 'pending', 'approved', 'rejected', 'pending_review',
    'enrolled', 'waitlisted', 'dropped', 'completed',
    'open', 'closed', 'cancelled', 'success', 'warning', 'error', 'neutral',
  ];

  allStatuses.forEach(status => {
    it(`config exists for status: ${status}`, () => {
      component.status = status;
      expect(component.config).toBeDefined();
      expect(component.config.label).toBeTruthy();
    });
  });
});
