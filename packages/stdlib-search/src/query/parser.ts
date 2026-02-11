/**
 * Query parser for parsing search queries into ParsedQuery objects
 */

import type { ParsedQuery } from '../types.js';

export class QueryParser {
  private readonly operators = ['AND', 'OR', 'NOT'];
  private readonly quotes = ['"', "'"];
  private readonly wildcards = ['*', '?'];
  private readonly fuzzy = '~';

  /**
   * Parse a query string into a ParsedQuery
   */
  parse(query: string, defaultField: string = '_all'): ParsedQuery {
    if (!query || query.trim() === '') {
      return { type: 'term', term: '', field: defaultField };
    }

    // Remove extra whitespace
    query = query.trim().replace(/\s+/g, ' ');

    // Check if it's a boolean query
    if (this.isBooleanQuery(query)) {
      return this.parseBooleanQuery(query, defaultField);
    }

    // Check if it's a phrase query
    if (this.isPhraseQuery(query)) {
      return this.parsePhraseQuery(query, defaultField);
    }

    // Check if it's a wildcard query
    if (this.isWildcardQuery(query)) {
      return this.parseWildcardQuery(query, defaultField);
    }

    // Check if it's a fuzzy query
    if (this.isFuzzyQuery(query)) {
      return this.parseFuzzyQuery(query, defaultField);
    }

    // Check if it has a field specifier
    if (this.hasFieldSpecifier(query)) {
      return this.parseFieldQuery(query);
    }

    // Default to term query
    return {
      type: 'term',
      term: query.toLowerCase(),
      field: defaultField
    };
  }

  /**
   * Parse a query string with advanced syntax (similar to Lucene)
   */
  parseAdvanced(query: string, defaultField: string = '_all'): ParsedQuery {
    const tokens = this.tokenizeAdvanced(query);
    return this.parseTokens(tokens, defaultField);
  }

  private isBooleanQuery(query: string): boolean {
    const upperQuery = query.toUpperCase();
    return this.operators.some(op => 
      upperQuery.includes(` ${op} `) || upperQuery.startsWith(`${op} `)
    );
  }

  private isPhraseQuery(query: string): boolean {
    return this.quotes.some(quote => 
      query.startsWith(quote) && query.endsWith(quote) && 
      query.indexOf(quote) !== query.lastIndexOf(quote)
    );
  }

  private isWildcardQuery(query: string): boolean {
    return this.wildcards.some(wc => query.includes(wc));
  }

  private isFuzzyQuery(query: string): boolean {
    return query.includes(this.fuzzy) && !query.endsWith(this.fuzzy + ' ');
  }

  private hasFieldSpecifier(query: string): boolean {
    const colonIndex = query.indexOf(':');
    return colonIndex > 0 && !query.startsWith('"') && !query.startsWith("'");
  }

  private parseBooleanQuery(query: string, defaultField: string): ParsedQuery {
    const parts = this.splitBooleanQuery(query);
    const result: ParsedQuery = {
      type: 'boolean',
      must: [],
      should: [],
      must_not: []
    };

    let i = 0;
    let currentOperator: 'AND' | 'OR' = 'OR'; // Default to OR

    while (i < parts.length) {
      const part = parts[i].trim();
      
      if (part.toUpperCase() === 'AND') {
        currentOperator = 'AND';
        i++;
      } else if (part.toUpperCase() === 'OR') {
        currentOperator = 'OR';
        i++;
      } else if (part.toUpperCase() === 'NOT') {
        i++;
        if (i < parts.length) {
          const subQuery = this.parse(parts[i], defaultField);
          result.must_not = result.must_not || [];
          result.must_not.push(subQuery);
          i++;
        }
      } else {
        const subQuery = this.parse(part, defaultField);
        
        if (currentOperator === 'AND') {
          result.must = result.must || [];
          result.must.push(subQuery);
        } else {
          result.should = result.should || [];
          result.should.push(subQuery);
        }
        i++;
      }
    }

    // Don't simplify - return the full boolean query
    // This ensures the structure is preserved for the tests
    if (result.must && result.must.length === 0) delete result.must;
    if (result.should && result.should.length === 0) delete result.should;
    if (result.must_not && result.must_not.length === 0) delete result.must_not;
    
    return result;
  }

  private parsePhraseQuery(query: string, defaultField: string): ParsedQuery {
    const quote = this.quotes.find(q => query.startsWith(q));
    if (!quote) return this.parse(query, defaultField);

    const phrase = query.slice(1, -1);
    const terms = phrase.split(/\s+/).filter(t => t.length > 0);

    return {
      type: 'phrase',
      terms: terms.map(t => t.toLowerCase()),
      field: defaultField
    };
  }

  private parseWildcardQuery(query: string, defaultField: string): ParsedQuery {
    if (this.hasFieldSpecifier(query)) {
      const [field, pattern] = query.split(':', 2);
      return {
        type: 'wildcard',
        term: pattern.toLowerCase(),
        field
      };
    }

    return {
      type: 'wildcard',
      term: query.toLowerCase(),
      field: defaultField
    };
  }

  private parseFuzzyQuery(query: string, defaultField: string): ParsedQuery {
    const fuzzyIndex = query.lastIndexOf(this.fuzzy);
    const term = query.substring(0, fuzzyIndex);
    const fuzzinessStr = query.substring(fuzzyIndex + 1);
    
    let fuzziness = 1; // Default
    if (fuzzinessStr && /^\d+(\.\d+)?$/.test(fuzzinessStr)) {
      fuzziness = parseFloat(fuzzinessStr);
    }

    if (this.hasFieldSpecifier(term)) {
      const [field, value] = term.split(':', 2);
      return {
        type: 'fuzzy',
        term: value.toLowerCase(),
        field,
        fuzziness
      };
    }

    return {
      type: 'fuzzy',
      term: term.toLowerCase(),
      field: defaultField,
      fuzziness
    };
  }

  private parseFieldQuery(query: string): ParsedQuery {
    const colonIndex = query.indexOf(':');
    const field = query.substring(0, colonIndex);
    const value = query.substring(colonIndex + 1);

    // Check if the value is a phrase
    if (this.isPhraseQuery(value)) {
      return this.parsePhraseQuery(value, field);
    }

    // Check if the value is a wildcard
    if (this.isWildcardQuery(value)) {
      return {
        type: 'wildcard',
        term: value.toLowerCase(),
        field
      };
    }

    // Check if the value is fuzzy
    if (this.isFuzzyQuery(value)) {
      return this.parseFuzzyQuery(`${field}:${value}`, field);
    }

    return {
      type: 'term',
      term: value.toLowerCase(),
      field
    };
  }

  private splitBooleanQuery(query: string): string[] {
    const parts: string[] = [];
    let current = '';
    let inQuotes = false;
    let quoteChar = '';

    for (let i = 0; i < query.length; i++) {
      const char = query[i];
      const prevChar = i > 0 ? query[i - 1] : '';

      if ((char === '"' || char === "'") && prevChar !== '\\') {
        if (!inQuotes) {
          inQuotes = true;
          quoteChar = char;
        } else if (char === quoteChar) {
          inQuotes = false;
          quoteChar = '';
        }
        current += char;
      } else if (!inQuotes && /\s/.test(char)) {
        if (current.trim()) {
          // Check if the current token is an operator
          const upperCurrent = current.trim().toUpperCase();
          if (upperCurrent === 'AND' || upperCurrent === 'OR' || upperCurrent === 'NOT') {
            parts.push(upperCurrent);
          } else {
            parts.push(current.trim());
          }
          current = '';
        }
      } else {
        current += char;
      }
    }

    if (current.trim()) {
      const upperCurrent = current.trim().toUpperCase();
      if (upperCurrent === 'AND' || upperCurrent === 'OR' || upperCurrent === 'NOT') {
        parts.push(upperCurrent);
      } else {
        parts.push(current.trim());
      }
    }

    return parts;
  }

  private tokenizeAdvanced(query: string): string[] {
    const tokens: string[] = [];
    let current = '';
    let inQuotes = false;
    let quoteChar = '';
    let i = 0;

    while (i < query.length) {
      const char = query[i];
      const prevChar = i > 0 ? query[i - 1] : '';

      if ((char === '"' || char === "'") && prevChar !== '\\') {
        if (!inQuotes) {
          if (current) {
            tokens.push(current);
            current = '';
          }
          inQuotes = true;
          quoteChar = char;
          current = char;
        } else if (char === quoteChar) {
          current += char;
          tokens.push(current);
          current = '';
          inQuotes = false;
          quoteChar = '';
        } else {
          current += char;
        }
      } else if (!inQuotes && (char === '(' || char === ')' || char === ':' || char === '~')) {
        if (current) {
          tokens.push(current);
          current = '';
        }
        tokens.push(char);
      } else if (!inQuotes && /\s/.test(char)) {
        if (current) {
          tokens.push(current);
          current = '';
        }
      } else {
        current += char;
      }

      i++;
    }

    if (current) {
      tokens.push(current);
    }

    return tokens;
  }

  private parseTokens(tokens: string[], defaultField: string): ParsedQuery {
    // Simplified token parsing - would need more complex logic for full Lucene syntax
    if (tokens.length === 0) {
      return { type: 'term', term: '', field: defaultField };
    }

    if (tokens.length === 1) {
      return this.parse(tokens[0], defaultField);
    }

    // Handle parentheses
    if (tokens[0] === '(' && tokens[tokens.length - 1] === ')') {
      return this.parseTokens(tokens.slice(1, -1), defaultField);
    }

    // Handle field:query
    const colonIndex = tokens.indexOf(':');
    if (colonIndex > 0 && colonIndex < tokens.length - 1) {
      const field = tokens[colonIndex - 1];
      const valueTokens = tokens.slice(colonIndex + 1);
      const value = valueTokens.join(' ');
      return this.parse(`${field}:${value}`, defaultField);
    }

    // Default to boolean query for multiple tokens
    return this.parseBooleanQuery(tokens.join(' '), defaultField);
  }
}
