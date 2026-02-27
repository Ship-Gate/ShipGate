/**
 * Text analyzers and filters
 */

import type { Analyzer, TokenFilter } from '../types.js';
import { createTokenizer, StandardTokenizer, KeywordTokenizer, WhitespaceTokenizer } from './tokenizer.js';

// Token Filters
export class LowercaseFilter implements TokenFilter {
  readonly name = 'lowercase';

  filter(tokens: string[]): string[] {
    return tokens.map(token => token.toLowerCase());
  }
}

export class StopFilter implements TokenFilter {
  readonly name = 'stop';
  private readonly stopWords: Set<string>;

  constructor(stopWords: string[] = []) {
    // Default English stop words
    const defaultStopWords = [
      'a', 'an', 'and', 'are', 'as', 'at', 'be', 'but', 'by', 'for',
      'if', 'in', 'into', 'is', 'it', 'no', 'not', 'of', 'on', 'or',
      'such', 'that', 'the', 'their', 'then', 'there', 'these', 'they',
      'this', 'to', 'was', 'will', 'with', 'the', 'is', 'at', 'which',
      'on', 'can', 'an', 'your', 'all', 'any', 'from', 'had', 'her',
      'his', 'how', 'our', 'than', 'their', 'them', 'there', 'when',
      'where', 'who', 'why', 'you', 'your', 'been', 'before', 'being',
      'did', 'does', 'doing', 'do', 'has', 'have', 'having', 'should',
      'so', 'too', 'very'
    ];
    
    this.stopWords = new Set([...defaultStopWords, ...stopWords.map(w => w.toLowerCase())]);
  }

  filter(tokens: string[]): string[] {
    return tokens.filter(token => !this.stopWords.has(token));
  }
}

export class SynonymFilter implements TokenFilter {
  readonly name = 'synonym';
  private readonly synonyms: Map<string, string[]>;

  constructor(synonyms: { [key: string]: string[] }) {
    this.synonyms = new Map();
    for (const [key, values] of Object.entries(synonyms)) {
      this.synonyms.set(key.toLowerCase(), values.map(v => v.toLowerCase()));
    }
  }

  filter(tokens: string[]): string[] {
    const result: string[] = [];
    
    for (const token of tokens) {
      result.push(token);
      const synonyms = this.synonyms.get(token);
      if (synonyms) {
        result.push(...synonyms);
      }
    }
    
    return result;
  }
}

export class StemmerFilter implements TokenFilter {
  readonly name = 'stemmer';
  private readonly stemmer: (word: string) => string;

  constructor(type: 'porter' | 'kstem' | 'lovins' = 'porter') {
    // Simple Porter Stemmer implementation
    this.stemmer = this.createPorterStemmer();
  }

  private createPorterStemmer() {
    return (word: string): string => {
      if (word.length < 3) return word;
      
      let stem = word.toLowerCase();
      
      // Step 1a
      if (stem.endsWith('sses')) {
        stem = stem.slice(0, -2);
      } else if (stem.endsWith('ies')) {
        stem = stem.slice(0, -2);
      } else if (stem.endsWith('ss')) {
        stem = stem.slice(0, -2);
      } else if (stem.endsWith('s')) {
        stem = stem.slice(0, -1);
      }
      
      // Step 1b
      if (stem.endsWith('eed')) {
        if (stem.length > 4) {
          stem = stem.slice(0, -1);
        }
      } else if (stem.endsWith('ed') && stem.length > 3) {
        stem = stem.slice(0, -2);
      } else if (stem.endsWith('ing') && stem.length > 4) {
        stem = stem.slice(0, -3);
      }
      
      // Step 1c
      if (stem.endsWith('y') && stem.length > 2) {
        stem = stem.slice(0, -1) + 'i';
      }
      
      return stem;
    };
  }

  filter(tokens: string[]): string[] {
    return tokens.map(token => this.stemmer(token));
  }
}

export class LengthFilter implements TokenFilter {
  readonly name = 'length';

  constructor(
    private readonly min: number = 1,
    private readonly max: number = Number.MAX_SAFE_INTEGER
  ) {}

  filter(tokens: string[]): string[] {
    return tokens.filter(token => token.length >= this.min && token.length <= this.max);
  }
}

// Analyzer implementation
export class DefaultAnalyzer implements Analyzer {
  readonly name: string;
  readonly tokenizer: Tokenizer;
  readonly filters: TokenFilter[];

  constructor(name: string, tokenizer: Tokenizer, filters: TokenFilter[] = []) {
    this.name = name;
    this.tokenizer = tokenizer;
    this.filters = filters;
  }

  analyze(text: string): string[] {
    let tokens = this.tokenizer.tokenize(text);
    
    for (const filter of this.filters) {
      tokens = filter.filter(tokens);
    }
    
    return tokens;
  }
}

// Analyzer factory
export function createAnalyzer(config: {
  name: string;
  tokenizer?: { type: string; [key: string]: unknown };
  filters?: { type: string; [key: string]: unknown }[];
}): Analyzer {
  const tokenizer = createTokenizer(config.tokenizer || { type: 'standard' });
  const filters: TokenFilter[] = [];
  
  if (config.filters) {
    for (const filterConfig of config.filters) {
      const filter = createTokenFilter(filterConfig);
      filters.push(filter);
    }
  }

  return new DefaultAnalyzer(config.name, tokenizer, filters);
}

// Helper function to create token filters
function createTokenFilter(config: { type: string; [key: string]: unknown }): TokenFilter {
  switch (config.type) {
    case 'lowercase':
      return new LowercaseFilter();
    case 'stop':
      return new StopFilter(config.stopwords as string[]);
    case 'synonym':
      return new SynonymFilter(config.synonyms as { [key: string]: string[] });
    case 'stemmer':
      return new StemmerFilter(config.algorithm as 'porter' | 'kstem' | 'lovins');
    case 'length':
      return new LengthFilter(config.min as number, config.max as number);
    default:
      throw new Error(`Unknown filter type: ${config.type}`);
  }
}

// Predefined analyzers
export const STANDARD_ANALYZER: Analyzer = new DefaultAnalyzer(
  'standard',
  new StandardTokenizer(),
  [new LowercaseFilter(), new StopFilter()]
);

export const KEYWORD_ANALYZER: Analyzer = new DefaultAnalyzer(
  'keyword',
  new KeywordTokenizer(),
  [new LowercaseFilter()]
);

export const SIMPLE_ANALYZER: Analyzer = new DefaultAnalyzer(
  'simple',
  new WhitespaceTokenizer(),
  [new LowercaseFilter()]
);

export const STOP_ANALYZER: Analyzer = new DefaultAnalyzer(
  'stop',
  new StandardTokenizer(),
  [new LowercaseFilter(), new StopFilter()]
);
