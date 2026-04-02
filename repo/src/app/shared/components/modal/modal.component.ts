import {
  Component, Input, Output, EventEmitter,
  OnChanges, SimpleChanges, AfterViewInit,
  ElementRef, ViewChild, HostListener,
  ChangeDetectionStrategy, ChangeDetectorRef,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

export type ModalSize = 'sm' | 'md' | 'lg';
export type ModalType = 'default' | 'danger' | 'warning';

@Component({
  selector: 'app-modal',
  standalone: true,
  imports: [CommonModule, MatButtonModule, MatIconModule, MatProgressSpinnerModule],
  templateUrl: './modal.component.html',
  styleUrls: ['./modal.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ModalComponent implements OnChanges, AfterViewInit {

  // --------------------------------------------------
  // Inputs
  // --------------------------------------------------

  @Input() open = false;
  @Input() title = '';
  @Input() size: ModalSize = 'md';
  @Input() type: ModalType = 'default';
  @Input() confirmLabel = 'Confirm';
  @Input() cancelLabel = 'Cancel';
  @Input() loading = false;
  @Input() confirmDisabled = false;
  /** When true, only the confirm button is shown (no cancel). */
  @Input() confirmOnly = false;

  // --------------------------------------------------
  // Outputs
  // --------------------------------------------------

  @Output() confirmed  = new EventEmitter<void>();
  @Output() cancelled  = new EventEmitter<void>();

  // --------------------------------------------------
  // View refs
  // --------------------------------------------------

  @ViewChild('modalPanel') modalPanel?: ElementRef<HTMLDivElement>;
  @ViewChild('confirmBtn') confirmBtn?: ElementRef<HTMLButtonElement>;

  visible = false;
  animating = false;

  constructor(private cdr: ChangeDetectorRef) {}

  // --------------------------------------------------
  // Lifecycle
  // --------------------------------------------------

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['open']) {
      if (this.open) {
        this.visible = true;
        this.trapBodyScroll(true);
        requestAnimationFrame(() => {
          this.animating = true;
          this.cdr.markForCheck();
          // Focus the first focusable element
          setTimeout(() => this.focusFirst(), 50);
        });
      } else {
        this.animating = false;
        this.cdr.markForCheck();
        setTimeout(() => {
          this.visible = false;
          this.trapBodyScroll(false);
          this.cdr.markForCheck();
        }, 220);
      }
    }
  }

  ngAfterViewInit(): void {}

  // --------------------------------------------------
  // Keyboard handling
  // --------------------------------------------------

  @HostListener('document:keydown', ['$event'])
  onKeydown(event: KeyboardEvent): void {
    if (!this.open) return;

    if (event.key === 'Escape') {
      event.preventDefault();
      this.onCancel();
    }

    // Focus trap — keep Tab within modal
    if (event.key === 'Tab') {
      this.trapFocus(event);
    }
  }

  private trapFocus(event: KeyboardEvent): void {
    const panel = this.modalPanel?.nativeElement;
    if (!panel) return;

    const focusable = panel.querySelectorAll<HTMLElement>(
      'button:not(:disabled), [href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])',
    );
    if (focusable.length === 0) return;

    const first = focusable[0];
    const last  = focusable[focusable.length - 1];

    if (event.shiftKey) {
      if (document.activeElement === first) {
        event.preventDefault();
        last.focus();
      }
    } else {
      if (document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
  }

  private focusFirst(): void {
    const panel = this.modalPanel?.nativeElement;
    if (!panel) return;
    const first = panel.querySelector<HTMLElement>(
      'button:not(:disabled), [href], input:not(:disabled)',
    );
    first?.focus();
  }

  // --------------------------------------------------
  // Actions
  // --------------------------------------------------

  onConfirm(): void {
    if (this.loading || this.confirmDisabled) return;
    this.confirmed.emit();
  }

  onCancel(): void {
    if (this.loading) return;
    this.cancelled.emit();
  }

  onOverlayClick(event: MouseEvent): void {
    // Only close if clicking the overlay itself, not the panel
    if ((event.target as HTMLElement).classList.contains('modal-overlay')) {
      this.onCancel();
    }
  }

  // --------------------------------------------------
  // Helpers
  // --------------------------------------------------

  get iconForType(): string {
    switch (this.type) {
      case 'danger':  return 'error';
      case 'warning': return 'warning';
      default:        return '';
    }
  }

  get confirmColor(): string {
    return this.type === 'danger' ? 'warn' : 'primary';
  }

  private trapBodyScroll(lock: boolean): void {
    if (typeof document !== 'undefined') {
      document.body.style.overflow = lock ? 'hidden' : '';
    }
  }
}
