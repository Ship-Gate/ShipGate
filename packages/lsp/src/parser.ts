/**
 * ISL Parser for LSP
 * 
 * Lightweight parser for language server features.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface Position {
  line: number;
  character: number;
}

export interface Range {
  start: Position;
  end: Position;
}

export interface Location {
  uri: string;
  range: Range;
}

export type SymbolKind = 
  | 'domain'
  | 'entity'
  | 'behavior'
  | 'type'
  | 'enum'
  | 'field'
  | 'parameter'
  | 'scenario'
  | 'invariant';

export interface Symbol {
  name: string;
  kind: SymbolKind;
  range: Range;
  selectionRange: Range;
  detail?: string;
  children?: Symbol[];
  documentation?: string;
}

export interface ParseResult {
  symbols: Symbol[];
  errors: ParseError[];
  references: Reference[];
}

export interface ParseError {
  message: string;
  range: Range;
  severity: 'error' | 'warning' | 'info' | 'hint';
}

export interface Reference {
  name: string;
  range: Range;
  definition?: Location;
}

// ─────────────────────────────────────────────────────────────────────────────
// Token Types
// ─────────────────────────────────────────────────────────────────────────────

export type TokenType =
  | 'keyword'
  | 'identifier'
  | 'string'
  | 'number'
  | 'operator'
  | 'punctuation'
  | 'comment'
  | 'whitespace'
  | 'unknown';

export interface Token {
  type: TokenType;
  value: string;
  range: Range;
}

// ─────────────────────────────────────────────────────────────────────────────
// Keywords and Patterns
// ─────────────────────────────────────────────────────────────────────────────

export const KEYWORDS = new Set([
  'domain',
  'entity',
  'behavior',
  'type',
  'enum',
  'import',
  'from',
  'version',
  'description',
  'input',
  'output',
  'success',
  'errors',
  'preconditions',
  'postconditions',
  'invariants',
  'scenarios',
  'scenario',
  'given',
  'when',
  'then',
  'and',
  'or',
  'not',
  'implies',
  'forall',
  'exists',
  'in',
  'as',
  'is',
  'null',
  'true',
  'false',
  'lifecycle',
  'temporal',
  'chaos',
  'inject',
]);

export const BUILTIN_TYPES = new Set([
  'String',
  'Int',
  'Float',
  'Boolean',
  'UUID',
  'ID',
  'Timestamp',
  'Duration',
  'Date',
  'Time',
  'DateTime',
  'Email',
  'URL',
  'JSON',
  'Any',
  'Void',
  'List',
  'Map',
  'Set',
  'Optional',
]);

// ─────────────────────────────────────────────────────────────────────────────
// Tokenizer
// ─────────────────────────────────────────────────────────────────────────────

export function tokenize(text: string): Token[] {
  const tokens: Token[] = [];
  let line = 0;
  let character = 0;
  let i = 0;

  while (i < text.length) {
    const startPos = { line, character };

    // Whitespace
    if (/\s/.test(text[i])) {
      let value = '';
      while (i < text.length && /\s/.test(text[i])) {
        if (text[i] === '\n') {
          line++;
          character = 0;
        } else {
          character++;
        }
        value += text[i];
        i++;
      }
      // Skip whitespace tokens
      continue;
    }

    // Comments
    if (text[i] === '/' && text[i + 1] === '/') {
      let value = '';
      while (i < text.length && text[i] !== '\n') {
        value += text[i];
        character++;
        i++;
      }
      tokens.push({
        type: 'comment',
        value,
        range: { start: startPos, end: { line, character } },
      });
      continue;
    }

    // Multi-line comments
    if (text[i] === '/' && text[i + 1] === '*') {
      let value = '/*';
      i += 2;
      character += 2;
      while (i < text.length && !(text[i] === '*' && text[i + 1] === '/')) {
        if (text[i] === '\n') {
          line++;
          character = 0;
        } else {
          character++;
        }
        value += text[i];
        i++;
      }
      if (i < text.length) {
        value += '*/';
        i += 2;
        character += 2;
      }
      tokens.push({
        type: 'comment',
        value,
        range: { start: startPos, end: { line, character } },
      });
      continue;
    }

    // Strings
    if (text[i] === '"' || text[i] === "'") {
      const quote = text[i];
      let value = quote;
      i++;
      character++;
      while (i < text.length && text[i] !== quote) {
        if (text[i] === '\\' && i + 1 < text.length) {
          value += text[i] + text[i + 1];
          i += 2;
          character += 2;
        } else {
          value += text[i];
          character++;
          i++;
        }
      }
      if (i < text.length) {
        value += quote;
        i++;
        character++;
      }
      tokens.push({
        type: 'string',
        value,
        range: { start: startPos, end: { line, character } },
      });
      continue;
    }

    // Numbers
    if (/\d/.test(text[i])) {
      let value = '';
      while (i < text.length && /[\d.]/.test(text[i])) {
        value += text[i];
        character++;
        i++;
      }
      tokens.push({
        type: 'number',
        value,
        range: { start: startPos, end: { line, character } },
      });
      continue;
    }

    // Identifiers and Keywords
    if (/[a-zA-Z_]/.test(text[i])) {
      let value = '';
      while (i < text.length && /[a-zA-Z0-9_]/.test(text[i])) {
        value += text[i];
        character++;
        i++;
      }
      const type = KEYWORDS.has(value) ? 'keyword' : 'identifier';
      tokens.push({
        type,
        value,
        range: { start: startPos, end: { line, character } },
      });
      continue;
    }

    // Operators and Punctuation
    const punctuation = '{}[]()<>:;,.=+-*/?!@#$%^&|~';
    if (punctuation.includes(text[i])) {
      // Check for multi-character operators
      let value = text[i];
      const twoChar = text.slice(i, i + 2);
      if (['==', '!=', '<=', '>=', '->', '=>', '&&', '||', '::'].includes(twoChar)) {
        value = twoChar;
        i++;
        character++;
      }
      tokens.push({
        type: 'operator' as TokenType,
        value,
        range: { start: startPos, end: { line, character: character + 1 } },
      });
      i++;
      character++;
      continue;
    }

    // Unknown
    tokens.push({
      type: 'unknown',
      value: text[i],
      range: { start: startPos, end: { line, character: character + 1 } },
    });
    i++;
    character++;
  }

  return tokens;
}

// ─────────────────────────────────────────────────────────────────────────────
// Parser
// ─────────────────────────────────────────────────────────────────────────────

export class IslParser {
  private tokens: Token[] = [];
  private pos = 0;
  private symbols: Symbol[] = [];
  private errors: ParseError[] = [];
  private references: Reference[] = [];

  parse(text: string, uri: string = ''): ParseResult {
    this.tokens = tokenize(text);
    this.pos = 0;
    this.symbols = [];
    this.errors = [];
    this.references = [];

    while (this.pos < this.tokens.length) {
      const token = this.current();
      
      if (token.type === 'comment') {
        this.pos++;
        continue;
      }

      if (token.type === 'keyword') {
        switch (token.value) {
          case 'domain':
            this.parseDomain();
            break;
          case 'import':
            this.parseImport();
            break;
          default:
            this.pos++;
        }
      } else {
        this.pos++;
      }
    }

    return {
      symbols: this.symbols,
      errors: this.errors,
      references: this.references,
    };
  }

  private current(): Token {
    return this.tokens[this.pos] ?? { type: 'unknown', value: '', range: { start: { line: 0, character: 0 }, end: { line: 0, character: 0 } } };
  }

  private peek(offset: number = 1): Token | undefined {
    return this.tokens[this.pos + offset];
  }

  private expect(type: TokenType, value?: string): Token | undefined {
    const token = this.current();
    if (token.type !== type || (value && token.value !== value)) {
      this.errors.push({
        message: `Expected ${value ?? type}, got ${token.value}`,
        range: token.range,
        severity: 'error',
      });
      return undefined;
    }
    this.pos++;
    return token;
  }

  private parseDomain(): void {
    const startToken = this.current();
    this.pos++; // skip 'domain'

    const nameToken = this.expect('identifier');
    if (!nameToken) return;

    const domain: Symbol = {
      name: nameToken.value,
      kind: 'domain',
      range: { start: startToken.range.start, end: startToken.range.end },
      selectionRange: nameToken.range,
      children: [],
    };

    // Expect opening brace
    if (this.current().value !== '{') {
      this.errors.push({
        message: "Expected '{' after domain name",
        range: this.current().range,
        severity: 'error',
      });
      return;
    }
    this.pos++;

    // Parse domain contents
    let braceDepth = 1;
    while (this.pos < this.tokens.length && braceDepth > 0) {
      const token = this.current();

      if (token.value === '{') {
        braceDepth++;
        this.pos++;
      } else if (token.value === '}') {
        braceDepth--;
        if (braceDepth === 0) {
          domain.range.end = token.range.end;
        }
        this.pos++;
      } else if (token.type === 'keyword' && braceDepth === 1) {
        switch (token.value) {
          case 'entity':
            const entity = this.parseEntity();
            if (entity) domain.children!.push(entity);
            break;
          case 'behavior':
            const behavior = this.parseBehavior();
            if (behavior) domain.children!.push(behavior);
            break;
          case 'type':
            const type = this.parseType();
            if (type) domain.children!.push(type);
            break;
          case 'enum':
            const enumSym = this.parseEnum();
            if (enumSym) domain.children!.push(enumSym);
            break;
          case 'version':
            this.parseVersion(domain);
            break;
          default:
            this.pos++;
        }
      } else {
        this.pos++;
      }
    }

    this.symbols.push(domain);
  }

  private parseEntity(): Symbol | undefined {
    const startToken = this.current();
    this.pos++; // skip 'entity'

    const nameToken = this.expect('identifier');
    if (!nameToken) return undefined;

    const entity: Symbol = {
      name: nameToken.value,
      kind: 'entity',
      range: { start: startToken.range.start, end: startToken.range.end },
      selectionRange: nameToken.range,
      children: [],
    };

    // Skip to opening brace
    while (this.pos < this.tokens.length && this.current().value !== '{') {
      this.pos++;
    }

    if (this.current().value !== '{') return entity;
    this.pos++;

    // Parse fields
    let braceDepth = 1;
    while (this.pos < this.tokens.length && braceDepth > 0) {
      const token = this.current();

      if (token.value === '{') {
        braceDepth++;
        this.pos++;
      } else if (token.value === '}') {
        braceDepth--;
        if (braceDepth === 0) {
          entity.range.end = token.range.end;
        }
        this.pos++;
      } else if (token.type === 'identifier' && braceDepth === 1) {
        const field = this.parseField();
        if (field) entity.children!.push(field);
      } else if (token.type === 'keyword' && braceDepth === 1) {
        if (token.value === 'invariants' || token.value === 'lifecycle') {
          // Skip these blocks
          this.skipBlock();
        } else {
          this.pos++;
        }
      } else {
        this.pos++;
      }
    }

    return entity;
  }

  private parseBehavior(): Symbol | undefined {
    const startToken = this.current();
    this.pos++; // skip 'behavior'

    const nameToken = this.expect('identifier');
    if (!nameToken) return undefined;

    const behavior: Symbol = {
      name: nameToken.value,
      kind: 'behavior',
      range: { start: startToken.range.start, end: startToken.range.end },
      selectionRange: nameToken.range,
      children: [],
    };

    // Skip to opening brace
    while (this.pos < this.tokens.length && this.current().value !== '{') {
      this.pos++;
    }

    if (this.current().value !== '{') return behavior;
    this.pos++;

    // Parse behavior contents
    let braceDepth = 1;
    while (this.pos < this.tokens.length && braceDepth > 0) {
      const token = this.current();

      if (token.value === '{') {
        braceDepth++;
        this.pos++;
      } else if (token.value === '}') {
        braceDepth--;
        if (braceDepth === 0) {
          behavior.range.end = token.range.end;
        }
        this.pos++;
      } else if (token.type === 'keyword' && braceDepth === 1) {
        if (token.value === 'input' || token.value === 'output') {
          const params = this.parseParameterBlock(token.value);
          behavior.children!.push(...params);
        } else {
          this.pos++;
        }
      } else {
        this.pos++;
      }
    }

    return behavior;
  }

  private parseType(): Symbol | undefined {
    const startToken = this.current();
    this.pos++; // skip 'type'

    const nameToken = this.expect('identifier');
    if (!nameToken) return undefined;

    const type: Symbol = {
      name: nameToken.value,
      kind: 'type',
      range: { start: startToken.range.start, end: startToken.range.end },
      selectionRange: nameToken.range,
    };

    // Skip to end of type definition
    while (this.pos < this.tokens.length) {
      const token = this.current();
      if (token.value === '{') {
        this.skipBlock();
        break;
      } else if (token.type === 'keyword' || (token.type === 'identifier' && this.peek()?.value === ':')) {
        break;
      }
      type.range.end = token.range.end;
      this.pos++;
    }

    return type;
  }

  private parseEnum(): Symbol | undefined {
    const startToken = this.current();
    this.pos++; // skip 'enum'

    const nameToken = this.expect('identifier');
    if (!nameToken) return undefined;

    const enumSym: Symbol = {
      name: nameToken.value,
      kind: 'enum',
      range: { start: startToken.range.start, end: startToken.range.end },
      selectionRange: nameToken.range,
      children: [],
    };

    // Skip to opening brace
    while (this.pos < this.tokens.length && this.current().value !== '{') {
      this.pos++;
    }

    if (this.current().value !== '{') return enumSym;
    this.pos++;

    // Parse enum values
    let braceDepth = 1;
    while (this.pos < this.tokens.length && braceDepth > 0) {
      const token = this.current();

      if (token.value === '{') {
        braceDepth++;
        this.pos++;
      } else if (token.value === '}') {
        braceDepth--;
        if (braceDepth === 0) {
          enumSym.range.end = token.range.end;
        }
        this.pos++;
      } else if (token.type === 'identifier' && braceDepth === 1) {
        enumSym.children!.push({
          name: token.value,
          kind: 'field',
          range: token.range,
          selectionRange: token.range,
        });
        this.pos++;
      } else {
        this.pos++;
      }
    }

    return enumSym;
  }

  private parseField(): Symbol | undefined {
    const nameToken = this.current();
    this.pos++;

    // Expect colon
    if (this.current().value !== ':') {
      return undefined;
    }
    this.pos++;

    // Get type
    let typeStr = '';
    const typeStart = this.current().range.start;
    while (this.pos < this.tokens.length) {
      const token = this.current();
      if (token.value === '{' || token.type === 'keyword' || 
          (token.type === 'identifier' && this.peek()?.value === ':')) {
        break;
      }
      typeStr += token.value;
      this.pos++;
    }

    // Track type reference
    const typeName = typeStr.trim().replace(/[?\[\]<>]/g, '').split(/[,\s]/)[0];
    if (typeName && !BUILTIN_TYPES.has(typeName)) {
      this.references.push({
        name: typeName,
        range: { start: typeStart, end: this.current().range.start },
      });
    }

    return {
      name: nameToken.value,
      kind: 'field',
      range: { start: nameToken.range.start, end: this.current().range.start },
      selectionRange: nameToken.range,
      detail: typeStr.trim(),
    };
  }

  private parseParameterBlock(blockName: string): Symbol[] {
    const params: Symbol[] = [];
    this.pos++; // skip 'input' or 'output'

    // Skip to opening brace
    while (this.pos < this.tokens.length && this.current().value !== '{') {
      this.pos++;
    }

    if (this.current().value !== '{') return params;
    this.pos++;

    let braceDepth = 1;
    while (this.pos < this.tokens.length && braceDepth > 0) {
      const token = this.current();

      if (token.value === '{') {
        braceDepth++;
        this.pos++;
      } else if (token.value === '}') {
        braceDepth--;
        this.pos++;
      } else if (token.type === 'identifier' && braceDepth === 1 && this.peek()?.value === ':') {
        const param = this.parseField();
        if (param) {
          param.kind = 'parameter';
          params.push(param);
        }
      } else {
        this.pos++;
      }
    }

    return params;
  }

  private parseVersion(domain: Symbol): void {
    this.pos++; // skip 'version'
    if (this.current().value === ':') {
      this.pos++;
    }
    if (this.current().type === 'string') {
      domain.detail = `v${this.current().value.replace(/"/g, '')}`;
      this.pos++;
    }
  }

  private parseImport(): void {
    this.pos++; // skip 'import'
    
    // Skip until end of line or semicolon
    while (this.pos < this.tokens.length) {
      const token = this.current();
      if (token.value === ';' || token.range.start.line > this.tokens[this.pos - 1]?.range.end.line) {
        break;
      }
      this.pos++;
    }
  }

  private skipBlock(): void {
    if (this.current().value !== '{') {
      // Find opening brace
      while (this.pos < this.tokens.length && this.current().value !== '{') {
        this.pos++;
      }
    }

    if (this.current().value !== '{') return;
    this.pos++;

    let braceDepth = 1;
    while (this.pos < this.tokens.length && braceDepth > 0) {
      if (this.current().value === '{') braceDepth++;
      if (this.current().value === '}') braceDepth--;
      this.pos++;
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Exports
// ─────────────────────────────────────────────────────────────────────────────

export function parse(text: string, uri?: string): ParseResult {
  const parser = new IslParser();
  return parser.parse(text, uri);
}
