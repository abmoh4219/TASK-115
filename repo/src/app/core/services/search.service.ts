import { Injectable } from '@angular/core';
import { DbService, SearchIndexEntry } from './db.service';
import { AnomalyService } from './anomaly.service';

export interface SearchFilters {
  category?: string;
  building?: string;
  mediaType?: string;
  from?: Date;
  to?: Date;
}

export interface SearchResult {
  entry: SearchIndexEntry;
  score: number;
}

@Injectable({ providedIn: 'root' })
export class SearchService {

  constructor(
    private db: DbService,
    private anomaly: AnomalyService,
  ) {}

  async search(query: string, filters?: SearchFilters): Promise<SearchResult[]> {
    // Track for anomaly detection
    this.anomaly.trackSearch();

    if (!query.trim()) return [];

    // Expand query with synonyms
    const expandedTerms = await this.expandQuery(query);

    // Load all index entries (in-memory search via lunr is initialized below)
    let entries = await this.db.searchIndex.toArray();

    // Apply facet filters
    if (filters) {
      entries = entries.filter(e => {
        if (filters.category && e.category !== filters.category) return false;
        if (filters.building && e.building !== filters.building) return false;
        if (filters.from     && e.createdAt < filters.from) return false;
        if (filters.to       && e.createdAt > filters.to) return false;
        return true;
      });
    }

    // Simple text search across title, body, tags
    const lowerTerms = expandedTerms.map(t => t.toLowerCase());
    const results: SearchResult[] = [];

    for (const entry of entries) {
      const haystack = [
        entry.title,
        entry.body,
        ...(entry.tags ?? []),
        JSON.stringify(entry.metadata ?? {}),
      ].join(' ').toLowerCase();

      let score = 0;
      for (const term of lowerTerms) {
        if (haystack.includes(term)) {
          score += term === query.toLowerCase() ? 2 : 1;
        }
      }

      if (score > 0) results.push({ entry, score });
    }

    results.sort((a, b) => b.score - a.score);

    // Log zero results
    if (results.length === 0) {
      await this.db.zeroResultsLog.add({ query, timestamp: new Date() });
    }

    // Update trending (increment count for today)
    await this.trackTrending(query);

    return results;
  }

  private async expandQuery(query: string): Promise<string[]> {
    const terms = [query];
    const lower = query.toLowerCase().trim();

    // Direct lookup: query matches a dictionary term
    const dictEntry = await this.db.searchDictionary
      .filter(d => d.term.toLowerCase() === lower)
      .first();

    if (dictEntry) {
      terms.push(...dictEntry.synonyms);
      // Apply corrections (use corrected forms as additional terms)
      terms.push(...dictEntry.corrections);
    } else {
      // Reverse lookup: query matches a synonym of some term
      const reverseEntry = await this.db.searchDictionary
        .filter(d => d.synonyms.some(s => s.toLowerCase() === lower))
        .first();
      if (reverseEntry) {
        terms.push(reverseEntry.term);
        terms.push(...reverseEntry.synonyms);
      }
    }

    return [...new Set(terms)];
  }

  private async trackTrending(query: string): Promise<void> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const existing = await this.db.searchIndex
      .filter(e => e.entityType === '_trending' && e.title === query)
      .first();

    if (existing?.id) {
      const count = (existing.metadata?.['count'] as number ?? 0) + 1;
      await this.db.searchIndex.update(existing.id, {
        metadata: { ...existing.metadata, count },
      });
    } else {
      await this.db.searchIndex.add({
        entityType: '_trending',
        entityId: query,
        title: query,
        body: '',
        tags: [],
        metadata: { count: 1, date: today.toISOString() },
        createdAt: new Date(),
      });
    }
  }

  async getTrendingTerms(limit = 10): Promise<{ term: string; count: number }[]> {
    const entries = await this.db.searchIndex
      .filter(e => e.entityType === '_trending')
      .toArray();

    return entries
      .map(e => ({ term: e.title, count: (e.metadata?.['count'] as number) ?? 0 }))
      .sort((a, b) => b.count - a.count)
      .slice(0, limit);
  }

  async getZeroResultsReport(limit = 100) {
    return this.db.zeroResultsLog
      .orderBy('timestamp')
      .reverse()
      .limit(limit)
      .toArray();
  }

  async indexEntity(entry: Omit<SearchIndexEntry, 'id'>): Promise<void> {
    await this.db.searchIndex.add(entry);
  }

  async removeFromIndex(entityType: string, entityId: number | string): Promise<void> {
    const existing = await this.db.searchIndex
      .filter(e => e.entityType === entityType && e.entityId === entityId)
      .toArray();
    await Promise.all(existing.map(e => this.db.searchIndex.delete(e.id!)));
  }
}
