# @isl-lang/stdlib-search

In-memory full-text search engine with TF-IDF/BM25 scoring, faceting, and suggestions.

## Features

- **Full-text search** with configurable analyzers and tokenizers
- **Scoring algorithms**: BM25 and TF-IDF
- **Query DSL**: Support for boolean queries (AND/OR/NOT), phrases, wildcards, and fuzzy matching
- **Faceting**: Terms, ranges, histograms, and date histograms
- **Suggestions**: Autocomplete and spell-check
- **In-memory**: Efficient handling of up to ~10k documents
- **TypeScript**: Full type safety

## Installation

```bash
pnpm add @isl-lang/stdlib-search
```

## Quick Start

```typescript
import { createSearchEngine } from '@isl-lang/stdlib-search';

// Create a search engine
const engine = createSearchEngine();

// Create an index
engine.createIndex('products', {
  fields: [
    { name: 'title', type: 'text', indexed: true },
    { name: 'description', type: 'text', indexed: true },
    { name: 'price', type: 'number', indexed: true },
    { name: 'category', type: 'keyword', indexed: true }
  ]
});

// Add documents
engine.addDocument('products', {
  id: '1',
  title: 'Wireless Mouse',
  description: 'Ergonomic wireless mouse with long battery life',
  price: 29.99,
  category: 'electronics'
});

// Search
const results = await engine.search('products', 'wireless mouse', {
  from: 0,
  size: 10,
  facets: [
    { field: 'category', type: 'terms', size: 10 }
  ]
});

console.log(results.results);
console.log(results.facets?.get('category'));
```

## Query Examples

### Term Queries
```typescript
// Search in all fields
await engine.search('products', 'mouse');

// Search in specific field
await engine.search('products', 'title:mouse');
```

### Phrase Queries
```typescript
// Exact phrase match
await engine.search('products', '"wireless mouse"');
```

### Boolean Queries
```typescript
// AND
await engine.search('products', 'wireless AND mouse');

// OR
await engine.search('products', 'wireless OR bluetooth');

// NOT
await engine.search('products', 'mouse NOT keyboard');

// Complex
await engine.search('products', '(wireless OR bluetooth) AND mouse NOT cheap');
```

### Wildcard Queries
```typescript
// Single character
await engine.search('products', 'mo?se');

// Multiple characters
await engine.search('products', 'wire*');
```

### Fuzzy Queries
```typescript
// Default fuzziness (1 edit)
await engine.search('products', 'mous~');

// Specific fuzziness
await engine.search('products', 'mous~2');
```

## Query Builder

```typescript
import { QueryBuilder, match, bool } from '@isl-lang/stdlib-search';

// Using QueryBuilder class
const query = QueryBuilder
  .must(
    QueryBuilder.term('title', 'mouse'),
    QueryBuilder.term('category', 'electronics')
  )
  .addShould(
    QueryBuilder.term('description', 'ergonomic'),
    QueryBuilder.term('description', 'wireless')
  )
  .boost(1.5)
  .build();

// Using convenience functions
const query2 = bool()
  .must(
    match('title', 'mouse'),
    match('category', 'electronics')
  )
  .should(
    match('description', 'ergonomic'),
    match('description', 'wireless')
  )
  .build();
```

## Scoring

### BM25 (Default)
```typescript
const engine = createSearchEngine({
  defaultScoring: 'bm25',
  k1: 1.2,
  b: 0.75
});
```

### TF-IDF
```typescript
const engine = createSearchEngine({
  defaultScoring: 'tfidf'
});
```

## Faceting

```typescript
const results = await engine.search('products', '*', {
  facets: [
    // Terms facet
    { field: 'category', type: 'terms', size: 10 },
    
    // Range facet
    {
      field: 'price',
      type: 'range',
      ranges: [
        { key: 'cheap', from: 0, to: 50 },
        { key: 'expensive', from: 50, to: 200 }
      ]
    },
    
    // Histogram facet
    {
      field: 'price',
      type: 'histogram',
      interval: 25
    }
  ]
});
```

## Suggestions

### Autocomplete
```typescript
const suggestions = engine.suggest('products', 'wire', 'title', 5);
console.log(suggestions); // [{ text: 'wireless', score: 10 }]
```

### Spell Check
```typescript
const corrections = engine.spellCheck('products', 'mous', 5);
console.log(corrections); // [{ text: 'mouse', score: 8 }]
```

## API

### Classes

- `MemorySearchEngine` - Main search engine
- `QueryBuilder` - Build queries programmatically
- `QueryParser` - Parse query strings
- `InvertedIndexManager` - Low-level index management
- `DocumentIndexer` - Document indexing
- `FacetProcessor` - Process facets
- `Autocompleter` - Autocomplete suggestions
- `SpellChecker` - Spell checking

### Types

- `Document` - Search document
- `SearchResult` - Search result with score
- `ParsedQuery` - Parsed query object
- `FacetResult` - Facet aggregation result
- `Suggestion` - Autocomplete/spell suggestion

## Development

```bash
pnpm build        # Build the package
pnpm test         # Run tests
pnpm test:watch   # Run tests in watch mode
pnpm test:coverage # Run tests with coverage
pnpm typecheck    # Type-check without emit
pnpm clean        # Remove dist/
```

## License

MIT
