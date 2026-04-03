import {
  Component, OnInit, OnDestroy, ChangeDetectionStrategy, ChangeDetectorRef,
} from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { Subscription, Subject, debounceTime, distinctUntilChanged } from 'rxjs';
import { Router } from '@angular/router';
import { SearchService, SearchResult, SearchFilters, SearchFacets } from '../../core/services/search.service';
import { ToastService } from '../../shared/components/toast/toast.service';

interface ActiveFilters {
  categories: Set<string>;
  buildings:  Set<string>;
  mediaTypes: Set<string>;
  from:       string;  // ISO date string from input
  to:         string;
}

@Component({
  selector: 'app-search',
  standalone: true,
  imports: [
    CommonModule, FormsModule,
    MatIconModule, MatButtonModule, MatCheckboxModule,
    MatExpansionModule, MatSelectModule, MatFormFieldModule, MatInputModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="search-page">

      <!-- ════════════════════════════════════════════
           HERO SECTION
      ═══════════════════════════════════════════════ -->
      <div class="search-hero">
        <div class="search-hero__card">
          <p class="search-hero__label">Search HarborPoint</p>

          <!-- Search input -->
          <div class="search-input-wrap" [class.search-input-wrap--focused]="inputFocused">
            <mat-icon class="search-icon">search</mat-icon>
            <input
              #queryInput
              class="search-input"
              type="text"
              placeholder="Search residents, courses, documents, messages…"
              [(ngModel)]="query"
              (input)="onQueryInput()"
              (keydown.enter)="doSearch()"
              (focus)="inputFocused=true"
              (blur)="inputFocused=false"
              autocomplete="off"
              spellcheck="false"
              aria-label="Search"
            />
            <button
              *ngIf="query"
              class="clear-btn"
              (click)="clearQuery()"
              aria-label="Clear search"
            >
              <mat-icon>close</mat-icon>
            </button>
          </div>

          <!-- Spell suggestion -->
          <div *ngIf="spellSuggestion" class="spell-suggestion">
            <mat-icon class="spell-icon">auto_fix_high</mat-icon>
            Did you mean:
            <button class="spell-btn" (click)="applySpellSuggestion()">
              {{ spellSuggestion }}
            </button>
          </div>

          <!-- Trending chips -->
          <div *ngIf="trendingTerms.length > 0 && !hasResults" class="trending-section">
            <span class="trending-label">Trending</span>
            <div class="trending-chips">
              <button
                *ngFor="let t of trendingTerms"
                class="trend-chip"
                (click)="searchTrend(t.term)"
              >{{ t.term }}</button>
            </div>
          </div>
        </div>
      </div>

      <!-- ════════════════════════════════════════════
           RESULTS AREA
      ═══════════════════════════════════════════════ -->
      <div *ngIf="hasSearched" class="search-body">

        <!-- Results header -->
        <div *ngIf="!isLoading" class="results-header">
          <span class="results-count">
            <strong>{{ results.length }}</strong>
            result{{ results.length !== 1 ? 's' : '' }} for
            <em>"{{ lastQuery }}"</em>
          </span>
        </div>

        <div class="search-layout">

          <!-- ── Filter sidebar ────────────────────── -->
          <aside class="filter-sidebar">
            <div class="filter-header">
              <span class="filter-title">Filters</span>
              <button class="clear-all-btn" (click)="clearFilters()">Clear all</button>
            </div>

            <mat-accordion multi>

              <!-- Category -->
              <mat-expansion-panel expanded>
                <mat-expansion-panel-header>
                  <mat-panel-title>Category</mat-panel-title>
                </mat-expansion-panel-header>
                <div class="filter-options">
                  <label *ngFor="let cat of facets.categories" class="filter-option">
                    <mat-checkbox
                      [checked]="activeFilters.categories.has(cat.value)"
                      (change)="toggleCategory(cat.value)"
                      color="primary"
                    >
                      <span class="filter-icon">{{ getCategoryIcon(cat.value) }}</span>
                      {{ cat.value | titlecase }}
                      <span class="filter-count">{{ cat.count }}</span>
                    </mat-checkbox>
                  </label>
                </div>
              </mat-expansion-panel>

              <!-- Building -->
              <mat-expansion-panel *ngIf="facets.buildings.length > 0" expanded>
                <mat-expansion-panel-header>
                  <mat-panel-title>Building</mat-panel-title>
                </mat-expansion-panel-header>
                <div class="filter-options">
                  <label *ngFor="let b of facets.buildings" class="filter-option">
                    <mat-checkbox
                      [checked]="activeFilters.buildings.has(b.value)"
                      (change)="toggleBuilding(b.value)"
                      color="primary"
                    >
                      <mat-icon class="filter-icon-mat">business</mat-icon>
                      {{ b.value }}
                      <span class="filter-count">{{ b.count }}</span>
                    </mat-checkbox>
                  </label>
                </div>
              </mat-expansion-panel>

              <!-- Date range -->
              <mat-expansion-panel>
                <mat-expansion-panel-header>
                  <mat-panel-title>Date Range</mat-panel-title>
                </mat-expansion-panel-header>
                <div class="date-range">
                  <mat-form-field appearance="outline" class="date-field">
                    <mat-label>From</mat-label>
                    <input matInput type="date" [(ngModel)]="activeFilters.from" (change)="applyFilters()" />
                  </mat-form-field>
                  <mat-form-field appearance="outline" class="date-field">
                    <mat-label>To</mat-label>
                    <input matInput type="date" [(ngModel)]="activeFilters.to" (change)="applyFilters()" />
                  </mat-form-field>
                </div>
              </mat-expansion-panel>

              <!-- Media type -->
              <mat-expansion-panel *ngIf="facets.mediaTypes.length > 0">
                <mat-expansion-panel-header>
                  <mat-panel-title>Media Type</mat-panel-title>
                </mat-expansion-panel-header>
                <div class="filter-options">
                  <label *ngFor="let mt of facets.mediaTypes" class="filter-option">
                    <mat-checkbox
                      [checked]="activeFilters.mediaTypes.has(mt.value)"
                      (change)="toggleMediaType(mt.value)"
                      color="primary"
                    >
                      <mat-icon class="filter-icon-mat">attach_file</mat-icon>
                      {{ mt.value }}
                      <span class="filter-count">{{ mt.count }}</span>
                    </mat-checkbox>
                  </label>
                </div>
              </mat-expansion-panel>

            </mat-accordion>
          </aside>

          <!-- ── Results pane ──────────────────────── -->
          <div class="results-pane">

            <!-- Loading skeletons -->
            <ng-container *ngIf="isLoading">
              <div *ngFor="let _ of [1,2,3,4]" class="result-card result-card--skeleton">
                <div class="skeleton-icon"></div>
                <div class="skeleton-content">
                  <div class="skeleton-line skeleton-line--title"></div>
                  <div class="skeleton-line skeleton-line--body"></div>
                  <div class="skeleton-line skeleton-line--meta"></div>
                </div>
              </div>
            </ng-container>

            <!-- Result cards -->
            <ng-container *ngIf="!isLoading">
              <div
                *ngFor="let r of filteredResults; let i = index"
                class="result-card"
                [style.animation-delay]="(i * 50) + 'ms'"
                (click)="openResult(r)"
              >
                <!-- Type icon -->
                <div class="result-icon" [class]="'result-icon--' + r.entry.category">
                  <mat-icon>{{ getCategoryMatIcon(r.entry.category) }}</mat-icon>
                </div>

                <!-- Content -->
                <div class="result-content">
                  <div
                    class="result-title"
                    [innerHTML]="highlight(r.entry.title, r.highlights)"
                  ></div>
                  <div
                    class="result-snippet"
                    [innerHTML]="highlight(getSnippet(r.entry.body), r.highlights)"
                  ></div>
                  <div class="result-meta">
                    <span *ngIf="r.entry.category" class="meta-chip meta-chip--category">
                      {{ r.entry.category }}
                    </span>
                    <span *ngIf="r.entry.building" class="meta-chip">
                      <mat-icon class="meta-icon">business</mat-icon>{{ r.entry.building }}
                    </span>
                    <span class="meta-chip">
                      <mat-icon class="meta-icon">schedule</mat-icon>{{ r.entry.createdAt | date:'mediumDate' }}
                    </span>
                  </div>
                </div>

                <!-- Arrow (hover) -->
                <mat-icon class="result-arrow">arrow_forward</mat-icon>
              </div>

              <!-- Zero results state -->
              <div *ngIf="filteredResults.length === 0 && !isLoading" class="zero-results">
                <div class="zero-results__illustration">
                  <svg viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg" class="zero-svg">
                    <circle cx="52" cy="52" r="36" stroke="#CBD5E1" stroke-width="6"/>
                    <line x1="79" y1="79" x2="104" y2="104" stroke="#CBD5E1" stroke-width="6" stroke-linecap="round"/>
                    <line x1="40" y1="52" x2="64" y2="52" stroke="#CBD5E1" stroke-width="4" stroke-linecap="round"/>
                    <line x1="52" y1="40" x2="52" y2="64" stroke="#CBD5E1" stroke-width="4" stroke-linecap="round"/>
                  </svg>
                </div>
                <h3 class="zero-results__title">No results for "{{ lastQuery }}"</h3>
                <p class="zero-results__sub">Try different keywords or adjust the filters.</p>

                <button
                  *ngIf="spellSuggestion"
                  class="spell-btn spell-btn--large"
                  (click)="applySpellSuggestion()"
                >
                  <mat-icon>auto_fix_high</mat-icon>
                  Did you mean "{{ spellSuggestion }}"?
                </button>

                <button
                  *ngIf="hasActiveFilters"
                  class="clear-filters-btn"
                  (click)="clearFilters()"
                >
                  <mat-icon>filter_list_off</mat-icon>
                  Clear filters
                </button>
              </div>
            </ng-container>

          </div>
        </div>
      </div>

    </div>
  `,
  styles: [`
    /* ── Page shell ─────────────────────────────── */
    .search-page {
      min-height: calc(100vh - 64px);
      background: var(--hp-bg, #F8FAFC);
      display: flex;
      flex-direction: column;
    }

    /* ── Hero ───────────────────────────────────── */
    .search-hero {
      padding: 3rem 2rem 2rem;
      background: linear-gradient(180deg, #fff 0%, var(--hp-bg, #F8FAFC) 100%);
      border-bottom: 1px solid var(--hp-border, #E2E8F0);
    }
    .search-hero__card {
      max-width: 700px;
      margin: 0 auto;
      text-align: center;
    }
    .search-hero__label {
      font-size: 0.7rem;
      font-weight: 700;
      letter-spacing: 0.12em;
      text-transform: uppercase;
      color: var(--hp-teal, #2DD4BF);
      margin: 0 0 1rem;
    }

    /* Input wrapper */
    .search-input-wrap {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      background: #fff;
      border: 2px solid var(--hp-border, #E2E8F0);
      border-radius: 14px;
      padding: 0 1rem;
      height: 56px;
      transition: border-color 200ms, box-shadow 200ms;
      box-shadow: 0 2px 8px rgba(0,0,0,0.06);
    }
    .search-input-wrap--focused {
      border-color: var(--hp-navy, #1E3A5F);
      box-shadow: 0 0 0 3px rgba(30,58,95,0.08);
    }
    .search-icon { color: #94A3B8; flex-shrink: 0; }
    .search-input {
      flex: 1;
      border: none;
      outline: none;
      font-size: 1.05rem;
      background: transparent;
      color: var(--hp-navy, #1E3A5F);
      font-family: inherit;
    }
    .search-input::placeholder { color: #94A3B8; }
    .clear-btn {
      background: none; border: none; cursor: pointer;
      display: flex; align-items: center;
      color: #94A3B8; padding: 4px;
      border-radius: 6px;
      transition: color 150ms, background 150ms;
    }
    .clear-btn:hover { color: var(--hp-navy, #1E3A5F); background: #F1F5F9; }

    /* Spell suggestion */
    .spell-suggestion {
      display: inline-flex;
      align-items: center;
      gap: 0.4rem;
      margin-top: 0.75rem;
      font-size: 0.875rem;
      color: #64748B;
    }
    .spell-icon { font-size: 16px; width: 16px; height: 16px; color: var(--hp-teal, #2DD4BF); }
    .spell-btn {
      background: rgba(45,212,191,0.12);
      color: var(--hp-teal, #2DD4BF);
      border: none;
      border-radius: 20px;
      padding: 2px 12px;
      font-size: 0.875rem;
      font-weight: 600;
      cursor: pointer;
      transition: background 150ms;
    }
    .spell-btn:hover { background: rgba(45,212,191,0.22); }
    .spell-btn--large {
      display: inline-flex; align-items: center; gap: 0.4rem;
      padding: 8px 20px; font-size: 0.95rem; margin-top: 1rem;
    }

    /* Trending */
    .trending-section {
      margin-top: 1.5rem;
      display: flex;
      align-items: center;
      gap: 0.75rem;
      flex-wrap: wrap;
      justify-content: center;
    }
    .trending-label {
      font-size: 0.75rem;
      font-weight: 600;
      color: #94A3B8;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      flex-shrink: 0;
    }
    .trending-chips {
      display: flex;
      gap: 0.5rem;
      overflow-x: auto;
      flex-wrap: wrap;
      justify-content: center;
    }
    .trend-chip {
      background: #F1F5F9;
      color: #475569;
      border: none;
      border-radius: 20px;
      padding: 4px 14px;
      font-size: 0.8rem;
      cursor: pointer;
      transition: background 150ms, color 150ms;
      white-space: nowrap;
    }
    .trend-chip:hover { background: rgba(45,212,191,0.12); color: var(--hp-teal, #2DD4BF); }

    /* ── Results layout ─────────────────────────── */
    .search-body { padding: 1.5rem 2rem 2rem; max-width: 1400px; margin: 0 auto; width: 100%; }

    .results-header {
      margin-bottom: 1rem;
    }
    .results-count {
      font-size: 0.9rem;
      color: #64748B;
    }
    .results-count strong { color: var(--hp-navy, #1E3A5F); }
    .results-count em { font-style: normal; font-weight: 600; }

    .search-layout {
      display: flex;
      gap: 1.5rem;
      align-items: flex-start;
    }

    /* ── Filter sidebar ─────────────────────────── */
    .filter-sidebar {
      width: 260px;
      min-width: 260px;
      background: #fff;
      border-radius: 12px;
      box-shadow: 0 1px 4px rgba(0,0,0,0.08);
      overflow: hidden;
      flex-shrink: 0;
    }
    .filter-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 1rem 1.25rem 0.75rem;
      border-bottom: 1px solid var(--hp-border, #E2E8F0);
    }
    .filter-title { font-size: 0.875rem; font-weight: 700; color: var(--hp-navy, #1E3A5F); }
    .clear-all-btn {
      background: none; border: none; cursor: pointer;
      color: var(--hp-teal, #2DD4BF); font-size: 0.8rem; font-weight: 600;
    }
    .filter-options { display: flex; flex-direction: column; gap: 0.25rem; padding: 0.25rem 0; }
    .filter-option { display: flex; align-items: center; font-size: 0.875rem; }
    .filter-icon { font-size: 1rem; margin-right: 0.25rem; }
    .filter-icon-mat { font-size: 16px; width: 16px; height: 16px; margin-right: 0.25rem; vertical-align: middle; }
    .filter-count { margin-left: auto; color: #94A3B8; font-size: 0.75rem; }
    .date-range { display: flex; flex-direction: column; gap: 0.5rem; }
    .date-field { width: 100%; }
    ::ng-deep .filter-sidebar .mat-expansion-panel { box-shadow: none !important; }
    ::ng-deep .filter-sidebar .mat-expansion-panel-header { padding: 0.75rem 1.25rem; }

    /* ── Results pane ───────────────────────────── */
    .results-pane { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 0.75rem; }

    /* Result card */
    .result-card {
      background: #fff;
      border-radius: 12px;
      box-shadow: 0 1px 4px rgba(0,0,0,0.07);
      padding: 1.25rem 1.5rem;
      display: flex;
      align-items: flex-start;
      gap: 1rem;
      cursor: pointer;
      transition: transform 180ms ease, box-shadow 180ms ease;
      animation: fadeSlideIn 300ms ease both;
    }
    .result-card:hover {
      transform: translateY(-2px);
      box-shadow: 0 6px 20px rgba(0,0,0,0.1);
      border-left: 3px solid #2dd4bf;
      background: #fafffe;
    }
    .result-card:hover .result-arrow { opacity: 1; transform: translateX(0); }

    @keyframes fadeSlideIn {
      from { opacity: 0; transform: translateY(10px); }
      to   { opacity: 1; transform: translateY(0); }
    }

    /* Type icon */
    .result-icon {
      width: 44px; height: 44px; border-radius: 50%;
      display: flex; align-items: center; justify-content: center;
      flex-shrink: 0;
      color: #fff;
    }
    .result-icon--resident  { background: var(--hp-teal, #2DD4BF); }
    .result-icon--course    { background: var(--hp-navy, #1E3A5F); }
    .result-icon--document  { background: #F59E0B; }
    .result-icon--message   { background: #8B5CF6; }
    .result-icon mat-icon   { font-size: 22px; width: 22px; height: 22px; }

    /* Content */
    .result-content { flex: 1; min-width: 0; }
    .result-title {
      font-size: 0.975rem;
      font-weight: 700;
      color: var(--hp-navy, #1E3A5F);
      margin-bottom: 0.25rem;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .result-snippet {
      font-size: 0.85rem;
      color: #64748B;
      margin-bottom: 0.5rem;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }
    ::ng-deep .result-title mark,
    ::ng-deep .result-snippet mark {
      background: rgba(45,212,191,0.22);
      color: inherit;
      border-radius: 2px;
      padding: 0 1px;
    }

    .result-meta { display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap; }
    .meta-chip {
      display: inline-flex; align-items: center; gap: 3px;
      background: #F1F5F9; color: #475569;
      border-radius: 20px; padding: 2px 10px;
      font-size: 0.72rem; font-weight: 500;
    }
    .meta-chip--category { background: rgba(30,58,95,0.08); color: var(--hp-navy, #1E3A5F); }
    .meta-icon { font-size: 12px; width: 12px; height: 12px; }

    /* Arrow */
    .result-arrow {
      color: #94A3B8; flex-shrink: 0;
      opacity: 0; transform: translateX(-4px);
      transition: opacity 180ms, transform 180ms;
    }

    /* Skeleton */
    .result-card--skeleton { cursor: default; }
    .result-card--skeleton:hover { transform: none; box-shadow: 0 1px 4px rgba(0,0,0,0.07); }
    .skeleton-icon {
      width: 44px; height: 44px; border-radius: 50%;
      background: linear-gradient(90deg, #F1F5F9 25%, #E2E8F0 50%, #F1F5F9 75%);
      background-size: 200% 100%;
      animation: shimmer 1.4s infinite;
      flex-shrink: 0;
    }
    .skeleton-content { flex: 1; display: flex; flex-direction: column; gap: 0.5rem; }
    .skeleton-line {
      border-radius: 6px;
      background: linear-gradient(90deg, #F1F5F9 25%, #E2E8F0 50%, #F1F5F9 75%);
      background-size: 200% 100%;
      animation: shimmer 1.4s infinite;
    }
    .skeleton-line--title { height: 16px; width: 55%; }
    .skeleton-line--body  { height: 13px; width: 85%; }
    .skeleton-line--meta  { height: 11px; width: 35%; }
    @keyframes shimmer {
      0%   { background-position:  200% 0; }
      100% { background-position: -200% 0; }
    }

    /* Zero results */
    .zero-results {
      display: flex; flex-direction: column; align-items: center;
      padding: 4rem 2rem; text-align: center;
    }
    .zero-results__illustration { margin-bottom: 1.5rem; }
    .zero-svg { width: 100px; height: 100px; }
    .zero-results__title { font-size: 1.25rem; font-weight: 700; color: var(--hp-navy, #1E3A5F); margin: 0 0 0.5rem; }
    .zero-results__sub { color: #94A3B8; margin: 0 0 1rem; font-size: 0.9rem; }
    .clear-filters-btn {
      display: inline-flex; align-items: center; gap: 0.4rem;
      background: none; border: 1px solid var(--hp-border, #E2E8F0);
      border-radius: 8px; padding: 8px 16px;
      color: #64748B; cursor: pointer; font-size: 0.875rem;
      transition: background 150ms, border-color 150ms;
      margin-top: 0.5rem;
    }
    .clear-filters-btn:hover { background: #F1F5F9; border-color: #94A3B8; }
  `],
})
export class SearchComponent implements OnInit, OnDestroy {

  query        = '';
  lastQuery    = '';
  isLoading    = false;
  hasSearched  = false;
  inputFocused = false;

  results:         SearchResult[] = [];
  filteredResults: SearchResult[] = [];
  facets:          SearchFacets   = { categories: [], buildings: [], mediaTypes: [] };
  trendingTerms:   { term: string; count: number }[] = [];
  spellSuggestion: string | null = null;

  activeFilters: ActiveFilters = {
    categories: new Set(),
    buildings:  new Set(),
    mediaTypes: new Set(),
    from: '',
    to:   '',
  };

  private query$    = new Subject<string>();
  private subs: Subscription[] = [];

  constructor(
    private searchSvc: SearchService,
    private toast:     ToastService,
    private router:    Router,
    private cdr:       ChangeDetectorRef,
    private sanitizer: DomSanitizer,
  ) {}

  get hasResults(): boolean { return this.results.length > 0; }

  get hasActiveFilters(): boolean {
    return this.activeFilters.categories.size > 0
      || this.activeFilters.buildings.size > 0
      || this.activeFilters.mediaTypes.size > 0
      || !!this.activeFilters.from
      || !!this.activeFilters.to;
  }

  ngOnInit(): void {
    this.loadFacets();
    this.loadTrending();

    // Debounced search-as-you-type
    this.subs.push(
      this.query$.pipe(debounceTime(350), distinctUntilChanged()).subscribe(q => {
        if (q.trim().length >= 2) this.doSearch();
      }),
    );
  }

  ngOnDestroy(): void {
    this.subs.forEach(s => s.unsubscribe());
  }

  onQueryInput(): void {
    this.query$.next(this.query);
  }

  async doSearch(): Promise<void> {
    const q = this.query.trim();
    if (!q) return;

    this.lastQuery  = q;
    this.isLoading  = true;
    this.hasSearched = true;
    this.spellSuggestion = null;
    this.cdr.markForCheck();

    try {
      const filters = this.buildFilters();
      this.results  = await this.searchSvc.search(q, undefined, filters);
      this.filteredResults = this.results;

      // Check spell suggestion if no results
      if (this.results.length === 0) {
        this.spellSuggestion = await this.searchSvc.getSpellSuggestion(q);
      }

      await this.loadFacets();
    } catch (err) {
      this.toast.error('Search failed. Please try again.');
    } finally {
      this.isLoading = false;
      this.cdr.markForCheck();
    }
  }

  clearQuery(): void {
    this.query       = '';
    this.hasSearched = false;
    this.results     = [];
    this.filteredResults = [];
    this.spellSuggestion = null;
    this.cdr.markForCheck();
  }

  applySpellSuggestion(): void {
    if (this.spellSuggestion) {
      this.query = this.spellSuggestion;
      this.doSearch();
    }
  }

  searchTrend(term: string): void {
    this.query = term;
    this.doSearch();
  }

  // ── Filters ─────────────────────────────────────

  toggleCategory(cat: string): void {
    if (this.activeFilters.categories.has(cat)) this.activeFilters.categories.delete(cat);
    else this.activeFilters.categories.add(cat);
    this.applyFilters();
  }

  toggleBuilding(b: string): void {
    if (this.activeFilters.buildings.has(b)) this.activeFilters.buildings.delete(b);
    else this.activeFilters.buildings.add(b);
    this.applyFilters();
  }

  toggleMediaType(mt: string): void {
    if (this.activeFilters.mediaTypes.has(mt)) this.activeFilters.mediaTypes.delete(mt);
    else this.activeFilters.mediaTypes.add(mt);
    this.applyFilters();
  }

  applyFilters(): void {
    const f = this.activeFilters;
    this.filteredResults = this.results.filter(r => {
      const e = r.entry;
      if (f.categories.size > 0 && !f.categories.has(e.category ?? '')) return false;
      if (f.buildings.size > 0  && !f.buildings.has(e.building ?? ''))  return false;
      if (f.mediaTypes.size > 0) {
        const mt = e.metadata?.['mimeType'] as string | undefined;
        if (!mt || !f.mediaTypes.has(mt)) return false;
      }
      if (f.from) {
        const from = new Date(f.from);
        if (e.createdAt < from) return false;
      }
      if (f.to) {
        const to = new Date(f.to);
        to.setHours(23, 59, 59, 999);
        if (e.createdAt > to) return false;
      }
      return true;
    });
    this.cdr.markForCheck();
  }

  clearFilters(): void {
    this.activeFilters = {
      categories: new Set(),
      buildings:  new Set(),
      mediaTypes: new Set(),
      from: '',
      to:   '',
    };
    this.filteredResults = this.results;
    this.cdr.markForCheck();
  }

  openResult(r: SearchResult): void {
    const type = r.entry.entityType;
    const id   = r.entry.entityId;
    switch (type) {
      case 'resident':
        this.router.navigate(['/residents'], { queryParams: { openId: id } });
        break;
      case 'course':
        this.router.navigate(['/enrollment'], { queryParams: { openId: id } });
        break;
      case 'message':
        this.router.navigate(['/messages'], { queryParams: { threadId: id } });
        break;
      case 'document':
        this.router.navigate(['/residents'], { queryParams: { openId: id, tab: 'documents' } });
        break;
      default:
        this.router.navigate(['/search']);
    }
  }

  // ── Helpers ──────────────────────────────────────

  highlight(text: string, terms: string[]): SafeHtml {
    if (!text || terms.length === 0) return this.sanitizer.bypassSecurityTrustHtml(this.escapeHtml(text ?? ''));
    let escaped = this.escapeHtml(text);
    for (const term of terms) {
      const re = new RegExp(`(${this.escapeRegex(term)})`, 'gi');
      escaped = escaped.replace(re, '<mark>$1</mark>');
    }
    return this.sanitizer.bypassSecurityTrustHtml(escaped);
  }

  getSnippet(body: string, maxLen = 150): string {
    if (!body) return '';
    return body.length > maxLen ? body.slice(0, maxLen) + '…' : body;
  }

  getCategoryIcon(cat?: string): string {
    const icons: Record<string, string> = {
      resident: '👤', course: '📚', document: '📄', message: '💬',
    };
    return icons[cat ?? ''] ?? '📋';
  }

  getCategoryMatIcon(cat?: string): string {
    const icons: Record<string, string> = {
      resident: 'person', course: 'school', document: 'description', message: 'chat',
    };
    return icons[cat ?? ''] ?? 'article';
  }

  private buildFilters(): SearchFilters {
    const f = this.activeFilters;
    const filters: SearchFilters = {};
    if (f.categories.size === 1) filters.category = [...f.categories][0];
    if (f.buildings.size === 1)  filters.building  = [...f.buildings][0];
    if (f.mediaTypes.size === 1) filters.mediaType  = [...f.mediaTypes][0];
    if (f.from) filters.from = new Date(f.from);
    if (f.to)   { const to = new Date(f.to); to.setHours(23, 59, 59, 999); filters.to = to; }
    return filters;
  }

  private async loadFacets(): Promise<void> {
    try {
      this.facets = await this.searchSvc.getFacets();
    } catch { /* non-critical */ }
    this.cdr.markForCheck();
  }

  private async loadTrending(): Promise<void> {
    try {
      this.trendingTerms = await this.searchSvc.getTrendingTerms(8);
    } catch { /* non-critical */ }
    this.cdr.markForCheck();
  }

  private escapeHtml(s: string): string {
    return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  private escapeRegex(s: string): string {
    return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
}
