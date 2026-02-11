/**
 * Tests for scoring algorithms
 */

import { describe, it, expect } from 'vitest';
import { BM25Scorer, TFIDFScorer, createScorer } from '../query/scorer.js';
import { InvertedIndexManager } from '../index/inverted-index.js';
import { STANDARD_ANALYZER } from '../index/analyzer.js';
import type { ParsedQuery } from '../types.js';

describe('BM25Scorer', () => {
  let index: InvertedIndexManager;
  let scorer: BM25Scorer;

  beforeEach(() => {
    index = new InvertedIndexManager(STANDARD_ANALYZER);
    scorer = new BM25Scorer({ k1: 1.2, b: 0.75 });

    // Add test documents
    index.addDocument({
      id: '1',
      fields: new Map([
        ['title', 'the quick brown fox'],
        ['content', 'jumps over the lazy dog']
      ])
    });

    index.addDocument({
      id: '2',
      fields: new Map([
        ['title', 'fast cars'],
        ['content', 'cars are very fast and brown']
      ])
    });

    index.addDocument({
      id: '3',
      fields: new Map([
        ['title', 'brown bear'],
        ['content', 'a brown bear in the woods']
      ])
    });
  });

  it('should score term queries', () => {
    const query: ParsedQuery = {
      type: 'term',
      term: 'brown',
      field: '_all' // Use _all since index doesn't support field-specific queries
    };

    const titleIndex = index.getRawIndex();
    
    // Check if the term exists in the index
    expect(titleIndex.postings.has('brown')).toBe(true);
    
    // Check document frequency - brown appears in all 3 documents
    const postingList = titleIndex.postings.get('brown');
    expect(postingList).toBeDefined();
    expect(postingList!.documentFrequency).toBe(3);
    
    // Score without field-specific stats since index doesn't support fields
    const score1 = scorer.score(query, '1', titleIndex);
    const score2 = scorer.score(query, '2', titleIndex);
    const score3 = scorer.score(query, '3', titleIndex);
    
    console.log('Scores:', { score1, score2, score3 });
    console.log('Field lengths for title:', Array.from(titleIndex.fieldLengths.get('title')?.entries() || []));
    console.log('Avg field length for title:', titleIndex.avgFieldLength.get('title'));

    expect(score1).toBeGreaterThan(0);
    expect(score2).toBeGreaterThan(0); // 'brown' is in content of doc 2
    expect(score3).toBeGreaterThan(0);
  });

  it('should calculate IDF correctly', () => {
    // 'brown' appears in 2 out of 3 documents
    const query: ParsedQuery = {
      type: 'term',
      term: 'brown',
      field: 'title'
    };

    const titleIndex = index.getRawIndex();
    const score = scorer.score(query, '1', titleIndex);
    expect(score).toBeGreaterThan(0);
  });

  it('should handle boolean queries', () => {
    const query: ParsedQuery = {
      type: 'boolean',
      must: [
        { type: 'term', term: 'brown', field: 'title' }
      ],
      should: [
        { type: 'term', term: 'quick', field: 'title' }
      ]
    };

    const titleIndex = index.getRawIndex();
    const score1 = scorer.score(query, '1', titleIndex);
    const score3 = scorer.score(query, '3', titleIndex);

    expect(score1).toBeGreaterThan(score3); // Doc 1 matches both terms
  });

  it('should apply boost', () => {
    const query1: ParsedQuery = {
      type: 'term',
      term: 'brown',
      field: 'title',
      boost: 1
    };

    const query2: ParsedQuery = {
      type: 'term',
      term: 'brown',
      field: 'title',
      boost: 2
    };

    const titleIndex = index.getRawIndex();
    const score1 = scorer.score(query1, '1', titleIndex);
    const score2 = scorer.score(query2, '1', titleIndex);

    expect(score2).toBe(2 * score1);
  });
});

describe('TFIDFScorer', () => {
  let index: InvertedIndexManager;
  let scorer: TFIDFScorer;

  beforeEach(() => {
    index = new InvertedIndexManager(STANDARD_ANALYZER);
    scorer = new TFIDFScorer({ useIdf: true, useNorm: true });

    // Add test documents with different lengths
    index.addDocument({
      id: '1',
      fields: new Map([
        ['content', 'short']
      ])
    });

    index.addDocument({
      id: '2',
      fields: new Map([
        ['content', 'this is a much longer document with many words']
      ])
    });

    index.addDocument({
      id: '3',
      fields: new Map([
        ['content', 'another document about words']
      ])
    });
  });

  it('should calculate TF-IDF scores', () => {
    const query: ParsedQuery = {
      type: 'term',
      term: 'words',
      field: 'content'
    };

    const contentIndex = index.getRawIndex();
    const score2 = scorer.score(query, '2', contentIndex);
    const score3 = scorer.score(query, '3', contentIndex);

    expect(score2).toBeGreaterThan(0);
    expect(score3).toBeGreaterThan(0);
  });

  it('should apply normalization', () => {
    const scorerWithNorm = new TFIDFScorer({ useIdf: false, useNorm: true });
    const scorerWithoutNorm = new TFIDFScorer({ useIdf: false, useNorm: false });

    const query: ParsedQuery = {
      type: 'term',
      term: 'document',
      field: 'content'
    };

    const contentIndex = index.getRawIndex();
    const scoreWithNorm = scorerWithNorm.score(query, '2', contentIndex);
    const scoreWithoutNorm = scorerWithoutNorm.score(query, '2', contentIndex);

    expect(scoreWithNorm).toBeLessThan(scoreWithoutNorm);
  });
});

describe('Scorer Factory', () => {
  it('should create BM25 scorer', () => {
    const scorer = createScorer('bm25', { k1: 1.5, b: 0.8 });
    expect(scorer).toBeInstanceOf(BM25Scorer);
  });

  it('should create TF-IDF scorer', () => {
    const scorer = createScorer('tfidf', { useIdf: true });
    expect(scorer).toBeInstanceOf(TFIDFScorer);
  });

  it('should default to BM25', () => {
    const scorer = createScorer('unknown' as any);
    expect(scorer).toBeInstanceOf(BM25Scorer);
  });
});
