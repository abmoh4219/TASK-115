import {
  Component, Input, Output, EventEmitter,
  OnChanges, SimpleChanges,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatTableModule } from '@angular/material/table';
import { MatSortModule, Sort } from '@angular/material/sort';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';

export interface TableColumn {
  key: string;
  label: string;
  sortable?: boolean;
  width?: string;
}

@Component({
  selector: 'app-table',
  standalone: true,
  imports: [
    CommonModule, FormsModule,
    MatTableModule, MatSortModule, MatPaginatorModule,
    MatIconModule, MatButtonModule, MatInputModule, MatFormFieldModule,
  ],
  template: `
    <div class="table-wrapper">
      <!-- Search bar (optional) -->
      <div *ngIf="searchable" class="table-toolbar">
        <mat-form-field appearance="outline" class="table-search">
          <mat-label>Search</mat-label>
          <input matInput [(ngModel)]="searchText" (input)="onSearch()" placeholder="Filter results...">
          <mat-icon matSuffix>search</mat-icon>
        </mat-form-field>
      </div>

      <!-- Table -->
      <div class="table-scroll">
        <table mat-table [dataSource]="pagedRows" matSort (matSortChange)="onSort($event)" class="hp-table">
          <ng-container *ngFor="let col of columns" [matColumnDef]="col.key">
            <th mat-header-cell *matHeaderCellDef [mat-sort-header]="col.sortable ? col.key : ''" [style.width]="col.width">
              {{ col.label }}
            </th>
            <td mat-cell *matCellDef="let row">
              {{ row[col.key] }}
            </td>
          </ng-container>

          <!-- Actions column -->
          <ng-container matColumnDef="_actions">
            <th mat-header-cell *matHeaderCellDef class="col-actions">Actions</th>
            <td mat-cell *matCellDef="let row" class="col-actions">
              <ng-content select="[table-actions]"></ng-content>
            </td>
          </ng-container>

          <tr mat-header-row *matHeaderRowDef="displayedColumns; sticky: true"></tr>
          <tr
            mat-row
            *matRowDef="let row; columns: displayedColumns;"
            [class.row-clickable]="rowClickable"
            (click)="rowClick.emit(row)"
          ></tr>

          <!-- Empty state -->
          <tr class="mat-row" *matNoDataRow>
            <td [colSpan]="displayedColumns.length" class="table-empty">
              <div class="hp-empty-state">
                <mat-icon class="hp-empty-icon">inbox</mat-icon>
                <h3>{{ emptyMessage }}</h3>
              </div>
            </td>
          </tr>
        </table>
      </div>

      <!-- Paginator -->
      <mat-paginator
        *ngIf="paginate"
        [length]="filteredRows.length"
        [pageSize]="pageSize"
        [pageSizeOptions]="[10, 25, 50, 100]"
        (page)="onPage($event)"
        showFirstLastButtons
      ></mat-paginator>
    </div>
  `,
  styles: [`
    .table-wrapper { display: flex; flex-direction: column; }
    .table-toolbar { padding: 1rem 0 0.5rem; }
    .table-search { max-width: 320px; }
    .table-scroll { overflow-x: auto; }
    .hp-table { width: 100%; }
    .row-clickable { cursor: pointer; }
    .row-clickable:hover { background: var(--hp-bg); }
    .table-empty { padding: 0; }
    .col-actions { width: 120px; text-align: right; }
    th.mat-header-cell { color: var(--hp-text-muted); font-weight: 600; font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.05em; }
  `],
})
export class TableComponent implements OnChanges {
  @Input() columns: TableColumn[] = [];
  @Input() rows: Record<string, unknown>[] = [];
  @Input() searchable = false;
  @Input() paginate = true;
  @Input() pageSize = 25;
  @Input() rowClickable = false;
  @Input() showActions = false;
  @Input() emptyMessage = 'No data available';

  @Output() rowClick = new EventEmitter<Record<string, unknown>>();

  displayedColumns: string[] = [];
  filteredRows: Record<string, unknown>[] = [];
  pagedRows: Record<string, unknown>[] = [];
  searchText = '';
  private currentPage = 0;
  private sortState: Sort = { active: '', direction: '' };

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['columns']) {
      this.displayedColumns = [
        ...this.columns.map(c => c.key),
        ...(this.showActions ? ['_actions'] : []),
      ];
    }
    if (changes['rows']) {
      this.filteredRows = [...this.rows];
      this.updatePage();
    }
  }

  onSearch(): void {
    const q = this.searchText.toLowerCase();
    this.filteredRows = q
      ? this.rows.filter(r =>
          Object.values(r).some(v => String(v).toLowerCase().includes(q))
        )
      : [...this.rows];
    this.currentPage = 0;
    this.updatePage();
  }

  onSort(sort: Sort): void {
    this.sortState = sort;
    if (!sort.active || sort.direction === '') {
      this.filteredRows = [...this.rows];
    } else {
      this.filteredRows = [...this.filteredRows].sort((a, b) => {
        const valA = a[sort.active];
        const valB = b[sort.active];
        const cmp = String(valA) < String(valB) ? -1 : String(valA) > String(valB) ? 1 : 0;
        return sort.direction === 'asc' ? cmp : -cmp;
      });
    }
    this.updatePage();
  }

  onPage(event: PageEvent): void {
    this.currentPage = event.pageIndex;
    this.pageSize = event.pageSize;
    this.updatePage();
  }

  private updatePage(): void {
    if (!this.paginate) {
      this.pagedRows = this.filteredRows;
      return;
    }
    const start = this.currentPage * this.pageSize;
    this.pagedRows = this.filteredRows.slice(start, start + this.pageSize);
  }
}
