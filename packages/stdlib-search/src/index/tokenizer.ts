/**
 * Tokenizer implementations for text processing
 */

import type { Tokenizer } from '../types.js';

export class StandardTokenizer implements Tokenizer {
  private readonly wordPattern = /\b\w+\b/g;
  private readonly emailPattern = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g;
  private readonly urlPattern = /https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)/g;

  tokenize(text: string): string[] {
    if (!text) return [];

    const tokens: string[] = [];
    const processed = text.toLowerCase();

    // Extract emails and URLs as single tokens
    const emails = processed.match(this.emailPattern) || [];
    const urls = processed.match(this.urlPattern) || [];
    
    tokens.push(...emails, ...urls);

    // Remove emails and URLs for word tokenization
    const cleanText = processed
      .replace(this.emailPattern, ' ')
      .replace(this.urlPattern, ' ');

    // Extract words
    const words = cleanText.match(this.wordPattern) || [];
    tokens.push(...words);

    return tokens;
  }
}

export class WhitespaceTokenizer implements Tokenizer {
  tokenize(text: string): string[] {
    if (!text) return [];
    return text.split(/\s+/).filter(token => token.length > 0);
  }
}

export class KeywordTokenizer implements Tokenizer {
  tokenize(text: string): string[] {
    return text ? [text] : [];
  }
}

export class LetterTokenizer implements Tokenizer {
  private readonly letterPattern = /[a-zA-Z]+/g;

  tokenize(text: string): string[] {
    if (!text) return [];
    return (text.toLowerCase().match(this.letterPattern)) || [];
  }
}

export class NGramTokenizer implements Tokenizer {
  constructor(
    private readonly minGram: number,
    private readonly maxGram: number
  ) {}

  tokenize(text: string): string[] {
    if (!text) return [];
    
    const tokens: string[] = [];
    const clean = text.toLowerCase();
    
    for (let i = 0; i < clean.length; i++) {
      for (let j = this.minGram; j <= this.maxGram && i + j <= clean.length; j++) {
        tokens.push(clean.substring(i, i + j));
      }
    }
    
    return tokens;
  }
}

export class EdgeNGramTokenizer implements Tokenizer {
  constructor(
    private readonly minGram: number,
    private readonly maxGram: number,
    private readonly side: 'front' | 'back' = 'front'
  ) {}

  tokenize(text: string): string[] {
    if (!text) return [];
    
    const tokens: string[] = [];
    const clean = text.toLowerCase();
    
    if (this.side === 'front') {
      for (let i = this.minGram; i <= this.maxGram && i <= clean.length; i++) {
        tokens.push(clean.substring(0, i));
      }
    } else {
      for (let i = this.minGram; i <= this.maxGram && i <= clean.length; i++) {
        tokens.push(clean.substring(clean.length - i));
      }
    }
    
    return tokens;
  }
}

export class PathTokenizer implements Tokenizer {
  private readonly pathSeparator = /[\\\/]/g;

  tokenize(text: string): string[] {
    if (!text) return [];
    
    const parts = text.split(this.pathSeparator);
    const tokens: string[] = [];
    
    for (const part of parts) {
      if (part) {
        tokens.push(part.toLowerCase());
        // Also split on dots, underscores, hyphens
        const subParts = part.split(/[._-]/);
        for (const subPart of subParts) {
          if (subPart && subPart !== part) {
            tokens.push(subPart.toLowerCase());
          }
        }
      }
    }
    
    return tokens;
  }
}

export class PatternTokenizer implements Tokenizer {
  constructor(private readonly pattern: RegExp) {}

  tokenize(text: string): string[] {
    if (!text) return [];
    const matches = text.toLowerCase().match(this.pattern);
    return matches || [];
  }
}

// Factory function to create tokenizers from configuration
export function createTokenizer(config: any): Tokenizer {
  switch (config.type) {
    case 'standard':
      return new StandardTokenizer();
    case 'whitespace':
      return new WhitespaceTokenizer();
    case 'keyword':
      return new KeywordTokenizer();
    case 'letter':
      return new LetterTokenizer();
    case 'ngram':
      return new NGramTokenizer(config.min_gram || 1, config.max_gram || 2);
    case 'edge_ngram':
      return new EdgeNGramTokenizer(
        config.min_gram || 1,
        config.max_gram || 2,
        config.side || 'front'
      );
    case 'path':
      return new PathTokenizer();
    case 'pattern':
      return new PatternTokenizer(new RegExp(config.pattern, config.flags || 'g'));
    default:
      return new StandardTokenizer();
  }
}
