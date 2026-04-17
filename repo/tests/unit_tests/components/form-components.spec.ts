import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { MatIconModule } from '@angular/material/icon';
import { InputComponent } from '../../../src/app/shared/components/forms/input.component';
import { SelectComponent, SelectOption } from '../../../src/app/shared/components/forms/select.component';
import { TextareaComponent } from '../../../src/app/shared/components/forms/textarea.component';

// ── InputComponent ────────────────────────────────────────────────

describe('InputComponent', () => {
  let fixture: ComponentFixture<InputComponent>;
  let component: InputComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [InputComponent, MatIconModule, NoopAnimationsModule],
    }).compileComponents();
    fixture = TestBed.createComponent(InputComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('writeValue sets innerValue', () => {
    component.writeValue('hello');
    expect(component.innerValue).toBe('hello');
  });

  it('writeValue with null sets empty string', () => {
    component.writeValue(null as any);
    expect(component.innerValue).toBe('');
  });

  it('registerOnChange stores fn', () => {
    const fn = jest.fn();
    component.registerOnChange(fn);
    component.onValueChange('test');
    expect(fn).toHaveBeenCalledWith('test');
  });

  it('registerOnTouched stores fn', () => {
    const fn = jest.fn();
    component.registerOnTouched(fn);
    component.onTouched();
    expect(fn).toHaveBeenCalled();
  });

  it('setDisabledState disables component', () => {
    component.setDisabledState(true);
    expect(component.disabled).toBe(true);
  });

  it('clear() resets innerValue and calls onChange', () => {
    const fn = jest.fn();
    component.registerOnChange(fn);
    component.innerValue = 'some text';
    component.clear();
    expect(component.innerValue).toBe('');
    expect(fn).toHaveBeenCalledWith('');
  });

  it('has a unique fieldId', () => {
    const other = TestBed.createComponent(InputComponent).componentInstance;
    expect(component.fieldId).not.toBe(other.fieldId);
  });
});

// ── SelectComponent ───────────────────────────────────────────────

describe('SelectComponent', () => {
  let fixture: ComponentFixture<SelectComponent>;
  let component: SelectComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SelectComponent, MatIconModule, NoopAnimationsModule],
    }).compileComponents();
    fixture = TestBed.createComponent(SelectComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('writeValue sets innerValue', () => {
    component.writeValue('opt1');
    expect(component.innerValue).toBe('opt1');
  });

  it('registerOnChange stores fn and onValueChange calls it', () => {
    const fn = jest.fn();
    component.registerOnChange(fn);
    component.onValueChange('selected');
    expect(fn).toHaveBeenCalledWith('selected');
  });

  it('setDisabledState disables component', () => {
    component.setDisabledState(true);
    expect(component.disabled).toBe(true);
  });

  it('renders options', () => {
    const opts: SelectOption[] = [
      { value: 'a', label: 'Option A' },
      { value: 'b', label: 'Option B' },
    ];
    fixture.componentRef.setInput('options', opts);
    fixture.detectChanges();
    const optEls = fixture.nativeElement.querySelectorAll('option:not([disabled])');
    expect(optEls.length).toBe(2);
  });
});

// ── TextareaComponent ─────────────────────────────────────────────

describe('TextareaComponent', () => {
  let fixture: ComponentFixture<TextareaComponent>;
  let component: TextareaComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TextareaComponent, MatIconModule, NoopAnimationsModule],
    }).compileComponents();
    fixture = TestBed.createComponent(TextareaComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('writeValue sets innerValue', () => {
    component.writeValue('some text');
    expect(component.innerValue).toBe('some text');
  });

  it('registerOnChange works', () => {
    const fn = jest.fn();
    component.registerOnChange(fn);
    component.onValueChange('changed');
    expect(fn).toHaveBeenCalledWith('changed');
  });
});
