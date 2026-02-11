/**
 * Faceting implementation for search result aggregation
 */

import type { 
  Document, 
  FacetResult, 
  FacetBucket, 
  FacetRequest,
  FieldConfig 
} from '../types.js';
import type { InvertedIndexManager } from '../index/inverted-index.js';

export class FacetProcessor {
  /**
   * Process facet requests on search results
   */
  processFacets(
    documents: Document[],
    facetRequests: FacetRequest[],
    index: InvertedIndexManager
  ): Map<string, FacetResult> {
    const results = new Map<string, FacetResult>();

    for (const request of facetRequests) {
      const result = this.processFacet(documents, request, index);
      results.set(request.field, result);
    }

    return results;
  }

  private processFacet(
    documents: Document[],
    request: FacetRequest,
    index: InvertedIndexManager
  ): FacetResult {
    switch (request.type) {
      case 'terms':
        return this.processTermsFacet(documents, request);
      case 'range':
        return this.processRangeFacet(documents, request);
      case 'histogram':
        return this.processHistogramFacet(documents, request);
      case 'date_histogram':
        return this.processDateHistogramFacet(documents, request);
      default:
        return { field: request.field, buckets: [] };
    }
  }

  private processTermsFacet(documents: Document[], request: FacetRequest): FacetResult {
    const counts = new Map<string, number>();

    for (const doc of documents) {
      const value = doc.fields.get(request.field);
      
      if (value !== null && value !== undefined) {
        const stringValue = String(value);
        counts.set(stringValue, (counts.get(stringValue) || 0) + 1);
      }
    }

    // Sort by count descending, then by key
    const sortedBuckets = Array.from(counts.entries())
      .sort((a, b) => {
        if (b[1] !== a[1]) return b[1] - a[1];
        return a[0].localeCompare(b[0]);
      })
      .slice(0, request.size || 10)
      .map(([key, count]) => ({
        key,
        count
      }));

    return {
      field: request.field,
      buckets: sortedBuckets
    };
  }

  private processRangeFacet(documents: Document[], request: FacetRequest): FacetResult {
    const buckets: FacetBucket[] = [];

    if (!request.ranges) {
      return { field: request.field, buckets: [] };
    }

    // Initialize buckets
    const rangeCounts = new Map<string, number>();
    for (const range of request.ranges) {
      const key = range.key || `${range.from || '*'}-${range.to || '*'}`;
      rangeCounts.set(key, 0);
    }

    // Count documents in each range
    for (const doc of documents) {
      const value = doc.fields.get(request.field);
      
      if (typeof value === 'number') {
        for (const range of request.ranges) {
          const key = range.key || `${range.from || '*'}-${range.to || '*'}`;
          
          let inRange = true;
          
          if (range.from !== undefined && range.from !== null) {
            inRange = inRange && value >= range.from;
          }
          
          if (range.to !== undefined && range.to !== null) {
            inRange = inRange && value < range.to;
          }
          
          if (inRange) {
            rangeCounts.set(key, (rangeCounts.get(key) || 0) + 1);
          }
        }
      }
    }

    // Convert to buckets
    for (const [key, count] of rangeCounts.entries()) {
      const range = request.ranges.find(r => 
        r.key === key || 
        `${r.from || '*'}-${r.to || '*'}` === key
      );
      
      buckets.push({
        key,
        count,
        from: range?.from,
        to: range?.to
      });
    }

    return {
      field: request.field,
      buckets
    };
  }

  private processHistogramFacet(documents: Document[], request: FacetRequest): FacetResult {
    if (!request.interval) {
      return { field: request.field, buckets: [] };
    }

    const counts = new Map<number, number>();

    for (const doc of documents) {
      const value = doc.fields.get(request.field);
      
      if (typeof value === 'number') {
        const bucketKey = Math.floor(value / request.interval) * request.interval;
        counts.set(bucketKey, (counts.get(bucketKey) || 0) + 1);
      }
    }

    // Sort by bucket key
    const sortedBuckets = Array.from(counts.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([key, count]) => ({
        key: String(key),
        count,
        from: key,
        to: key + request.interval
      }));

    return {
      field: request.field,
      buckets: sortedBuckets
    };
  }

  private processDateHistogramFacet(documents: Document[], request: FacetRequest): FacetResult {
    const counts = new Map<string, number>();
    const interval = request.interval || 1; // Default to 1 day

    for (const doc of documents) {
      const value = doc.fields.get(request.field);
      
      if (value instanceof Date) {
        const bucketKey = this.getDateBucket(value, interval, request.format);
        counts.set(bucketKey, (counts.get(bucketKey) || 0) + 1);
      } else if (typeof value === 'string') {
        const date = new Date(value);
        if (!isNaN(date.getTime())) {
          const bucketKey = this.getDateBucket(date, interval, request.format);
          counts.set(bucketKey, (counts.get(bucketKey) || 0) + 1);
        }
      }
    }

    // Sort by date
    const sortedBuckets = Array.from(counts.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([key, count]) => ({
        key,
        count
      }));

    return {
      field: request.field,
      buckets: sortedBuckets
    };
  }

  private getDateBucket(date: Date, interval: number, format?: string): string {
    const timestamp = date.getTime();
    const intervalMs = interval * 24 * 60 * 60 * 1000; // Convert days to milliseconds
    const bucketTimestamp = Math.floor(timestamp / intervalMs) * intervalMs;
    const bucketDate = new Date(bucketTimestamp);

    if (format) {
      return this.formatDate(bucketDate, format);
    }

    return bucketDate.toISOString().split('T')[0]; // YYYY-MM-DD format
  }

  private formatDate(date: Date, format: string): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');

    return format
      .replace('yyyy', String(year))
      .replace('MM', month)
      .replace('dd', day)
      .replace('HH', hours)
      .replace('mm', minutes)
      .replace('ss', seconds);
  }
}

/**
 * Facet filter for filtering search results based on facet selections
 */
export class FacetFilter {
  /**
   * Filter documents based on facet selections
   */
  static filter(
    documents: Document[],
    facetFilters: Map<string, any[]>
  ): Document[] {
    let filtered = documents;

    for (const [field, values] of facetFilters.entries()) {
      filtered = filtered.filter(doc => {
        const value = doc.fields.get(field);
        
        if (value === null || value === undefined) {
          return false;
        }

        // Handle different value types
        if (typeof value === 'string') {
          return values.includes(value);
        } else if (typeof value === 'number') {
          return values.some(v => {
            if (typeof v === 'number') {
              return v === value;
            } else if (typeof v === 'object' && v !== null) {
              // Range filter
              const range = v as { from?: number; to?: number };
              let matches = true;
              if (range.from !== undefined) matches = matches && value >= range.from;
              if (range.to !== undefined) matches = matches && value < range.to;
              return matches;
            }
            return false;
          });
        } else if (value instanceof Date) {
          return values.some(v => {
            if (v instanceof Date) {
              return v.getTime() === value.getTime();
            } else if (typeof v === 'string') {
              return v === value.toISOString().split('T')[0];
            }
            return false;
          });
        }

        // Convert to string for comparison
        return values.includes(String(value));
      });
    }

    return filtered;
  }

  /**
   * Create a range filter value
   */
  static range(from?: number, to?: number): { from?: number; to?: number } {
    const range: { from?: number; to?: number } = {};
    if (from !== undefined) range.from = from;
    if (to !== undefined) range.to = to;
    return range;
  }

  /**
   * Create a date range filter value
   */
  static dateRange(from?: Date, to?: Date): { from?: Date; to?: Date } {
    const range: { from?: Date; to?: Date } = {};
    if (from !== undefined) range.from = from;
    if (to !== undefined) range.to = to;
    return range;
  }
}
