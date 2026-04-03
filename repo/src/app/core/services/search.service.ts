import { Injectable } from '@angular/core';
import { DbService, SearchIndexEntry, SearchDictionaryEntry } from './db.service';
import { AnomalyService } from './anomaly.service';

export interface SearchFilters {
  category?:  string;
  building?:  string;
  mediaType?: string;
  from?:      Date;
  to?:        Date;
}

export interface SearchResult {
  entry:          SearchIndexEntry;
  score:          number;
  highlights:     string[];   // matched terms for highlighting
}

export interface SearchFacets {
  categories: { value: string; count: number }[];
  buildings:  { value: string; count: number }[];
  mediaTypes: { value: string; count: number }[];
}

// Lunr.js — use require() so it works under both Jest/CommonJS and esbuild/ESM
declare const require: (id: string) => any;
const lunr: (config: (this: import('lunr').Builder) => void) => import('lunr').Index
  = require('lunr');

// =====================================================
// SearchService — Lunr.js full-text + facets + synonyms
// =====================================================

@Injectable({ providedIn: 'root' })
export class SearchService {

  private _lunrIndex: import('lunr').Index | null = null;
  private _indexedEntries: SearchIndexEntry[] = [];

  constructor(
    private db:      DbService,
    private anomaly: AnomalyService,
  ) {}

  // --------------------------------------------------
  // Index Management
  // --------------------------------------------------

  /**
   * Build an in-memory Lunr index from the searchIndex store.
   * Call this once after DB is populated, and whenever entries change.
   */
  async buildIndex(): Promise<void> {
    // Exclude internal _trending entries from the search index
    this._indexedEntries = await this.db.searchIndex
      .filter(e => e.entityType !== '_trending')
      .toArray();

    const entries = this._indexedEntries;

    this._lunrIndex = lunr(function () {
      this.field('title',    { boost: 10 });
      this.field('body',     { boost:  5 });
      this.field('tags',     { boost:  3 });
      this.field('category', { boost:  2 });
      this.field('building');
      this.ref('id');

      for (const entry of entries) {
        this.add({
          id:       String(entry.id ?? entry.entityId),
          title:    entry.title ?? '',
          body:     entry.body  ?? '',
          tags:     (entry.tags ?? []).join(' '),
          category: entry.category ?? '',
          building: entry.building ?? '',
        });
      }
    });
  }

  // --------------------------------------------------
  // Search
  // --------------------------------------------------

  /**
   * Full search pipeline:
   *   1. recordSearch (anomaly detection)
   *   2. Synonym expand query
   *   3. Lunr full-text search
   *   4. Spell-correction fallback (if 0 results)
   *   5. Zero-results log
   *   6. Facet filter
   *   7. Trend tracking
   */
  async search(
    query:   string,
    userId?: number,
    filters?: SearchFilters,
  ): Promise<SearchResult[]> {
    this.anomaly.recordSearch();

    const trimmed = query.trim();
    if (!trimmed) return [];

    // Rebuild index if stale
    if (!this._lunrIndex) await this.buildIndex();

    // Synonym expansion
    const { expandedTerms, spellSuggestion } = await this.expandQuery(trimmed);

    // Lunr search — try expanded query first
    let lunrQuery = expandedTerms.join(' ');
    let lunrResults = this._safeSearch(lunrQuery);

    // Spell-correction fallback
    if (lunrResults.length === 0 && spellSuggestion) {
      lunrResults = this._safeSearch(spellSuggestion);
    }

    // Map lunr results to SearchResult objects
    const scoreMap = new Map<string, number>();
    for (const r of lunrResults) scoreMap.set(r.ref, r.score);

    let results: SearchResult[] = [];

    for (const entry of this._indexedEntries) {
      const ref = String(entry.id ?? entry.entityId);
      if (!scoreMap.has(ref)) continue;

      results.push({
        entry,
        score:      scoreMap.get(ref)!,
        highlights: expandedTerms,
      });
    }

    results.sort((a, b) => b.score - a.score);

    // Apply facet filters
    if (filters) results = this._applyFilters(results, filters);

    // Zero-results log
    if (results.length === 0) {
      await this.db.zeroResultsLog.add({
        query:     trimmed,
        timestamp: new Date(),
        userId,
      });
    }

    // Trend tracking
    await this._trackTrending(trimmed);

    return results;
  }

  // --------------------------------------------------
  // Spell suggestion (expose to UI)
  // --------------------------------------------------

  async getSpellSuggestion(query: string): Promise<string | null> {
    const trimmed = query.trim().toLowerCase();
    const entry = await this.db.searchDictionary
      .filter(d => d.corrections.some(c => c.toLowerCase() === trimmed))
      .first();
    return entry ? entry.term : null;
  }

  // --------------------------------------------------
  // Facets
  // --------------------------------------------------

  async getFacets(): Promise<SearchFacets> {
    const entries = await this.db.searchIndex
      .filter(e => e.entityType !== '_trending')
      .toArray();

    const catCounts   = new Map<string, number>();
    const bldgCounts  = new Map<string, number>();
    const mediaCounts = new Map<string, number>();

    for (const e of entries) {
      if (e.category) catCounts.set(e.category, (catCounts.get(e.category) ?? 0) + 1);
      if (e.building) bldgCounts.set(e.building, (bldgCounts.get(e.building) ?? 0) + 1);
      const mt = e.metadata?.['mimeType'] as string | undefined;
      if (mt) mediaCounts.set(mt, (mediaCounts.get(mt) ?? 0) + 1);
    }

    return {
      categories: [...catCounts.entries()].map(([value, count]) => ({ value, count })).sort((a, b) => b.count - a.count),
      buildings:  [...bldgCounts.entries()].map(([value, count]) => ({ value, count })).sort((a, b) => b.count - a.count),
      mediaTypes: [...mediaCounts.entries()].map(([value, count]) => ({ value, count })).sort((a, b) => b.count - a.count),
    };
  }

  // --------------------------------------------------
  // Trending
  // --------------------------------------------------

  async getTrendingTerms(limit = 10): Promise<{ term: string; count: number }[]> {
    const entries = await this.db.searchIndex
      .filter(e => e.entityType === '_trending')
      .toArray();

    return entries
      .map(e => ({ term: e.title, count: (e.metadata?.['count'] as number) ?? 0 }))
      .sort((a, b) => b.count - a.count)
      .slice(0, limit);
  }

  // --------------------------------------------------
  // Zero-results report
  // --------------------------------------------------

  async getZeroResultsReport(limit = 100) {
    return this.db.zeroResultsLog
      .orderBy('timestamp')
      .reverse()
      .limit(limit)
      .toArray();
  }

  // --------------------------------------------------
  // Dictionary management
  // --------------------------------------------------

  async getDictionary(): Promise<SearchDictionaryEntry[]> {
    return this.db.searchDictionary.toArray();
  }

  async addDictionaryEntry(params: {
    term:        string;
    synonyms:    string[];
    corrections: string[];
  }): Promise<SearchDictionaryEntry> {
    const id  = await this.db.searchDictionary.add({
      term:        params.term.toLowerCase().trim(),
      synonyms:    params.synonyms.map(s => s.toLowerCase().trim()),
      corrections: params.corrections.map(c => c.toLowerCase().trim()),
    });
    return (await this.db.searchDictionary.get(id))!;
  }

  async updateDictionaryEntry(
    id:      number,
    params: Partial<Pick<SearchDictionaryEntry, 'synonyms' | 'corrections'>>,
  ): Promise<void> {
    const update: Partial<SearchDictionaryEntry> = {};
    if (params.synonyms)    update.synonyms    = params.synonyms.map(s => s.toLowerCase().trim());
    if (params.corrections) update.corrections = params.corrections.map(c => c.toLowerCase().trim());
    await this.db.searchDictionary.update(id, update);
  }

  // --------------------------------------------------
  // Index helpers
  // --------------------------------------------------

  async indexEntity(entry: Omit<SearchIndexEntry, 'id'>): Promise<void> {
    await this.db.searchIndex.add(entry);
    this._lunrIndex = null; // mark stale
  }

  async removeFromIndex(entityType: string, entityId: number | string): Promise<void> {
    const existing = await this.db.searchIndex
      .filter(e => e.entityType === entityType && e.entityId === entityId)
      .toArray();
    await Promise.all(existing.map(e => this.db.searchIndex.delete(e.id!)));
    this._lunrIndex = null;
  }

  // --------------------------------------------------
  // Private helpers
  // --------------------------------------------------

  private _safeSearch(query: string): import('lunr').Index.Result[] {
    if (!this._lunrIndex) return [];
    try {
      return this._lunrIndex.search(query);
    } catch {
      // Lunr throws on some query syntax errors; fall back to empty
      return [];
    }
  }

  private async expandQuery(query: string): Promise<{
    expandedTerms: string[];
    spellSuggestion: string | null;
  }> {
    const lower = query.toLowerCase().trim();
    const terms: string[] = [query];
    let spellSuggestion: string | null = null;

    // Direct match: query is a dictionary term
    const direct = await this.db.searchDictionary
      .filter(d => d.term.toLowerCase() === lower)
      .first();

    if (direct) {
      terms.push(...direct.synonyms);
      if (direct.corrections.length > 0) spellSuggestion = direct.corrections[0];
    } else {
      // Reverse synonym: query matches a synonym of some term
      const reverse = await this.db.searchDictionary
        .filter(d => d.synonyms.some(s => s.toLowerCase() === lower))
        .first();
      if (reverse) {
        terms.push(reverse.term);
        terms.push(...reverse.synonyms);
      } else {
        // Spell-correction: query matches a correction entry
        const corrEntry = await this.db.searchDictionary
          .filter(d => d.corrections.some(c => c.toLowerCase() === lower))
          .first();
        if (corrEntry) {
          spellSuggestion = corrEntry.term;
          terms.push(corrEntry.term);
          terms.push(...corrEntry.synonyms);
        }
      }
    }

    return { expandedTerms: [...new Set(terms)], spellSuggestion };
  }

  private _applyFilters(results: SearchResult[], filters: SearchFilters): SearchResult[] {
    return results.filter(({ entry }) => {
      if (filters.category  && entry.category !== filters.category)   return false;
      if (filters.building  && entry.building !== filters.building)   return false;
      if (filters.from      && entry.createdAt < filters.from)        return false;
      if (filters.to        && entry.createdAt > filters.to)          return false;
      if (filters.mediaType) {
        const mt = entry.metadata?.['mimeType'] as string | undefined;
        if (mt !== filters.mediaType) return false;
      }
      return true;
    });
  }

  private async _trackTrending(query: string): Promise<void> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const existing = await this.db.searchIndex
      .filter(e => e.entityType === '_trending' && e.title === query)
      .first();

    if (existing?.id) {
      const count = ((existing.metadata?.['count'] as number) ?? 0) + 1;
      await this.db.searchIndex.update(existing.id, {
        metadata: { ...existing.metadata, count },
      });
    } else {
      await this.db.searchIndex.add({
        entityType: '_trending',
        entityId:   query,
        title:      query,
        body:       '',
        tags:       [],
        metadata:   { count: 1, date: today.toISOString() },
        createdAt:  new Date(),
      });
    }
  }
}
