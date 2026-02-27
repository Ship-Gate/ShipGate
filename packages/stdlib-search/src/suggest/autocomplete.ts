/**
 * Autocomplete and suggestion implementations
 */

import type { Suggestion, Document, Analyzer } from '../types.js';
import type { InvertedIndexManager } from '../index/inverted-index.js';

export class Autocompleter {
  private readonly index: InvertedIndexManager;
  private readonly analyzer: Analyzer;
  private readonly suggestions: Map<string, Map<string, number>> = new Map();

  constructor(index: InvertedIndexManager, analyzer: Analyzer) {
    this.index = index;
    this.analyzer = analyzer;
  }

  /**
   * Build suggestion index from documents
   */
  buildSuggestions(documents: Document[], fields: string[]): void {
    this.suggestions.clear();

    for (const doc of documents) {
      for (const field of fields) {
        const value = doc.fields.get(field);
        if (typeof value === 'string') {
          this.addSuggestions(value, field);
        }
      }
    }
  }

  /**
   * Get autocomplete suggestions for a prefix
   */
  suggest(
    prefix: string,
    field?: string,
    size: number = 10
  ): Suggestion[] {
    const suggestions: Suggestion[] = [];
    const analyzedPrefix = this.analyzer.analyze(prefix.toLowerCase());
    
    if (analyzedPrefix.length === 0) return suggestions;

    const firstToken = analyzedPrefix[0];
    const fieldSuggestions = field 
      ? this.suggestions.get(field)
      : this.getAllFieldSuggestions();

    if (!fieldSuggestions) return suggestions;

    // Find suggestions that start with the prefix
    for (const [suggestion, count] of fieldSuggestions.entries()) {
      if (suggestion.startsWith(firstToken)) {
        suggestions.push({
          text: suggestion,
          score: this.calculateScore(suggestion, firstToken, count)
        });
      }
    }

    // Sort by score and limit
    return suggestions
      .sort((a, b) => b.score - a.score)
      .slice(0, size);
  }

  /**
   * Get phrase suggestions (completion)
   */
  suggestPhrase(
    prefix: string,
    field?: string,
    size: number = 10
  ): Suggestion[] {
    const suggestions: Suggestion[] = [];
    const allTerms = this.index.getAllTerms();

    // Find terms that can complete the phrase
    for (const term of allTerms) {
      if (term.includes(prefix.toLowerCase())) {
        const postingList = this.index.getPostingList(term);
        const score = postingList ? postingList.documentFrequency : 0;
        
        suggestions.push({
          text: term,
          score: this.calculatePhraseScore(term, prefix, score)
        });
      }
    }

    return suggestions
      .sort((a, b) => b.score - a.score)
      .slice(0, size);
  }

  private addSuggestions(text: string, field: string): void {
    if (!this.suggestions.has(field)) {
      this.suggestions.set(field, new Map());
    }

    const fieldSuggestions = this.suggestions.get(field)!;
    const words = text.toLowerCase().split(/\s+/);

    for (const word of words) {
      if (word.length > 2) { // Skip very short words
        fieldSuggestions.set(word, (fieldSuggestions.get(word) || 0) + 1);
        
        // Add sub-sequences for partial matching
        for (let i = 1; i < word.length; i++) {
          const prefix = word.substring(0, i);
          fieldSuggestions.set(prefix, (fieldSuggestions.get(prefix) || 0) + 0.1);
        }
      }
    }
  }

  private getAllFieldSuggestions(): Map<string, number> {
    const allSuggestions = new Map<string, number>();

    for (const fieldSuggestions of this.suggestions.values()) {
      for (const [suggestion, count] of fieldSuggestions.entries()) {
        allSuggestions.set(suggestion, (allSuggestions.get(suggestion) || 0) + count);
      }
    }

    return allSuggestions;
  }

  private calculateScore(suggestion: string, prefix: string, count: number): number {
    // Higher score for exact prefix matches
    let score = count;

    if (suggestion === prefix) {
      score *= 2;
    } else if (suggestion.startsWith(prefix)) {
      score *= 1.5;
    }

    // Boost shorter suggestions
    score *= (10 - Math.min(suggestion.length, 10)) / 10;

    return score;
  }

  private calculatePhraseScore(term: string, prefix: string, docFreq: number): number {
    let score = docFreq;

    // Exact match gets highest score
    if (term === prefix.toLowerCase()) {
      score *= 3;
    } else if (term.startsWith(prefix.toLowerCase())) {
      score *= 2;
    } else if (term.includes(prefix.toLowerCase())) {
      score *= 1.5;
    }

    // Consider term length
    score *= (20 - Math.min(term.length, 20)) / 20;

    return score;
  }
}

/**
 * Spell checker using edit distance
 */
export class SpellChecker {
  private readonly dictionary: Set<string> = new Set();
  private readonly index: InvertedIndexManager;

  constructor(index: InvertedIndexManager) {
    this.index = index;
    this.buildDictionary();
  }

  /**
   * Get spelling suggestions for a term
   */
  suggest(term: string, maxSuggestions: number = 5): Suggestion[] {
    const suggestions: Suggestion[] = [];
    const lowerTerm = term.toLowerCase();

    // Try to find similar words in the dictionary
    for (const word of this.dictionary) {
      if (word === lowerTerm) continue;

      const distance = this.editDistance(lowerTerm, word);
      
      if (distance <= 2 && distance > 0) { // Allow up to 2 edits
        const postingList = this.index.getPostingList(word);
        const frequency = postingList ? postingList.documentFrequency : 1;
        
        suggestions.push({
          text: word,
          score: frequency / (distance + 1) // Higher score for common words with fewer edits
        });
      }
    }

    // Sort by score and return top suggestions
    return suggestions
      .sort((a, b) => b.score - a.score)
      .slice(0, maxSuggestions);
  }

  /**
   * Check if a term is spelled correctly (exists in dictionary)
   */
  isCorrect(term: string): boolean {
    return this.dictionary.has(term.toLowerCase());
  }

  /**
   * Build dictionary from indexed terms
   */
  private buildDictionary(): void {
    const terms = this.index.getAllTerms();
    
    for (const term of terms) {
      // Only add words that look like real words (alphanumeric)
      if (/^[a-zA-Z0-9]+$/.test(term)) {
        this.dictionary.add(term.toLowerCase());
      }
    }
  }

  /**
   * Calculate Levenshtein edit distance between two strings
   */
  private editDistance(s1: string, s2: string): number {
    const matrix: number[][] = [];

    // Initialize matrix
    for (let i = 0; i <= s1.length; i++) {
      matrix[i] = [i];
    }
    for (let j = 0; j <= s2.length; j++) {
      matrix[0][j] = j;
    }

    // Fill matrix
    for (let i = 1; i <= s1.length; i++) {
      for (let j = 1; j <= s2.length; j++) {
        const cost = s1[i - 1] === s2[j - 1] ? 0 : 1;
        matrix[i][j] = Math.min(
          matrix[i - 1][j] + 1,      // deletion
          matrix[i][j - 1] + 1,      // insertion
          matrix[i - 1][j - 1] + cost // substitution
        );
      }
    }

    return matrix[s1.length][s2.length];
  }
}

/**
 * Context-aware suggester that considers previous tokens
 */
export class ContextAwareSuggester {
  private readonly index: InvertedIndexManager;
  private readonly analyzer: Analyzer;
  private readonly bigrams: Map<string, Map<string, number>> = new Map();

  constructor(index: InvertedIndexManager, analyzer: Analyzer) {
    this.index = index;
    this.analyzer = analyzer;
  }

  /**
   * Build bigram model from documents
   */
  buildBigramModel(documents: Document[], fields: string[]): void {
    this.bigrams.clear();

    for (const doc of documents) {
      for (const field of fields) {
        const value = doc.fields.get(field);
        if (typeof value === 'string') {
          this.addBigrams(value);
        }
      }
    }
  }

  /**
   * Get suggestions based on context (previous word)
   */
  suggestWithContext(
    previousToken: string,
    prefix: string,
    field?: string,
    size: number = 10
  ): Suggestion[] {
    const suggestions: Suggestion[] = [];
    const bigramSuggestions = this.bigrams.get(previousToken.toLowerCase());

    if (!bigramSuggestions) {
      // Fallback to regular suggestions
      const completer = new Autocompleter(this.index, this.analyzer);
      return completer.suggest(prefix, field, size);
    }

    // Find suggestions that match prefix and follow the previous token
    for (const [suggestion, count] of bigramSuggestions.entries()) {
      if (suggestion.startsWith(prefix.toLowerCase())) {
        suggestions.push({
          text: suggestion,
          score: count * 2 // Boost bigram suggestions
        });
      }
    }

    return suggestions
      .sort((a, b) => b.score - a.score)
      .slice(0, size);
  }

  private addBigrams(text: string): void {
    const tokens = this.analyzer.analyze(text.toLowerCase());

    for (let i = 0; i < tokens.length - 1; i++) {
      const current = tokens[i];
      const next = tokens[i + 1];

      if (!this.bigrams.has(current)) {
        this.bigrams.set(current, new Map());
      }

      const nextWords = this.bigrams.get(current)!;
      nextWords.set(next, (nextWords.get(next) || 0) + 1);
    }
  }
}
