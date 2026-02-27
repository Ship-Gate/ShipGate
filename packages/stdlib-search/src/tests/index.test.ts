/**
 * Tests for the in-memory search engine
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { 
  MemorySearchEngine,
  QueryBuilder,
  STANDARD_ANALYZER,
  createAnalyzer
} from '../index.js';

describe('MemorySearchEngine', () => {
  let engine: MemorySearchEngine;

  beforeEach(() => {
    engine = new MemorySearchEngine();
    engine.createIndex('test', {
      fields: [
        { name: 'title', type: 'text', indexed: true },
        { name: 'content', type: 'text', indexed: true },
        { name: 'category', type: 'keyword', indexed: true },
        { name: 'price', type: 'number', indexed: true },
        { name: 'tags', type: 'text', indexed: true }
      ]
    });
  });

  describe('Document Operations', () => {
    it('should add and search documents', async () => {
      engine.addDocument('test', {
        id: '1',
        title: 'The Quick Brown Fox',
        content: 'A quick brown fox jumps over the lazy dog',
        category: 'animals',
        price: 9.99
      });

      engine.addDocument('test', {
        id: '2',
        title: 'JavaScript Guide',
        content: 'Learn JavaScript programming',
        category: 'programming',
        price: 19.99
      });

      const results = await engine.search('test', 'quick');
      expect(results.results).toHaveLength(1);
      expect(results.results[0].docId).toBe('1');
      expect(results.total).toBe(1);
    });

    it('should update documents', async () => {
      engine.addDocument('test', {
        id: '1',
        title: 'Original Title',
        content: 'Original content'
      });

      const search1 = await engine.search('test', 'original');
      expect(search1.results).toHaveLength(1);

      engine.updateDocument('test', {
        id: '1',
        title: 'Updated Title',
        content: 'Updated content'
      });

      const search2 = await engine.search('test', 'original');
      expect(search2.results).toHaveLength(0);

      const search3 = await engine.search('test', 'updated');
      expect(search3.results).toHaveLength(1);
    });

    it('should remove documents', async () => {
      engine.addDocument('test', {
        id: '1',
        title: 'To be deleted',
        content: 'Content'
      });

      const search1 = await engine.search('test', 'deleted');
      expect(search1.results).toHaveLength(1);

      engine.removeDocument('test', '1');

      const search2 = await engine.search('test', 'deleted');
      expect(search2.results).toHaveLength(0);
    });

    it('should bulk index documents', async () => {
      const docs = [
        { id: '1', title: 'Doc 1', content: 'Content 1' },
        { id: '2', title: 'Doc 2', content: 'Content 2' },
        { id: '3', title: 'Doc 3', content: 'Content 3' }
      ];

      engine.bulkIndex('test', docs);

      const results = await engine.search('test', 'content');
      expect(results.results).toHaveLength(3);
      expect(results.total).toBe(3);
    });
  });

  describe('Query Types', () => {
    beforeEach(() => {
      engine.addDocument('test', {
        id: '1',
        title: 'The Quick Brown Fox',
        content: 'A quick brown fox jumps over the lazy dog',
        tags: 'quick brown animal'
      });

      engine.addDocument('test', {
        id: '2',
        title: 'Fast Cars',
        content: 'Cars are fast and brown',
        tags: 'fast vehicle'
      });

      engine.addDocument('test', {
        id: '3',
        title: 'Brown Bear',
        content: 'A brown bear in the woods',
        tags: 'brown animal'
      });
    });

    it('should handle term queries', async () => {
      const results = await engine.search('test', 'brown');
      expect(results.results).toHaveLength(3);
      expect(results.total).toBe(3);
    });

    it('should handle phrase queries', async () => {
      const results = await engine.search('test', '"quick brown"');
      expect(results.results).toHaveLength(1);
      expect(results.results[0].docId).toBe('1');
    });

    it('should handle boolean queries - AND', async () => {
      const results = await engine.search('test', 'brown AND animal');
      expect(results.results).toHaveLength(2); // Docs 1 and 3
    });

    it('should handle boolean queries - OR', async () => {
      const results = await engine.search('test', 'quick OR fast');
      expect(results.results).toHaveLength(2); // Docs 1 and 2
    });

    it('should handle boolean queries - NOT', async () => {
      const results = await engine.search('test', 'brown NOT fox');
      expect(results.results).toHaveLength(2); // Docs 2 and 3
    });

    it('should handle wildcard queries', async () => {
      const results = await engine.search('test', 'br*');
      expect(results.results).toHaveLength(3); // All contain 'brown'
    });

    it('should handle field-specific queries', async () => {
      const results = await engine.search('test', 'title:fast');
      expect(results.results).toHaveLength(1);
      expect(results.results[0].docId).toBe('2');
    });
  });

  describe('Scoring', () => {
    beforeEach(() => {
      engine.addDocument('test', {
        id: '1',
        title: 'Search Engine',
        content: 'Search is important for search engines'
      });

      engine.addDocument('test', {
        id: '2',
        title: 'Web Search',
        content: 'Search the web'
      });

      engine.addDocument('test', {
        id: '3',
        title: 'Database',
        content: 'Database indexing'
      });
    });

    it('should score documents by relevance', async () => {
      const results = await engine.search('test', 'search');
      expect(results.results).toHaveLength(2);
      
      // Doc 1 should have higher score (search appears 3 times)
      expect(results.results[0].docId).toBe('1');
      expect(results.results[0].score).toBeGreaterThan(results.results[1].score);
    });

    it('should explain scoring when requested', async () => {
      const results = await engine.search('test', 'search', { explain: true });
      expect(results.results[0].explanation).toBeDefined();
      expect(results.results[0].explanation!.value).toBeGreaterThan(0);
    });
  });

  describe('Pagination', () => {
    beforeEach(() => {
      for (let i = 1; i <= 25; i++) {
        engine.addDocument('test', {
          id: String(i),
          title: `Document ${i}`,
          content: `Content for document ${i}`
        });
      }
    });

    it('should paginate results', async () => {
      const page1 = await engine.search('test', 'document', { from: 0, size: 10 });
      expect(page1.results).toHaveLength(10);
      expect(page1.total).toBe(25);

      const page2 = await engine.search('test', 'document', { from: 10, size: 10 });
      expect(page2.results).toHaveLength(10);
      expect(page2.results[0].docId).not.toBe(page1.results[0].docId);

      const page3 = await engine.search('test', 'document', { from: 20, size: 10 });
      expect(page3.results).toHaveLength(5);
    });
  });

  describe('Faceting', () => {
    beforeEach(() => {
      engine.addDocument('test', {
        id: '1',
        title: 'Product A',
        category: 'electronics',
        price: 99.99,
        tags: 'gadget device'
      });

      engine.addDocument('test', {
        id: '2',
        title: 'Product B',
        category: 'books',
        price: 19.99,
        tags: 'paperback novel'
      });

      engine.addDocument('test', {
        id: '3',
        title: 'Product C',
        category: 'electronics',
        price: 149.99,
        tags: 'gadget phone'
      });

      engine.addDocument('test', {
        id: '4',
        title: 'Product D',
        category: 'books',
        price: 24.99,
        tags: 'hardcover textbook'
      });
    });

    it('should generate term facets', async () => {
      const results = await engine.search('test', 'product', {
        facets: [
          { field: 'category', type: 'terms', size: 10 }
        ]
      });

      expect(results.facets).toBeDefined();
      expect(results.facets!.get('category')).toBeDefined();
      
      const categoryFacet = results.facets!.get('category')!;
      expect(categoryFacet.buckets).toHaveLength(2);
      expect(categoryFacet.buckets.find(b => b.key === 'electronics')?.count).toBe(2);
      expect(categoryFacet.buckets.find(b => b.key === 'books')?.count).toBe(2);
    });

    it('should generate range facets', async () => {
      const results = await engine.search('test', 'product', {
        facets: [
          {
            field: 'price',
            type: 'range',
            ranges: [
              { key: 'cheap', from: 0, to: 50 },
              { key: 'expensive', from: 50, to: 200 }
            ]
          }
        ]
      });

      expect(results.facets).toBeDefined();
      const priceFacet = results.facets!.get('price')!;
      expect(priceFacet.buckets).toHaveLength(2);
      expect(priceFacet.buckets.find(b => b.key === 'cheap')?.count).toBe(2);
      expect(priceFacet.buckets.find(b => b.key === 'expensive')?.count).toBe(2);
    });
  });

  describe('Suggestions', () => {
    beforeEach(() => {
      engine.addDocument('test', {
        id: '1',
        title: 'JavaScript Programming',
        content: 'Learn JavaScript programming'
      });

      engine.addDocument('test', {
        id: '2',
        title: 'Python Guide',
        content: 'Python programming guide'
      });

      engine.addDocument('test', {
        id: '3',
        title: 'Java Tutorial',
        content: 'Java programming tutorial'
      });
    });

    it('should provide autocomplete suggestions', () => {
      const suggestions = engine.suggest('test', 'prog');
      expect(suggestions.length).toBeGreaterThan(0);
      expect(suggestions[0].text).toContain('prog');
    });

    it('should provide spell check suggestions', () => {
      const suggestions = engine.spellCheck('test', 'programing');
      expect(suggestions.length).toBeGreaterThan(0);
      expect(suggestions[0].text).toBe('programming');
    });
  });

  describe('Index Management', () => {
    it('should list indices', () => {
      engine.createIndex('test2');
      const indices = engine.listIndices();
      expect(indices).toContain('test');
      expect(indices).toContain('test2');
    });

    it('should delete indices', () => {
      engine.deleteIndex('test');
      const indices = engine.listIndices();
      expect(indices).not.toContain('test');
    });

    it('should get index statistics', () => {
      engine.addDocument('test', { id: '1', title: 'Test' });
      const stats = engine.getStats('test');
      expect(stats).toBeDefined();
      expect(stats!.documentCount).toBe(1);
    });
  });
});

describe('QueryBuilder', () => {
  it('should build term queries', () => {
    const query = QueryBuilder.term('title', 'test').boost(2).build();
    expect(query.type).toBe('term');
    expect(query.field).toBe('title');
    expect(query.term).toBe('test');
    expect(query.boost).toBe(2);
  });

  it('should build phrase queries', () => {
    const query = QueryBuilder.phrase('content', 'quick brown').build();
    expect(query.type).toBe('phrase');
    expect(query.terms).toEqual(['quick', 'brown']);
  });

  it('should build boolean queries', () => {
    const query = QueryBuilder.must(
      QueryBuilder.term('title', 'test'),
      QueryBuilder.term('content', 'example')
    ).build();
    
    expect(query.type).toBe('boolean');
    expect(query.must).toHaveLength(2);
  });

  it('should convert to string', () => {
    const query = QueryBuilder.must(
      QueryBuilder.term('title', 'test'),
      QueryBuilder.should(
        QueryBuilder.term('content', 'a'),
        QueryBuilder.term('content', 'b')
      )
    );
    
    expect(query.toString()).toContain('title:test');
    expect(query.toString()).toContain('content:a OR content:b');
  });
});

describe('Analyzers', () => {
  it('should analyze text with standard analyzer', () => {
    const analyzer = STANDARD_ANALYZER;
    const tokens = analyzer.analyze('The Quick Brown Fox!');
    expect(tokens).toContain('quick');
    expect(tokens).toContain('brown');
    expect(tokens).toContain('fox');
    expect(tokens).not.toContain('the');
  });

  it('should create custom analyzers', () => {
    const analyzer = createAnalyzer({
      name: 'custom',
      tokenizer: { type: 'whitespace' },
      filters: [
        { type: 'lowercase' },
        { type: 'stop' }
      ]
    });
    
    const tokens = analyzer.analyze('The Quick Brown Fox');
    expect(tokens).toEqual(['quick', 'brown', 'fox']);
  });
});
