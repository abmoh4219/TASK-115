import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDialogModule } from '@angular/material/dialog';

@Component({
  selector: 'app-modal',
  standalone: true,
  imports: [CommonModule, MatButtonModule, MatIconModule, MatDialogModule],
  template: `
    <div *ngIf="open" class="modal-overlay" (click)="onOverlayClick($event)" role="dialog" [attr.aria-label]="title">
      <div class="modal-panel mat-elevation-z16" (click)="$event.stopPropagation()">
        <div class="modal-header">
          <div class="modal-header-left">
            <mat-icon *ngIf="icon" class="modal-icon modal-icon--{{ iconColor }}">{{ icon }}</mat-icon>
            <h2 class="modal-title">{{ title }}</h2>
          </div>
          <button *ngIf="dismissable" mat-icon-button (click)="cancel.emit()" aria-label="Close">
            <mat-icon>close</mat-icon>
          </button>
        </div>

        <div class="modal-body">
          <ng-content></ng-content>
        </div>

        <div *ngIf="showActions" class="modal-footer">
          <button *ngIf="cancelLabel" mat-stroked-button (click)="cancel.emit()" [disabled]="loading">
            {{ cancelLabel }}
          </button>
          <button
            mat-raised-button
            [color]="confirmColor"
            (click)="confirm.emit()"
            [disabled]="loading || confirmDisabled"
            class="modal-confirm-btn"
          >
            <mat-icon *ngIf="!loading">{{ confirmIcon }}</mat-icon>
            <mat-icon *ngIf="loading" class="spin">autorenew</mat-icon>
            {{ confirmLabel }}
          </button>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .modal-overlay {
      position: fixed;
      inset: 0;
      background: rgba(0,0,0,0.5);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 1000;
      padding: 1rem;
    }
    .modal-panel {
      background: var(--hp-white);
      border-radius: 12px;
      width: 100%;
      max-width: 500px;
      max-height: 90vh;
      overflow-y: auto;
    }
    .modal-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 1.25rem 1.5rem;
      border-bottom: 1px solid var(--hp-border);
    }
    .modal-header-left {
      display: flex;
      align-items: center;
      gap: 0.75rem;
    }
    .modal-icon { font-size: 1.5rem; }
    .modal-icon--warn    { color: var(--hp-warning); }
    .modal-icon--danger  { color: var(--hp-danger); }
    .modal-icon--info    { color: var(--hp-teal); }
    .modal-icon--success { color: var(--hp-success); }
    .modal-title {
      font-size: 1.125rem;
      color: var(--hp-navy);
      margin: 0;
    }
    .modal-body {
      padding: 1.5rem;
    }
    .modal-footer {
      display: flex;
      justify-content: flex-end;
      gap: 0.75rem;
      padding: 1rem 1.5rem;
      border-top: 1px solid var(--hp-border);
    }
    .spin {
      animation: spin 1s linear infinite;
    }
    @keyframes spin {
      from { transform: rotate(0deg); }
      to   { transform: rotate(360deg); }
    }
  `],
})
export class ModalComponent {
  @Input() open = false;
  @Input() title = '';
  @Input() icon = '';
  @Input() iconColor: 'warn' | 'danger' | 'info' | 'success' = 'info';
  @Input() cancelLabel = 'Cancel';
  @Input() confirmLabel = 'Confirm';
  @Input() confirmIcon = 'check';
  @Input() confirmColor: 'primary' | 'warn' | 'accent' = 'primary';
  @Input() confirmDisabled = false;
  @Input() loading = false;
  @Input() showActions = true;
  @Input() dismissable = true;

  @Output() confirm = new EventEmitter<void>();
  @Output() cancel  = new EventEmitter<void>();

  onOverlayClick(event: MouseEvent): void {
    if (this.dismissable) this.cancel.emit();
  }
}
