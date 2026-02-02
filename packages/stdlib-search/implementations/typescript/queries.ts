// ============================================================================
// Search Standard Library - Query Builders
// @isl-lang/stdlib-search
// ============================================================================

import type {
  Query,
  MatchQuery,
  MultiMatchQuery,
  QueryStringQuery,
  TermQuery,
  TermsQuery,
  RangeQuery,
  ExistsQuery,
  PrefixQuery,
  WildcardQuery,
  FuzzyQuery,
  RegexpQuery,
  BoolQuery,
  BoostingQuery,
  ConstantScoreQuery,
  DisMaxQuery,
  GeoDistanceQuery,
  GeoBoundingBoxQuery,
  KnnQuery,
  MatchAllQuery,
  GeoPoint,
  Distance,
  MatchOperator,
  MultiMatchType,
  Fuzziness,
} from './types.js';

// ============================================================================
// Full-text Query Builders
// ============================================================================

/**
 * Creates a match query for full-text search on a single field
 */
export function match(
  field: string,
  query: string,
  options?: {
    operator?: MatchOperator;
    fuzziness?: Fuzziness;
    minimum_should_match?: string;
    boost?: number;
  }
): MatchQuery {
  return {
    type: 'match',
    field,
    query,
    ...options,
  };
}

/**
 * Creates a multi-match query for searching across multiple fields
 */
export function multiMatch(
  fields: string[],
  query: string,
  options?: {
    match_type?: MultiMatchType;
    tie_breaker?: number;
    boost?: number;
  }
): MultiMatchQuery {
  return {
    type: 'multi_match',
    fields,
    query,
    ...options,
  };
}

/**
 * Creates a query string query for advanced search syntax
 */
export function queryString(
  query: string,
  options?: {
    default_field?: string;
    default_operator?: MatchOperator;
    allow_leading_wildcard?: boolean;
    boost?: number;
  }
): QueryStringQuery {
  return {
    type: 'query_string',
    query,
    ...options,
  };
}

// ============================================================================
// Term-level Query Builders
// ============================================================================

/**
 * Creates a term query for exact value matching
 */
export function term(
  field: string,
  value: unknown,
  options?: { boost?: number }
): TermQuery {
  return {
    type: 'term',
    field,
    value,
    ...options,
  };
}

/**
 * Creates a terms query for matching any of multiple values
 */
export function terms(
  field: string,
  values: unknown[],
  options?: { boost?: number }
): TermsQuery {
  return {
    type: 'terms',
    field,
    values,
    ...options,
  };
}

/**
 * Creates a range query for numeric/date ranges
 */
export function range(
  field: string,
  conditions: {
    gt?: unknown;
    gte?: unknown;
    lt?: unknown;
    lte?: unknown;
  },
  options?: { boost?: number }
): RangeQuery {
  return {
    type: 'range',
    field,
    ...conditions,
    ...options,
  };
}

/**
 * Creates an exists query to check if a field has a value
 */
export function exists(field: string, options?: { boost?: number }): ExistsQuery {
  return {
    type: 'exists',
    field,
    ...options,
  };
}

/**
 * Creates a prefix query for prefix matching
 */
export function prefix(
  field: string,
  value: string,
  options?: { boost?: number }
): PrefixQuery {
  return {
    type: 'prefix',
    field,
    value,
    ...options,
  };
}

/**
 * Creates a wildcard query with * and ? wildcards
 */
export function wildcard(
  field: string,
  value: string,
  options?: { boost?: number }
): WildcardQuery {
  return {
    type: 'wildcard',
    field,
    value,
    ...options,
  };
}

/**
 * Creates a fuzzy query for approximate matching
 */
export function fuzzy(
  field: string,
  value: string,
  fuzziness: Fuzziness,
  options?: { boost?: number }
): FuzzyQuery {
  return {
    type: 'fuzzy',
    field,
    value,
    fuzziness,
    ...options,
  };
}

/**
 * Creates a regexp query for regular expression matching
 */
export function regexp(
  field: string,
  value: string,
  options?: { flags?: string; boost?: number }
): RegexpQuery {
  return {
    type: 'regexp',
    field,
    value,
    ...options,
  };
}

// ============================================================================
// Compound Query Builders
// ============================================================================

/**
 * Creates a bool query for combining multiple queries
 */
export function bool(clauses: {
  must?: Query[];
  should?: Query[];
  must_not?: Query[];
  filter?: Query[];
  minimum_should_match?: number;
  boost?: number;
}): BoolQuery {
  return {
    type: 'bool',
    ...clauses,
  };
}

/**
 * Creates a boosting query for boosting/demoting results
 */
export function boosting(
  positive: Query,
  negative: Query,
  negative_boost: number,
  options?: { boost?: number }
): BoostingQuery {
  return {
    type: 'boosting',
    positive,
    negative,
    negative_boost,
    ...options,
  };
}

/**
 * Creates a constant score query for fixed scoring
 */
export function constantScore(
  filter: Query,
  score: number,
  options?: { boost?: number }
): ConstantScoreQuery {
  return {
    type: 'constant_score',
    filter,
    score,
    ...options,
  };
}

/**
 * Creates a dis_max query for best-matching query selection
 */
export function disMax(
  queries: Query[],
  options?: { tie_breaker?: number; boost?: number }
): DisMaxQuery {
  return {
    type: 'dis_max',
    queries,
    ...options,
  };
}

// ============================================================================
// Geo Query Builders
// ============================================================================

/**
 * Creates a geo distance query for location-based filtering
 */
export function geoDistance(
  field: string,
  location: GeoPoint,
  distance: Distance,
  options?: { boost?: number }
): GeoDistanceQuery {
  return {
    type: 'geo_distance',
    field,
    location,
    distance,
    ...options,
  };
}

/**
 * Creates a geo bounding box query for rectangular area filtering
 */
export function geoBoundingBox(
  field: string,
  top_left: GeoPoint,
  bottom_right: GeoPoint,
  options?: { boost?: number }
): GeoBoundingBoxQuery {
  return {
    type: 'geo_bounding_box',
    field,
    top_left,
    bottom_right,
    ...options,
  };
}

// ============================================================================
// Vector Query Builders
// ============================================================================

/**
 * Creates a KNN query for vector similarity search
 */
export function knn(
  field: string,
  query_vector: number[],
  k: number,
  options?: { num_candidates?: number; boost?: number }
): KnnQuery {
  return {
    type: 'knn',
    field,
    query_vector,
    k,
    ...options,
  };
}

// ============================================================================
// Special Query Builders
// ============================================================================

/**
 * Creates a match_all query that matches all documents
 */
export function matchAll(options?: { boost?: number }): MatchAllQuery {
  return {
    type: 'match_all',
    ...options,
  };
}

// ============================================================================
// Query Composition Utilities
// ============================================================================

/**
 * Combines multiple queries with AND logic (all must match)
 */
export function and(...queries: Query[]): BoolQuery {
  return bool({ must: queries });
}

/**
 * Combines multiple queries with OR logic (any must match)
 */
export function or(...queries: Query[]): BoolQuery {
  return bool({ should: queries, minimum_should_match: 1 });
}

/**
 * Negates a query (must not match)
 */
export function not(query: Query): BoolQuery {
  return bool({ must_not: [query] });
}

/**
 * Creates a filter query (affects results but not scoring)
 */
export function filter(...queries: Query[]): BoolQuery {
  return bool({ filter: queries });
}
