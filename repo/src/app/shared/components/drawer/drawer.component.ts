import {
  Component, Input, Output, EventEmitter,
  OnChanges, SimpleChanges, HostListener,
  ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'app-drawer',
  standalone: true,
  imports: [CommonModule, MatButtonModule, MatIconModule],
  templateUrl: './drawer.component.html',
  styleUrls: ['./drawer.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DrawerComponent implements OnChanges {

  @Input() open = false;
  @Input() title = '';
  @Input() subtitle = '';

  @Output() closed = new EventEmitter<void>();

  /** Controls CSS class for animation state */
  visible = false;
  animating = false;

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['open']) {
      if (this.open) {
        this.visible = true;
        // Allow DOM to render before triggering animation
        requestAnimationFrame(() => {
          this.animating = true;
        });
        this.trapBodyScroll(true);
      } else {
        this.animating = false;
        // Wait for CSS transition before hiding from DOM
        setTimeout(() => {
          this.visible = false;
          this.trapBodyScroll(false);
        }, 310);
      }
    }
  }

  @HostListener('document:keydown.escape')
  onEscKey(): void {
    if (this.open) this.close();
  }

  close(): void {
    this.closed.emit();
  }

  onBackdropClick(): void {
    this.close();
  }

  private trapBodyScroll(lock: boolean): void {
    if (typeof document !== 'undefined') {
      document.body.style.overflow = lock ? 'hidden' : '';
    }
  }
}
