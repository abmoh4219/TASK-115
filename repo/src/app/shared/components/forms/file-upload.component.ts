import {
  Component, Input, Output, EventEmitter,
  HostListener, ElementRef, ViewChild,
  ChangeDetectionStrategy, ChangeDetectorRef,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';

export interface FileValidationError {
  file: File;
  reason: 'size' | 'type';
}

@Component({
  selector: 'app-file-upload',
  standalone: true,
  imports: [CommonModule, MatIconModule, MatButtonModule],
  template: `
    <div
      class="hp-file-zone"
      [class.hp-file-zone--dragover]="isDragOver"
      [class.hp-file-zone--error]="errors.length > 0"
      (dragover)="onDragOver($event)"
      (dragleave)="onDragLeave()"
      (drop)="onDrop($event)"
      (click)="fileInput.click()"
      role="button"
      tabindex="0"
      (keydown.enter)="fileInput.click()"
      (keydown.space)="fileInput.click()"
      [attr.aria-label]="'Upload ' + label"
    >
      <input
        #fileInput
        type="file"
        class="hp-file-zone__input"
        [accept]="accept"
        [multiple]="multiple"
        (change)="onFileChange($event)"
        aria-hidden="true"
        tabindex="-1"
      />

      <mat-icon class="hp-file-zone__icon">{{ isDragOver ? 'file_download' : 'upload_file' }}</mat-icon>
      <p class="hp-file-zone__primary">
        <strong>{{ isDragOver ? 'Drop files here' : 'Drag & drop or click to browse' }}</strong>
      </p>
      <p class="hp-file-zone__hint">{{ hint }}</p>
    </div>

    <!-- Selected files list -->
    <ul *ngIf="selectedFiles.length > 0" class="hp-file-list" role="list">
      <li *ngFor="let f of selectedFiles; let i = index" class="hp-file-item">
        <mat-icon class="hp-file-item__icon">{{ iconForType(f.type) }}</mat-icon>
        <div class="hp-file-item__info">
          <span class="hp-file-item__name">{{ f.name }}</span>
          <span class="hp-file-item__size">{{ formatSize(f.size) }}</span>
        </div>
        <button
          class="hp-file-item__remove"
          type="button"
          (click)="removeFile(i, $event)"
          [attr.aria-label]="'Remove ' + f.name"
        >
          <mat-icon>close</mat-icon>
        </button>
      </li>
    </ul>

    <!-- Validation errors -->
    <ul *ngIf="errors.length > 0" class="hp-file-errors" role="alert">
      <li *ngFor="let e of errors" class="hp-file-error">
        <mat-icon>error_outline</mat-icon>
        <span>{{ e.file.name }}: {{ e.reason === 'size' ? 'File too large (max ' + maxSizeMB + ' MB)' : 'File type not allowed' }}</span>
      </li>
    </ul>
  `,
  styles: [`
    :host { display: block; }

    .hp-file-zone {
      border: 2px dashed #d1d5db;
      border-radius: 8px;
      padding: 2rem;
      text-align: center;
      cursor: pointer;
      transition: border-color 150ms, background 150ms;
      user-select: none;

      &:hover, &--dragover {
        border-color: #2dd4bf;
        background: rgba(45, 212, 191, 0.04);
      }

      &--error { border-color: #ef4444; }

      &__input { display: none; }
      &__icon { font-size: 2.5rem; width: 2.5rem; height: 2.5rem; color: #9ca3af; margin-bottom: 0.5rem; }
      &__primary { font-size: 0.875rem; color: #374151; margin: 0 0 0.25rem; }
      &__hint { font-size: 0.75rem; color: #9ca3af; margin: 0; }
    }

    .hp-file-list {
      list-style: none; margin: 0.75rem 0 0; padding: 0;
      display: flex; flex-direction: column; gap: 0.375rem;
    }

    .hp-file-item {
      display: flex; align-items: center; gap: 0.75rem;
      padding: 0.5rem 0.75rem; border: 1px solid #e5e7eb;
      border-radius: 6px; background: #f9fafb;

      &__icon { font-size: 1.25rem; width: 1.25rem; height: 1.25rem; color: #1e3a5f; flex-shrink: 0; }
      &__info { flex: 1; min-width: 0; display: flex; flex-direction: column; }
      &__name { font-size: 0.8125rem; color: #111827; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      &__size { font-size: 0.75rem; color: #9ca3af; }
      &__remove {
        display: inline-flex; align-items: center; justify-content: center;
        width: 24px; height: 24px; border: none; background: transparent;
        border-radius: 4px; cursor: pointer; color: #9ca3af; flex-shrink: 0;
        mat-icon { font-size: 1rem; width: 1rem; height: 1rem; }
        &:hover { background: #fee2e2; color: #ef4444; }
      }
    }

    .hp-file-errors {
      list-style: none; margin: 0.5rem 0 0; padding: 0;
      display: flex; flex-direction: column; gap: 0.25rem;
    }

    .hp-file-error {
      display: flex; align-items: center; gap: 0.375rem;
      font-size: 0.75rem; color: #ef4444;
      mat-icon { font-size: 0.875rem; width: 0.875rem; height: 0.875rem; flex-shrink: 0; }
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FileUploadComponent {
  @Input() label = 'files';
  @Input() accept = 'application/pdf,image/jpeg,image/png';
  @Input() multiple = false;
  @Input() maxSizeMB = 10;
  @Input() hint = 'PDF, JPG, PNG up to 10 MB';

  @Output() filesSelected = new EventEmitter<File[]>();
  @Output() validationErrors = new EventEmitter<FileValidationError[]>();

  @ViewChild('fileInput') fileInputRef?: ElementRef<HTMLInputElement>;

  isDragOver = false;
  selectedFiles: File[] = [];
  errors: FileValidationError[] = [];

  constructor(private cdr: ChangeDetectorRef) {}

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    this.isDragOver = true;
  }

  onDragLeave(): void {
    this.isDragOver = false;
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    this.isDragOver = false;
    const files = Array.from(event.dataTransfer?.files ?? []);
    this.processFiles(files);
  }

  onFileChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    const files = Array.from(input.files ?? []);
    this.processFiles(files);
    input.value = '';
  }

  removeFile(index: number, event: MouseEvent): void {
    event.stopPropagation();
    this.selectedFiles = this.selectedFiles.filter((_, i) => i !== index);
    this.filesSelected.emit([...this.selectedFiles]);
    this.cdr.markForCheck();
  }

  private processFiles(files: File[]): void {
    const maxBytes = this.maxSizeMB * 1024 * 1024;
    const allowedTypes = this.accept.split(',').map(t => t.trim());

    this.errors = [];
    const valid: File[] = [];

    for (const file of files) {
      if (file.size > maxBytes) {
        this.errors.push({ file, reason: 'size' });
        continue;
      }
      if (allowedTypes.length && !allowedTypes.includes(file.type)) {
        this.errors.push({ file, reason: 'type' });
        continue;
      }
      valid.push(file);
    }

    this.selectedFiles = this.multiple ? [...this.selectedFiles, ...valid] : valid;
    if (valid.length) this.filesSelected.emit([...this.selectedFiles]);
    if (this.errors.length) this.validationErrors.emit([...this.errors]);
    this.cdr.markForCheck();
  }

  iconForType(mime: string): string {
    if (mime === 'application/pdf') return 'picture_as_pdf';
    if (mime.startsWith('image/')) return 'image';
    return 'insert_drive_file';
  }

  formatSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }
}
