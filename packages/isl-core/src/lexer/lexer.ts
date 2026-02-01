/**
 * ISL Lexer
 * 
 * Tokenizes ISL source code into a stream of tokens.
 * Implements a hand-written lexer for full control over error handling and recovery.
 */

import {
  Token,
  TokenType,
  SourceLocation,
  createToken,
  getKeywordType,
} from './tokens.js';

export interface LexerError {
  message: string;
  line: number;
  column: number;
  offset: number;
}

export class Lexer {
  private source: string;
  private filename?: string;
  private pos: number = 0;
  private line: number = 1;
  private column: number = 1;
  private errors: LexerError[] = [];

  constructor(source: string, filename?: string) {
    this.source = source;
    this.filename = filename;
  }

  /**
   * Tokenize the entire source and return all tokens
   */
  tokenize(): { tokens: Token[]; errors: LexerError[] } {
    const tokens: Token[] = [];
    
    while (!this.isAtEnd()) {
      const token = this.nextToken();
      if (token.type !== TokenType.ERROR) {
        tokens.push(token);
      }
    }
    
    tokens.push(this.makeToken(TokenType.EOF, ''));
    
    return { tokens, errors: this.errors };
  }

  /**
   * Get the next token from the source
   */
  private nextToken(): Token {
    this.skipWhitespaceAndComments();
    
    if (this.isAtEnd()) {
      return this.makeToken(TokenType.EOF, '');
    }

    const start = this.location();
    const char = this.advance();

    // Single-character tokens
    switch (char) {
      case '{': return this.makeTokenFrom(TokenType.LBRACE, char, start);
      case '}': return this.makeTokenFrom(TokenType.RBRACE, char, start);
      case '(': return this.makeTokenFrom(TokenType.LPAREN, char, start);
      case ')': return this.makeTokenFrom(TokenType.RPAREN, char, start);
      case '[': return this.makeTokenFrom(TokenType.LBRACKET, char, start);
      case ']': return this.makeTokenFrom(TokenType.RBRACKET, char, start);
      case ':': return this.makeTokenFrom(TokenType.COLON, char, start);
      case ',': return this.makeTokenFrom(TokenType.COMMA, char, start);
      case '.': return this.makeTokenFrom(TokenType.DOT, char, start);
      case '?': return this.makeTokenFrom(TokenType.QUESTION, char, start);
      case '|': return this.makeTokenFrom(TokenType.PIPE, char, start);
      case '@': return this.makeTokenFrom(TokenType.AT, char, start);
      case '\n': return this.makeTokenFrom(TokenType.NEWLINE, char, start);
    }

    // Multi-character tokens
    if (char === '-') {
      if (this.match('>')) {
        return this.makeTokenFrom(TokenType.ARROW, '->', start);
      }
      return this.makeTokenFrom(TokenType.DASH, char, start);
    }

    if (char === '=') {
      if (this.match('=')) {
        return this.makeTokenFrom(TokenType.EQUALS, '==', start);
      }
      if (this.match('>')) {
        return this.makeTokenFrom(TokenType.FAT_ARROW, '=>', start);
      }
      return this.makeTokenFrom(TokenType.ASSIGN, char, start);
    }

    if (char === '!') {
      if (this.match('=')) {
        return this.makeTokenFrom(TokenType.NOT_EQUALS, '!=', start);
      }
      return this.error(`Unexpected character '!'`, start);
    }

    if (char === '<') {
      if (this.match('=')) {
        return this.makeTokenFrom(TokenType.LTE, '<=', start);
      }
      return this.makeTokenFrom(TokenType.LT, char, start);
    }

    if (char === '>') {
      if (this.match('=')) {
        return this.makeTokenFrom(TokenType.GTE, '>=', start);
      }
      return this.makeTokenFrom(TokenType.GT, char, start);
    }

    // Hash for comments (already handled in skipWhitespaceAndComments, but in case)
    if (char === '#') {
      // Skip to end of line
      while (!this.isAtEnd() && this.peek() !== '\n') {
        this.advance();
      }
      return this.nextToken();
    }

    // String literals
    if (char === '"') {
      return this.string(start);
    }

    // Numbers
    if (this.isDigit(char)) {
      return this.number(char, start);
    }

    // Identifiers and keywords
    if (this.isIdentifierStart(char)) {
      return this.identifier(char, start);
    }

    return this.error(`Unexpected character '${char}'`, start);
  }

  /**
   * Parse a string literal
   */
  private string(start: SourceLocation): Token {
    let value = '';
    
    while (!this.isAtEnd() && this.peek() !== '"') {
      const char = this.advance();
      
      if (char === '\n') {
        return this.error('Unterminated string literal', start);
      }
      
      if (char === '\\') {
        // Escape sequences
        if (this.isAtEnd()) {
          return this.error('Unterminated escape sequence', start);
        }
        const escaped = this.advance();
        switch (escaped) {
          case 'n': value += '\n'; break;
          case 't': value += '\t'; break;
          case 'r': value += '\r'; break;
          case '\\': value += '\\'; break;
          case '"': value += '"'; break;
          default:
            return this.error(`Invalid escape sequence '\\${escaped}'`, start);
        }
      } else {
        value += char;
      }
    }

    if (this.isAtEnd()) {
      return this.error('Unterminated string literal', start);
    }

    this.advance(); // Consume closing quote
    return this.makeTokenFrom(TokenType.STRING, value, start);
  }

  /**
   * Parse a number literal
   */
  private number(first: string, start: SourceLocation): Token {
    let value = first;
    
    while (this.isDigit(this.peek())) {
      value += this.advance();
    }

    // Check for decimal
    if (this.peek() === '.' && this.isDigit(this.peekNext())) {
      value += this.advance(); // Consume '.'
      while (this.isDigit(this.peek())) {
        value += this.advance();
      }
    }

    // Check for duration suffix (ms, s, m, h)
    if (this.isAlpha(this.peek())) {
      while (this.isAlphaNumeric(this.peek())) {
        value += this.advance();
      }
    }

    return this.makeTokenFrom(TokenType.NUMBER, value, start);
  }

  /**
   * Parse an identifier or keyword
   */
  private identifier(first: string, start: SourceLocation): Token {
    let value = first;
    
    while (this.isIdentifierPart(this.peek())) {
      value += this.advance();
    }

    const type = getKeywordType(value);
    return this.makeTokenFrom(type, value, start);
  }

  /**
   * Skip whitespace and comments
   */
  private skipWhitespaceAndComments(): void {
    while (!this.isAtEnd()) {
      const char = this.peek();
      
      switch (char) {
        case ' ':
        case '\t':
        case '\r':
          this.advance();
          break;
        case '#':
          // Line comment with #
          while (!this.isAtEnd() && this.peek() !== '\n') {
            this.advance();
          }
          break;
        case '/':
          // Check for // line comment
          if (this.peekNext() === '/') {
            while (!this.isAtEnd() && this.peek() !== '\n') {
              this.advance();
            }
            break;
          }
          return; // Not a comment, let tokenizer handle /
        default:
          return;
      }
    }
  }

  // Helper methods

  private isAtEnd(): boolean {
    return this.pos >= this.source.length;
  }

  private peek(): string {
    if (this.isAtEnd()) return '\0';
    return this.source[this.pos]!;
  }

  private peekNext(): string {
    if (this.pos + 1 >= this.source.length) return '\0';
    return this.source[this.pos + 1]!;
  }

  private advance(): string {
    const char = this.source[this.pos]!;
    this.pos++;
    if (char === '\n') {
      this.line++;
      this.column = 1;
    } else {
      this.column++;
    }
    return char;
  }

  private match(expected: string): boolean {
    if (this.isAtEnd()) return false;
    if (this.source[this.pos] !== expected) return false;
    this.advance();
    return true;
  }

  private location(): SourceLocation {
    return {
      line: this.line,
      column: this.column,
      offset: this.pos,
    };
  }

  private makeToken(type: TokenType, value: string): Token {
    const loc = this.location();
    return createToken(type, value, loc, loc, this.filename);
  }

  private makeTokenFrom(type: TokenType, value: string, start: SourceLocation): Token {
    return createToken(type, value, start, this.location(), this.filename);
  }

  private error(message: string, start: SourceLocation): Token {
    this.errors.push({
      message,
      line: start.line,
      column: start.column,
      offset: start.offset,
    });
    return createToken(TokenType.ERROR, '', start, this.location(), this.filename);
  }

  private isDigit(char: string): boolean {
    return char >= '0' && char <= '9';
  }

  private isAlpha(char: string): boolean {
    return (char >= 'a' && char <= 'z') ||
           (char >= 'A' && char <= 'Z') ||
           char === '_';
  }

  private isAlphaNumeric(char: string): boolean {
    return this.isAlpha(char) || this.isDigit(char);
  }

  private isIdentifierStart(char: string): boolean {
    return this.isAlpha(char);
  }

  private isIdentifierPart(char: string): boolean {
    return this.isAlphaNumeric(char);
  }
}

/**
 * Convenience function to tokenize ISL source
 */
export function tokenize(source: string, filename?: string): { tokens: Token[]; errors: LexerError[] } {
  const lexer = new Lexer(source, filename);
  return lexer.tokenize();
}
