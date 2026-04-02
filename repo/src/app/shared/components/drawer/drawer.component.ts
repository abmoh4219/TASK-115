import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { trigger, transition, style, animate } from '@angular/animations';

@Component({
  selector: 'app-drawer',
  standalone: true,
  imports: [CommonModule, MatButtonModule, MatIconModule],
  animations: [
    trigger('drawerAnim', [
      transition(':enter', [
        style({ transform: 'translateX(100%)' }),
        animate('250ms ease-out', style({ transform: 'translateX(0)' })),
      ]),
      transition(':leave', [
        animate('200ms ease-in', style({ transform: 'translateX(100%)' })),
      ]),
    ]),
    trigger('overlayAnim', [
      transition(':enter', [
        style({ opacity: 0 }),
        animate('200ms', style({ opacity: 1 })),
      ]),
      transition(':leave', [
        animate('200ms', style({ opacity: 0 })),
      ]),
    ]),
  ],
  template: `
    <ng-container *ngIf="open">
      <div [@overlayAnim] class="drawer-overlay" (click)="closeDrawer()" aria-hidden="true"></div>
      <div [@drawerAnim] class="drawer-panel" role="complementary" [attr.aria-label]="title">
        <div class="drawer-header">
          <h2 class="drawer-title">{{ title }}</h2>
          <button mat-icon-button (click)="closeDrawer()" aria-label="Close panel">
            <mat-icon>close</mat-icon>
          </button>
        </div>
        <div class="drawer-body">
          <ng-content></ng-content>
        </div>
      </div>
    </ng-container>
  `,
  styles: [`
    .drawer-overlay {
      position: fixed;
      inset: 0;
      background: rgba(0,0,0,0.4);
      z-index: 500;
    }
    .drawer-panel {
      position: fixed;
      top: 0;
      right: 0;
      bottom: 0;
      width: 480px;
      max-width: 95vw;
      background: var(--hp-white);
      z-index: 501;
      display: flex;
      flex-direction: column;
      box-shadow: -4px 0 24px rgba(0,0,0,0.15);
    }
    .drawer-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 1.25rem 1.5rem;
      border-bottom: 1px solid var(--hp-border);
      flex-shrink: 0;
    }
    .drawer-title {
      margin: 0;
      font-size: 1.125rem;
      color: var(--hp-navy);
    }
    .drawer-body {
      flex: 1;
      overflow-y: auto;
      padding: 1.5rem;
    }
  `],
})
export class DrawerComponent {
  @Input() open = false;
  @Input() title = '';
  @Output() closed = new EventEmitter<void>();

  closeDrawer(): void {
    this.closed.emit();
  }
}
