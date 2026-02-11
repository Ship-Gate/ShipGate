/**
 * Query builder for constructing search queries programmatically
 */

import type { ParsedQuery } from '../types.js';

export class QueryBuilder {
  private query: ParsedQuery;

  constructor() {
    this.query = { type: 'term', term: '' };
  }

  /**
   * Create a term query
   */
  static term(field: string, value: string, boost?: number): QueryBuilder {
    const builder = new QueryBuilder();
    builder.query = {
      type: 'term',
      term: value.toLowerCase(),
      field,
      boost
    };
    return builder;
  }

  /**
   * Create a phrase query
   */
  static phrase(field: string, phrase: string, boost?: number): QueryBuilder {
    const builder = new QueryBuilder();
    builder.query = {
      type: 'phrase',
      terms: phrase.toLowerCase().split(/\s+/),
      field,
      boost
    };
    return builder;
  }

  /**
   * Create a wildcard query
   */
  static wildcard(field: string, pattern: string, boost?: number): QueryBuilder {
    const builder = new QueryBuilder();
    builder.query = {
      type: 'wildcard',
      term: pattern.toLowerCase(),
      field,
      boost
    };
    return builder;
  }

  /**
   * Create a fuzzy query
   */
  static fuzzy(field: string, value: string, fuzziness?: number, boost?: number): QueryBuilder {
    const builder = new QueryBuilder();
    builder.query = {
      type: 'fuzzy',
      term: value.toLowerCase(),
      field,
      fuzziness: fuzziness || 1,
      boost
    };
    return builder;
  }

  /**
   * Create a match all query
   */
  static matchAll(): QueryBuilder {
    const builder = new QueryBuilder();
    builder.query = { type: 'term', term: '*' };
    return builder;
  }

  /**
   * Add boost to the query
   */
  boost(value: number): QueryBuilder {
    this.query.boost = value;
    return this;
  }

  /**
   * Create a boolean query with must clauses (AND)
   */
  static must(...queries: (ParsedQuery | QueryBuilder)[]): QueryBuilder {
    const builder = new QueryBuilder();
    builder.query = {
      type: 'boolean',
      must: queries.map(q => q instanceof QueryBuilder ? q.query : q)
    };
    return builder;
  }

  /**
   * Create a boolean query with should clauses (OR)
   */
  static should(...queries: (ParsedQuery | QueryBuilder)[]): QueryBuilder {
    const builder = new QueryBuilder();
    builder.query = {
      type: 'boolean',
      should: queries.map(q => q instanceof QueryBuilder ? q.query : q)
    };
    return builder;
  }

  /**
   * Add a must clause to an existing boolean query
   */
  addMust(query: ParsedQuery | QueryBuilder): QueryBuilder {
    if (this.query.type !== 'boolean') {
      // Convert to boolean query
      this.query = {
        type: 'boolean',
        must: [this.query]
      };
    }
    
    this.query.must = this.query.must || [];
    this.query.must.push(query instanceof QueryBuilder ? query.query : query);
    return this;
  }

  /**
   * Add a should clause to an existing boolean query
   */
  addShould(query: ParsedQuery | QueryBuilder): QueryBuilder {
    if (this.query.type !== 'boolean') {
      // Convert to boolean query
      this.query = {
        type: 'boolean',
        should: [this.query]
      };
    }
    
    this.query.should = this.query.should || [];
    this.query.should.push(query instanceof QueryBuilder ? query.query : query);
    return this;
  }

  /**
   * Add a must_not clause to an existing boolean query
   */
  addMustNot(query: ParsedQuery | QueryBuilder): QueryBuilder {
    if (this.query.type !== 'boolean') {
      // Convert to boolean query
      this.query = {
        type: 'boolean',
        must: [this.query]
      };
    }
    
    this.query.must_not = this.query.must_not || [];
    this.query.must_not.push(query instanceof QueryBuilder ? query.query : query);
    return this;
  }

  /**
   * Set minimum should match for boolean queries
   */
  minimumShouldMatch(min: number): QueryBuilder {
    if (this.query.type === 'boolean') {
      // Note: This would need to be handled in the scorer
      // For now, we'll store it as a property
      (this.query as ParsedQuery & { minimum_should_match?: number }).minimum_should_match = min;
    }
    return this;
  }

  /**
   * Build the final query
   */
  build(): ParsedQuery {
    // Simplify boolean queries if possible
    if (this.query.type === 'boolean') {
      const boolQuery = this.query as ParsedQuery & { minimum_should_match?: number };
      
      // If only one clause type, simplify
      if (boolQuery.must && boolQuery.must.length === 1 && 
          !boolQuery.should && !boolQuery.must_not) {
        return boolQuery.must[0];
      }
      
      if (boolQuery.should && boolQuery.should.length === 1 && 
          !boolQuery.must && !boolQuery.must_not) {
        return boolQuery.should[0];
      }
    }
    
    return this.query;
  }

  /**
   * Convert to string representation
   */
  toString(): string {
    return this.queryToString(this.query);
  }

  private queryToString(query: ParsedQuery): string {
    switch (query.type) {
      case 'term': {
        const termQuery = query;
        return termQuery.field ? `${termQuery.field}:${termQuery.term}` : termQuery.term || '';
      }
      
      case 'phrase': {
        const phraseQuery = query;
        const phrase = phraseQuery.terms ? `"${phraseQuery.terms.join(' ')}"` : '""';
        return phraseQuery.field ? `${phraseQuery.field}:${phrase}` : phrase;
      }
      
      case 'wildcard': {
        const wildcardQuery = query;
        const wildcard = wildcardQuery.field ? `${wildcardQuery.field}:${wildcardQuery.term}` : wildcardQuery.term || '';
        return wildcardQuery.boost ? `${wildcard}^${wildcardQuery.boost}` : wildcard;
      }
      
      case 'fuzzy': {
        const fuzzyQuery = query;
        const fuzzy = fuzzyQuery.field ? `${fuzzyQuery.field}:${fuzzyQuery.term}` : fuzzyQuery.term || '';
        const fuzziness = fuzzyQuery.fuzziness ? `~${fuzzyQuery.fuzziness}` : '~';
        const fuzzyStr = fuzzy + fuzziness;
        return fuzzyQuery.boost ? `${fuzzyStr}^${fuzzyQuery.boost}` : fuzzyStr;
      }
      
      case 'boolean': {
        const boolQuery = query;
        const parts: string[] = [];
        
        if (boolQuery.must) {
          const mustStr = boolQuery.must
            .map(q => this.queryToString(q))
            .join(' AND ');
          parts.push(mustStr);
        }
        
        if (boolQuery.should) {
          const shouldStr = boolQuery.should
            .map(q => this.queryToString(q))
            .join(' OR ');
          if (parts.length > 0) {
            parts.push(`(${shouldStr})`);
          } else {
            parts.push(shouldStr);
          }
        }
        
        if (boolQuery.must_not) {
          const mustNotStr = boolQuery.must_not
            .map(q => `NOT ${this.queryToString(q)}`)
            .join(' ');
          parts.push(mustNotStr);
        }
        
        const result = parts.join(' ');
        return boolQuery.boost ? `(${result})^${boolQuery.boost}` : result;
      }
      
      default:
        return '';
    }
  }
}

// Convenience functions for common query patterns
export function match(field: string, value: string): QueryBuilder {
  return QueryBuilder.term(field, value);
}

export function matchPhrase(field: string, phrase: string): QueryBuilder {
  return QueryBuilder.phrase(field, phrase);
}

export function wildcard(field: string, pattern: string): QueryBuilder {
  return QueryBuilder.wildcard(field, pattern);
}

export function fuzzy(field: string, value: string, fuzziness?: number): QueryBuilder {
  return QueryBuilder.fuzzy(field, value, fuzziness);
}

export function bool(): {
  must(...queries: (ParsedQuery | QueryBuilder)[]): QueryBuilder;
  should(...queries: (ParsedQuery | QueryBuilder)[]): QueryBuilder;
  not(query: ParsedQuery | QueryBuilder): QueryBuilder;
} {
  return {
    must: (...queries) => QueryBuilder.must(...queries),
    should: (...queries) => QueryBuilder.should(...queries),
    not: (query) => QueryBuilder.must().addMustNot(query)
  };
}

export function range(field: string): {
  gt(value: number): QueryBuilder;
  gte(value: number): QueryBuilder;
  lt(value: number): QueryBuilder;
  lte(value: number): QueryBuilder;
} {
  return {
    gt: (value: number) => QueryBuilder.term(field, `>${value}`),
    gte: (value: number) => QueryBuilder.term(field, `>=${value}`),
    lt: (value: number) => QueryBuilder.term(field, `<${value}`),
    lte: (value: number) => QueryBuilder.term(field, `<=${value}`)
  };
}

export function exists(field: string): QueryBuilder {
  return QueryBuilder.term('_exists_', field);
}

export function existsField(field: string): QueryBuilder {
  return QueryBuilder.term(field, '*');
}
