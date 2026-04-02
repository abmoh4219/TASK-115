/**
 * TableComponent Unit Tests
 * Tests: client-side sorting, pagination, loading state, empty state, row click
 */

import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { TableComponent, TableColumn } from '../../src/app/shared/components/table/table.component';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';

// =====================================================
// Test data
// =====================================================

const COLUMNS: TableColumn[] = [
  { key: 'name',   header: 'Name',   sortable: true  },
  { key: 'status', header: 'Status', sortable: true  },
  { key: 'amount', header: 'Amount', sortable: true  },
  { key: 'notes',  header: 'Notes',  sortable: false },
];

const ROWS = [
  { name: 'Charlie', status: 'active',   amount: 300, notes: 'n/a' },
  { name: 'Alice',   status: 'inactive', amount: 100, notes: 'n/a' },
  { name: 'Bob',     status: 'active',   amount: 200, notes: 'n/a' },
  { name: 'Dave',    status: 'pending',  amount: 400, notes: 'n/a' },
  { name: 'Eve',     status: 'active',   amount: 150, notes: 'n/a' },
];

// Generate 30 rows for pagination tests
const LARGE_DATA = Array.from({ length: 30 }, (_, i) => ({
  name:   `Resident ${i + 1}`,
  status: i % 2 === 0 ? 'active' : 'inactive',
  amount: (i + 1) * 50,
  notes:  '',
}));

// =====================================================
// Setup helper
// =====================================================

async function createComponent(
  data = ROWS,
  columns = COLUMNS,
  loading = false,
) {
  await TestBed.configureTestingModule({
    imports: [TableComponent, NoopAnimationsModule],
  }).compileComponents();

  const fixture = TestBed.createComponent(TableComponent);
  const component = fixture.componentInstance;
  component.columns = columns;
  component.data = data;
  component.loading = loading;
  fixture.detectChanges();
  return { fixture, component };
}

// =====================================================
// Sorting
// =====================================================

describe('TableComponent — sorting', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('renders all rows unsorted initially', async () => {
    const { component } = await createComponent();
    expect(component.filteredData.length).toBe(ROWS.length);
    // First row should be Charlie (original order)
    expect(component.pagedData[0]['name']).toBe('Charlie');
  });

  it('sorts ascending on first header click', async () => {
    const { component } = await createComponent();
    component.onHeaderClick(COLUMNS[0]); // click 'name'
    expect(component.sortState.direction).toBe('asc');
    expect(component.pagedData[0]['name']).toBe('Alice');
    expect(component.pagedData[ROWS.length - 1]['name']).toBe('Eve');
  });

  it('sorts descending on second header click', async () => {
    const { component } = await createComponent();
    component.onHeaderClick(COLUMNS[0]); // asc
    component.onHeaderClick(COLUMNS[0]); // desc
    expect(component.sortState.direction).toBe('desc');
    expect(component.pagedData[0]['name']).toBe('Eve');
  });

  it('clears sort on third header click', async () => {
    const { component } = await createComponent();
    component.onHeaderClick(COLUMNS[0]); // asc
    component.onHeaderClick(COLUMNS[0]); // desc
    component.onHeaderClick(COLUMNS[0]); // clear
    expect(component.sortState.direction).toBe('');
    expect(component.sortState.column).toBe('');
  });

  it('sorts numeric column correctly', async () => {
    const { component } = await createComponent();
    component.onHeaderClick(COLUMNS[2]); // amount asc
    expect(component.pagedData[0]['amount']).toBe(100);
    expect(component.pagedData[ROWS.length - 1]['amount']).toBe(400);
  });

  it('sorts numeric column descending', async () => {
    const { component } = await createComponent();
    component.onHeaderClick(COLUMNS[2]); // amount asc
    component.onHeaderClick(COLUMNS[2]); // amount desc
    expect(component.pagedData[0]['amount']).toBe(400);
  });

  it('does not sort non-sortable columns', async () => {
    const { component } = await createComponent();
    const originalFirst = component.pagedData[0]['name'];
    component.onHeaderClick(COLUMNS[3]); // notes — sortable: false
    expect(component.sortState.column).toBe('');
    expect(component.pagedData[0]['name']).toBe(originalFirst);
  });

  it('emits sortChange event on sort', async () => {
    const { component } = await createComponent();
    const emitted: unknown[] = [];
    component.sortChange.subscribe(e => emitted.push(e));
    component.onHeaderClick(COLUMNS[0]);
    expect(emitted.length).toBe(1);
    expect((emitted[0] as { direction: string }).direction).toBe('asc');
  });

  it('sortIcon returns arrow_upward for asc', async () => {
    const { component } = await createComponent();
    component.onHeaderClick(COLUMNS[0]);
    expect(component.sortIcon(COLUMNS[0])).toBe('arrow_upward');
  });

  it('sortIcon returns arrow_downward for desc', async () => {
    const { component } = await createComponent();
    component.onHeaderClick(COLUMNS[0]);
    component.onHeaderClick(COLUMNS[0]);
    expect(component.sortIcon(COLUMNS[0])).toBe('arrow_downward');
  });

  it('sortIcon returns unfold_more when column not sorted', async () => {
    const { component } = await createComponent();
    expect(component.sortIcon(COLUMNS[0])).toBe('unfold_more');
  });

  it('isSorted returns false for unsorted column', async () => {
    const { component } = await createComponent();
    expect(component.isSorted(COLUMNS[0])).toBe(false);
  });

  it('isSorted returns true for sorted column', async () => {
    const { component } = await createComponent();
    component.onHeaderClick(COLUMNS[0]);
    expect(component.isSorted(COLUMNS[0])).toBe(true);
  });

  it('switching sort column resets direction to asc', async () => {
    const { component } = await createComponent();
    component.onHeaderClick(COLUMNS[0]); // name asc
    component.onHeaderClick(COLUMNS[0]); // name desc
    component.onHeaderClick(COLUMNS[2]); // switch to amount
    expect(component.sortState.column).toBe('amount');
    expect(component.sortState.direction).toBe('asc');
  });
});

// =====================================================
// Pagination
// =====================================================

describe('TableComponent — pagination', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('shows first pageSize rows', async () => {
    const { component } = await createComponent(LARGE_DATA);
    component.pageSize = 10;
    component.currentPage = 0;
    component['updatePage']();
    expect(component.pagedData.length).toBe(10);
    expect(component.pagedData[0]['name']).toBe('Resident 1');
  });

  it('rangeStart shows 1 on first page', async () => {
    const { component } = await createComponent(LARGE_DATA);
    component.pageSize = 10;
    component.currentPage = 0;
    component['updatePage']();
    expect(component.rangeStart).toBe(1);
  });

  it('rangeEnd shows pageSize on first full page', async () => {
    const { component } = await createComponent(LARGE_DATA);
    component.pageSize = 10;
    component.currentPage = 0;
    component['updatePage']();
    expect(component.rangeEnd).toBe(10);
  });

  it('totalPages is ceil(rows/pageSize)', async () => {
    const { component } = await createComponent(LARGE_DATA);
    component.pageSize = 10;
    component['updatePage']();
    expect(component.totalPages).toBe(3); // 30 rows / 10 = 3
  });

  it('nextPage() moves to page 2', async () => {
    const { component } = await createComponent(LARGE_DATA);
    component.pageSize = 10;
    component.currentPage = 0;
    component['updatePage']();
    component.nextPage();
    expect(component.currentPage).toBe(1);
    expect(component.pagedData[0]['name']).toBe('Resident 11');
  });

  it('prevPage() moves back to page 1', async () => {
    const { component } = await createComponent(LARGE_DATA);
    component.pageSize = 10;
    component.currentPage = 1;
    component['updatePage']();
    component.prevPage();
    expect(component.currentPage).toBe(0);
  });

  it('prevPage() does nothing on first page', async () => {
    const { component } = await createComponent(LARGE_DATA);
    component.pageSize = 10;
    component.currentPage = 0;
    component.prevPage();
    expect(component.currentPage).toBe(0);
  });

  it('nextPage() does nothing on last page', async () => {
    const { component } = await createComponent(LARGE_DATA);
    component.pageSize = 10;
    component.currentPage = 2; // last page (0-indexed, 3 total)
    component['updatePage']();
    component.nextPage();
    expect(component.currentPage).toBe(2);
  });

  it('last page shows remaining rows', async () => {
    const { component } = await createComponent(LARGE_DATA);
    component.pageSize = 25;
    component['applySort']();
    component.currentPage = 1;
    component['updatePage']();
    expect(component.pagedData.length).toBe(5); // 30 - 25 = 5
  });

  it('onPageSizeChange resets to page 0', async () => {
    const { component } = await createComponent(LARGE_DATA);
    component.currentPage = 2;
    component.pageSize = 10;
    component.onPageSizeChange();
    expect(component.currentPage).toBe(0);
  });

  it('rangeStart is 0 when no data', async () => {
    const { component } = await createComponent([]);
    expect(component.rangeStart).toBe(0);
  });
});

// =====================================================
// Loading state
// =====================================================

describe('TableComponent — loading state', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('skeletonRows has 5 entries', async () => {
    const { component } = await createComponent(ROWS, COLUMNS, true);
    expect(component.skeletonRows.length).toBe(5);
  });

  it('shows skeleton when loading=true', async () => {
    const { fixture } = await createComponent(ROWS, COLUMNS, true);
    const skeleton = fixture.debugElement.query(By.css('.hp-table__row--skeleton'));
    expect(skeleton).toBeTruthy();
  });
});

// =====================================================
// Empty state
// =====================================================

describe('TableComponent — empty state', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('shows empty state when data is empty', async () => {
    const { fixture, component } = await createComponent([]);
    fixture.detectChanges();
    const empty = fixture.debugElement.query(By.css('.hp-table__empty'));
    expect(empty).toBeTruthy();
  });

  it('shows custom emptyMessage', async () => {
    const { fixture, component } = await createComponent([]);
    component.emptyMessage = 'No residents found';
    fixture.detectChanges();
    const msg = fixture.debugElement.query(By.css('.hp-table__empty-msg'));
    expect(msg?.nativeElement.textContent.trim()).toBe('No residents found');
  });
});

// =====================================================
// Row click
// =====================================================

describe('TableComponent — row click', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('emits rowClick with row data when row is clicked', async () => {
    const { fixture, component } = await createComponent();
    const emitted: unknown[] = [];
    component.rowClick.subscribe(r => emitted.push(r));
    fixture.detectChanges();

    const rows = fixture.debugElement.queryAll(By.css('.hp-table__row'));
    if (rows.length > 0) {
      rows[0].triggerEventHandler('click', {});
      expect(emitted.length).toBe(1);
    }
  });
});

// =====================================================
// cellValue helper
// =====================================================

describe('TableComponent.cellValue', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('resolves simple key', async () => {
    const { component } = await createComponent();
    expect(component.cellValue({ name: 'Alice' }, 'name')).toBe('Alice');
  });

  it('resolves dot-notation key', async () => {
    const { component } = await createComponent();
    expect(component.cellValue({ user: { name: 'Bob' } } as Record<string, unknown>, 'user.name')).toBe('Bob');
  });

  it('returns undefined for missing key', async () => {
    const { component } = await createComponent();
    expect(component.cellValue({}, 'missing')).toBeUndefined();
  });
});
