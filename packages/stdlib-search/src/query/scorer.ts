/**
 * Scoring algorithms for search results
 */

import type { 
  ScoringAlgorithm, 
  ParsedQuery, 
  InvertedIndex, 
  FieldStats,
  BM25Params,
  TFIDFParams
} from '../types.js';

/**
 * BM25 scoring algorithm
 * BM25 = IDF * (tf * (k1 + 1)) / (tf + k1 * (1 - b + b * (docLen / avgDocLen)))
 */
export class BM25Scorer implements ScoringAlgorithm {
  private readonly k1: number;
  private readonly b: number;

  constructor(params: BM25Params = { k1: 1.2, b: 0.75 }) {
    this.k1 = params.k1;
    this.b = params.b;
  }

  score(
    query: ParsedQuery,
    docId: string,
    index: InvertedIndex,
    fieldStats?: FieldStats
  ): number {
    let totalScore = 0;

    if (query.type === 'term' && query.term) {
      totalScore = this.scoreTerm(query.term, docId, index, fieldStats, query.boost);
    } else if (query.type === 'boolean') {
      totalScore = this.scoreBoolean(query, docId, index, fieldStats);
    } else if (query.type === 'phrase' && query.terms) {
      totalScore = this.scorePhrase(query.terms, docId, index, fieldStats, query.boost);
    }

    return totalScore;
  }

  private scoreTerm(
    term: string,
    docId: string,
    index: InvertedIndex,
    fieldStats?: FieldStats,
    boost: number = 1
  ): number {
    const tf = this.getTermFrequency(term, docId, index);
    if (tf === 0) return 0;

    const df = index.postings.get(term)?.documentFrequency || 0;
    if (df === 0) return 0;

    const idf = this.calculateIDF(index.documentCount, df);
    
    // If no field stats provided, use document-level statistics
    if (!fieldStats) {
      // Simple TF-IDF scoring without field normalization
      return tf * idf * boost;
    }
    
    const docLen = this.getFieldLength(fieldStats.field, docId, index);
    const avgDocLen = fieldStats.avgLength || 1;

    const numerator = tf * (this.k1 + 1);
    const denominator = tf + this.k1 * (1 - this.b + this.b * (docLen / avgDocLen));

    return idf * (numerator / denominator) * boost;
  }

  private scoreBoolean(
    query: ParsedQuery,
    docId: string,
    index: InvertedIndex,
    fieldStats?: FieldStats
  ): number {
    let score = 0;

    // Must clauses - all must match
    if (query.must) {
      let mustScore = 0;
      for (const subQuery of query.must) {
        const subScore = this.score(subQuery, docId, index, fieldStats);
        if (subScore === 0) return 0; // If any must clause doesn't match, return 0
        mustScore += subScore;
      }
      score += mustScore;
    }

    // Should clauses - at least one should match
    if (query.should) {
      let shouldScore = 0;
      let matchCount = 0;
      for (const subQuery of query.should) {
        const subScore = this.score(subQuery, docId, index, fieldStats);
        if (subScore > 0) {
          shouldScore += subScore;
          matchCount++;
        }
      }
      if (matchCount > 0) {
        score += shouldScore / matchCount; // Average of matching should clauses
      }
    }

    // Must not clauses - none must match
    if (query.must_not) {
      for (const subQuery of query.must_not) {
        const subScore = this.score(subQuery, docId, index, fieldStats);
        if (subScore > 0) return 0; // If any must_not clause matches, return 0
      }
    }

    return score * (query.boost || 1);
  }

  private scorePhrase(
    terms: string[],
    docId: string,
    index: InvertedIndex,
    fieldStats?: FieldStats,
    boost: number = 1
  ): number {
    // Simple phrase scoring - sum of term scores with position proximity bonus
    let totalScore = 0;
    let allTermsMatch = true;

    for (const term of terms) {
      const termScore = this.scoreTerm(term, docId, index, fieldStats);
      if (termScore === 0) {
        allTermsMatch = false;
        break;
      }
      totalScore += termScore;
    }

    if (!allTermsMatch) return 0;

    // Add proximity bonus if terms appear close together
    const proximityBonus = this.calculateProximityBonus(terms, docId, index);
    
    return (totalScore + proximityBonus) * boost;
  }

  private calculateIDF(docCount: number, docFreq: number): number {
    // Add 1 to avoid division by zero
    return Math.log((docCount - docFreq + 0.5) / (docFreq + 0.5));
  }

  private getTermFrequency(term: string, docId: string, index: InvertedIndex): number {
    return index.postings.get(term)?.postings.get(docId)?.termFrequency || 0;
  }

  private getFieldLength(field: string, docId: string, index: InvertedIndex): number {
    return index.fieldLengths.get(field)?.get(docId) || 0;
  }

  private calculateProximityBonus(terms: string[], docId: string, index: InvertedIndex): number {
    // Simple proximity calculation - check if terms appear in sequence
    const positions: number[][] = [];
    
    for (const term of terms) {
      const posting = index.postings.get(term)?.postings.get(docId);
      if (!posting || !posting.positions) return 0;
      positions.push(posting.positions);
    }

    // Find the minimum distance between consecutive terms
    let minDistance = Number.MAX_SAFE_INTEGER;
    
    for (let i = 0; i < positions.length - 1; i++) {
      const pos1 = positions[i];
      const pos2 = positions[i + 1];
      
      for (const p1 of pos1) {
        for (const p2 of pos2) {
          const distance = Math.abs(p2 - p1);
          if (distance < minDistance) {
            minDistance = distance;
          }
        }
      }
    }

    // Return higher bonus for closer proximity
    return minDistance === 1 ? 2 : minDistance === 2 ? 1 : 0.5;
  }
}

/**
 * TF-IDF scoring algorithm
 * TF-IDF = tf * idf
 */
export class TFIDFScorer implements ScoringAlgorithm {
  private readonly useIdf: boolean;
  private readonly useNorm: boolean;

  constructor(params: TFIDFParams = { useIdf: true, useNorm: true }) {
    this.useIdf = params.useIdf;
    this.useNorm = params.useNorm;
  }

  score(
    query: ParsedQuery,
    docId: string,
    index: InvertedIndex,
    fieldStats?: FieldStats
  ): number {
    let totalScore = 0;

    if (query.type === 'term' && query.term) {
      totalScore = this.scoreTerm(query.term, docId, index, fieldStats, query.boost);
    } else if (query.type === 'boolean') {
      totalScore = this.scoreBoolean(query, docId, index, fieldStats);
    } else if (query.type === 'phrase' && query.terms) {
      totalScore = this.scorePhrase(query.terms, docId, index, fieldStats, query.boost);
    }

    return totalScore;
  }

  private scoreTerm(
    term: string,
    docId: string,
    index: InvertedIndex,
    fieldStats?: FieldStats,
    boost: number = 1
  ): number {
    const tf = this.getTermFrequency(term, docId, index);
    if (tf === 0) return 0;

    let score = tf;

    if (this.useIdf) {
      const df = index.postings.get(term)?.documentFrequency || 0;
      const idf = this.calculateIDF(index.documentCount, df);
      score *= idf;
    }

    if (this.useNorm && fieldStats) {
      const docLen = this.getFieldLength(fieldStats.field, docId, index);
      const norm = Math.sqrt(docLen);
      if (norm > 0) {
        score /= norm;
      }
    }

    return score * boost;
  }

  private scoreBoolean(
    query: ParsedQuery,
    docId: string,
    index: InvertedIndex,
    fieldStats?: FieldStats
  ): number {
    let score = 0;

    if (query.must) {
      let mustScore = 0;
      for (const subQuery of query.must) {
        const subScore = this.score(subQuery, docId, index, fieldStats);
        if (subScore === 0) return 0;
        mustScore += subScore;
      }
      score += mustScore;
    }

    if (query.should) {
      let shouldScore = 0;
      let matchCount = 0;
      for (const subQuery of query.should) {
        const subScore = this.score(subQuery, docId, index, fieldStats);
        if (subScore > 0) {
          shouldScore += subScore;
          matchCount++;
        }
      }
      if (matchCount > 0) {
        score += shouldScore / matchCount;
      }
    }

    if (query.must_not) {
      for (const subQuery of query.must_not) {
        const subScore = this.score(subQuery, docId, index, fieldStats);
        if (subScore > 0) return 0;
      }
    }

    return score * (query.boost || 1);
  }

  private scorePhrase(
    terms: string[],
    docId: string,
    index: InvertedIndex,
    fieldStats?: FieldStats,
    boost: number = 1
  ): number {
    let totalScore = 0;
    let allTermsMatch = true;

    for (const term of terms) {
      const termScore = this.scoreTerm(term, docId, index, fieldStats);
      if (termScore === 0) {
        allTermsMatch = false;
        break;
      }
      totalScore += termScore;
    }

    return allTermsMatch ? totalScore * boost : 0;
  }

  private calculateIDF(docCount: number, docFreq: number): number {
    if (docFreq === 0) return 0;
    return Math.log(docCount / docFreq);
  }

  private getTermFrequency(term: string, docId: string, index: InvertedIndex): number {
    return index.postings.get(term)?.postings.get(docId)?.termFrequency || 0;
  }

  private getFieldLength(field: string, docId: string, index: InvertedIndex): number {
    return index.fieldLengths.get(field)?.get(docId) || 0;
  }
}

/**
 * Simple term frequency scorer
 */
export class TermFrequencyScorer implements ScoringAlgorithm {
  score(
    query: ParsedQuery,
    docId: string,
    index: InvertedIndex,
    fieldStats?: FieldStats
  ): number {
    if (query.type === 'term' && query.term) {
      const tf = index.postings.get(query.term)?.postings.get(docId)?.termFrequency || 0;
      return tf * (query.boost || 1);
    }
    return 0;
  }
}

// Factory function to create scorers
export function createScorer(type: 'bm25' | 'tfidf' | 'tf', params?: any): ScoringAlgorithm {
  switch (type) {
    case 'bm25':
      return new BM25Scorer(params);
    case 'tfidf':
      return new TFIDFScorer(params);
    case 'tf':
      return new TermFrequencyScorer();
    default:
      return new BM25Scorer();
  }
}
