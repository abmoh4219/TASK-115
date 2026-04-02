import {
  Component, Input, Output, EventEmitter,
  OnChanges, SimpleChanges, ContentChildren,
  QueryList, TemplateRef, AfterContentInit,
  ChangeDetectionStrategy, ChangeDetectorRef,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatTooltipModule } from '@angular/material/tooltip';

// =====================================================
// Public interfaces
// =====================================================

export interface TableColumn {
  key: string;
  header: string;
  sortable?: boolean;
  width?: string;
  /** Optional custom cell template, referenced by key in parent */
  template?: TemplateRef<{ $implicit: unknown; row: Record<string, unknown> }>;
}

export type SortDirection = 'asc' | 'desc' | '';

export interface SortState {
  column: string;
  direction: SortDirection;
}

// =====================================================
// Component
// =====================================================

@Component({
  selector: 'app-table',
  standalone: true,
  imports: [
    CommonModule, FormsModule,
    MatButtonModule, MatIconModule,
    MatSelectModule, MatFormFieldModule,
    MatTooltipModule,
  ],
  templateUrl: './table.component.html',
  styleUrls: ['./table.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TableComponent implements OnChanges, AfterContentInit {

  // --------------------------------------------------
  // Inputs
  // --------------------------------------------------

  @Input() columns: TableColumn[] = [];
  @Input() data: Record<string, unknown>[] = [];
  @Input() loading = false;
  @Input() emptyMessage = 'No records found';
  @Input() emptyIcon = 'inbox';

  // --------------------------------------------------
  // Outputs
  // --------------------------------------------------

  @Output() rowClick = new EventEmitter<Record<string, unknown>>();
  @Output() sortChange = new EventEmitter<SortState>();

  // --------------------------------------------------
  // Internal state
  // --------------------------------------------------

  sortState: SortState = { column: '', direction: '' };

  pageSize = 25;
  pageSizeOptions = [10, 25, 50, 100];
  currentPage = 0;

  filteredData: Record<string, unknown>[] = [];
  pagedData:    Record<string, unknown>[] = [];
  skeletonRows = Array(5).fill(null);

  constructor(private cdr: ChangeDetectorRef) {}

  // --------------------------------------------------
  // Lifecycle
  // --------------------------------------------------

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['data'] || changes['columns']) {
      this.applySort();
    }
  }

  ngAfterContentInit(): void {}

  // --------------------------------------------------
  // Sorting
  // --------------------------------------------------

  onHeaderClick(col: TableColumn): void {
    if (!col.sortable) return;
    const key = col.key;

    if (this.sortState.column === key) {
      if (this.sortState.direction === 'asc')  this.sortState = { column: key, direction: 'desc' };
      else if (this.sortState.direction === 'desc') this.sortState = { column: '', direction: '' };
      else this.sortState = { column: key, direction: 'asc' };
    } else {
      this.sortState = { column: key, direction: 'asc' };
    }

    this.currentPage = 0;
    this.applySort();
    this.sortChange.emit({ ...this.sortState });
  }

  private applySort(): void {
    let sorted = [...(this.data ?? [])];

    if (this.sortState.column && this.sortState.direction) {
      const dir = this.sortState.direction === 'asc' ? 1 : -1;
      const key = this.sortState.column;
      sorted.sort((a, b) => {
        const av = a[key] ?? '';
        const bv = b[key] ?? '';
        // Numeric sort if both values coerce to numbers
        const an = Number(av), bn = Number(bv);
        if (!isNaN(an) && !isNaN(bn)) return (an - bn) * dir;
        return String(av).localeCompare(String(bv)) * dir;
      });
    }

    this.filteredData = sorted;
    this.updatePage();
    this.cdr.markForCheck();
  }

  // --------------------------------------------------
  // Pagination
  // --------------------------------------------------

  get totalPages(): number {
    return Math.ceil(this.filteredData.length / this.pageSize);
  }

  get rangeStart(): number {
    return this.filteredData.length === 0 ? 0 : this.currentPage * this.pageSize + 1;
  }

  get rangeEnd(): number {
    return Math.min((this.currentPage + 1) * this.pageSize, this.filteredData.length);
  }

  prevPage(): void {
    if (this.currentPage > 0) {
      this.currentPage--;
      this.updatePage();
    }
  }

  nextPage(): void {
    if (this.currentPage < this.totalPages - 1) {
      this.currentPage++;
      this.updatePage();
    }
  }

  onPageSizeChange(): void {
    this.currentPage = 0;
    this.updatePage();
  }

  private updatePage(): void {
    const start = this.currentPage * this.pageSize;
    this.pagedData = this.filteredData.slice(start, start + this.pageSize);
    this.cdr.markForCheck();
  }

  // --------------------------------------------------
  // Helpers for template
  // --------------------------------------------------

  sortIcon(col: TableColumn): string {
    if (!col.sortable) return '';
    if (this.sortState.column !== col.key) return 'unfold_more';
    return this.sortState.direction === 'asc' ? 'arrow_upward' : 'arrow_downward';
  }

  isSorted(col: TableColumn): boolean {
    return this.sortState.column === col.key && this.sortState.direction !== '';
  }

  cellValue(row: Record<string, unknown>, key: string): unknown {
    // Support dot-notation keys: e.g. "user.name"
    return key.split('.').reduce((obj: unknown, k) => {
      return obj && typeof obj === 'object' ? (obj as Record<string, unknown>)[k] : undefined;
    }, row);
  }

  trackByIndex(index: number): number {
    return index;
  }
}
