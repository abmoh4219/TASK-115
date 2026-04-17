import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RoleBadgeComponent } from '../../../src/app/shared/components/role-badge/role-badge.component';

describe('RoleBadgeComponent', () => {
  let fixture: ComponentFixture<RoleBadgeComponent>;
  let component: RoleBadgeComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RoleBadgeComponent],
    }).compileComponents();
    fixture = TestBed.createComponent(RoleBadgeComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('shows nothing when role is null', () => {
    fixture.componentRef.setInput('role', null);
    fixture.detectChanges();
    const el = fixture.nativeElement.querySelector('.role-badge');
    expect(el).toBeNull();
  });

  it('shows "Admin" for admin role', () => {
    fixture.componentRef.setInput('role', 'admin');
    fixture.detectChanges();
    const el = fixture.nativeElement.querySelector('.role-badge');
    expect(el.textContent.trim()).toBe('Admin');
  });

  it('shows "Resident" for resident role', () => {
    fixture.componentRef.setInput('role', 'resident');
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.role-badge').textContent.trim()).toBe('Resident');
  });

  it('shows "Compliance" for compliance role', () => {
    fixture.componentRef.setInput('role', 'compliance');
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.role-badge').textContent.trim()).toBe('Compliance');
  });

  it('shows "Analyst" for analyst role', () => {
    fixture.componentRef.setInput('role', 'analyst');
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.role-badge').textContent.trim()).toBe('Analyst');
  });

  it('returns fallback config when role is null', () => {
    component.role = null;
    const cfg = component.config;
    expect(cfg.label).toBe('');
    expect(cfg.bg).toBe('#f3f4f6');
  });

  it('applies aria-label with role label', () => {
    fixture.componentRef.setInput('role', 'admin');
    fixture.detectChanges();
    const el = fixture.nativeElement.querySelector('.role-badge');
    expect(el.getAttribute('aria-label')).toBe('Role: Admin');
  });
});
