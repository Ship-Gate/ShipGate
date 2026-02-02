/**
 * ISL Semantic Analyzer
 * 
 * Parses and analyzes ISL documents for semantic information.
 */

import { TextDocument } from 'vscode-languageserver-textdocument';
import { Position, Range } from 'vscode-languageserver';

// ============================================
// AST Node Types
// ============================================

export interface ISLNode {
  type: string;
  name?: string;
  range: Range;
  children?: ISLNode[];
}

export interface DomainNode extends ISLNode {
  type: 'domain';
  name: string;
  version?: string;
  types: TypeNode[];
  entities: EntityNode[];
  behaviors: BehaviorNode[];
  invariants: InvariantNode[];
}

export interface TypeNode extends ISLNode {
  type: 'type';
  name: string;
  baseType?: string;
  constraints: ConstraintNode[];
  fields?: FieldNode[];
}

export interface EntityNode extends ISLNode {
  type: 'entity';
  name: string;
  fields: FieldNode[];
  invariants: InvariantNode[];
}

export interface BehaviorNode extends ISLNode {
  type: 'behavior';
  name: string;
  description?: string;
  input: FieldNode[];
  output: OutputNode;
  preconditions: ConditionNode[];
  postconditions: ConditionNode[];
  invariants: InvariantNode[];
}

export interface FieldNode extends ISLNode {
  type: 'field';
  name: string;
  fieldType: string;
  optional: boolean;
  annotations: string[];
}

export interface ConstraintNode extends ISLNode {
  type: 'constraint';
  kind: string;
  value: unknown;
}

export interface InvariantNode extends ISLNode {
  type: 'invariant';
  name?: string;
  conditions: ConditionNode[];
}

export interface ConditionNode extends ISLNode {
  type: 'condition';
  expression: string;
}

export interface OutputNode extends ISLNode {
  type: 'output';
  successType?: string;
  errors: ErrorNode[];
}

export interface ErrorNode extends ISLNode {
  type: 'error';
  code: string;
  when?: string;
  retriable?: boolean;
}

// ============================================
// Symbol Table
// ============================================

export interface ISLSymbol {
  name: string;
  kind: 'domain' | 'type' | 'entity' | 'behavior' | 'field' | 'error' | 'invariant';
  uri: string;
  range: Range;
  detail?: string;
  documentation?: string;
  children?: ISLSymbol[];
}

// ============================================
// Analyzer
// ============================================

export class ISLAnalyzer {
  private documents = new Map<string, ParsedDocument>();
  private globalSymbols = new Map<string, ISLSymbol>();

  /**
   * Parse and analyze a document
   */
  analyzeDocument(document: TextDocument): ParsedDocument {
    const text = document.getText();
    const uri = document.uri;

    const parsed: ParsedDocument = {
      uri,
      version: document.version,
      domains: [],
      symbols: [],
      errors: [],
    };

    try {
      // Parse the document
      const ast = this.parse(text);
      parsed.domains = ast.domains;

      // Extract symbols
      parsed.symbols = this.extractSymbols(ast, uri);

      // Update global symbols
      for (const symbol of parsed.symbols) {
        this.globalSymbols.set(`${uri}#${symbol.name}`, symbol);
      }

      // Semantic analysis
      const errors = this.analyze(ast);
      parsed.errors = errors;
    } catch (error) {
      parsed.errors.push({
        message: error instanceof Error ? error.message : 'Parse error',
        range: { start: { line: 0, character: 0 }, end: { line: 0, character: 0 } },
        severity: 'error',
      });
    }

    this.documents.set(uri, parsed);
    return parsed;
  }

  /**
   * Get parsed document
   */
  getDocument(uri: string): ParsedDocument | undefined {
    return this.documents.get(uri);
  }

  /**
   * Remove document
   */
  removeDocument(uri: string): void {
    this.documents.delete(uri);
    // Remove symbols for this document
    for (const [key] of this.globalSymbols) {
      if (key.startsWith(uri)) {
        this.globalSymbols.delete(key);
      }
    }
  }

  /**
   * Find symbol at position
   */
  findSymbolAt(document: TextDocument, position: Position): ISLSymbol | undefined {
    const parsed = this.documents.get(document.uri);
    if (!parsed) return undefined;

    return this.findSymbolAtPosition(parsed.symbols, position);
  }

  /**
   * Find definition for symbol
   */
  findDefinition(name: string): ISLSymbol | undefined {
    for (const symbol of this.globalSymbols.values()) {
      if (symbol.name === name) {
        return symbol;
      }
    }
    return undefined;
  }

  /**
   * Get all symbols
   */
  getAllSymbols(): ISLSymbol[] {
    return Array.from(this.globalSymbols.values());
  }

  /**
   * Get completions at position
   */
  getCompletionsAt(document: TextDocument, position: Position): string[] {
    const text = document.getText();
    const offset = document.offsetAt(position);
    const lineText = text.substring(
      text.lastIndexOf('\n', offset) + 1,
      offset
    );

    const completions: string[] = [];

    // Context-aware completions
    if (lineText.includes('type ')) {
      completions.push('String', 'Int', 'Float', 'Boolean', 'UUID', 'Timestamp', 'Duration');
    } else if (lineText.includes(': ')) {
      // Field type completions
      completions.push(...this.getTypeNames());
    } else if (lineText.trim() === '' || lineText.endsWith('  ')) {
      // Top-level keywords
      completions.push(
        'domain', 'type', 'entity', 'behavior', 'enum', 'invariants',
        'scenarios', 'import', 'export'
      );
    }

    return completions;
  }

  // Private methods

  private parse(text: string): { domains: DomainNode[] } {
    // Simplified parser - real implementation would use proper parser
    const domains: DomainNode[] = [];
    const lines = text.split('\n');

    let currentDomain: DomainNode | null = null;
    let braceDepth = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (!line) continue;
      const trimmed = line.trim();

      // Track brace depth
      braceDepth += (line.match(/{/g) || []).length;
      braceDepth -= (line.match(/}/g) || []).length;

      // Domain declaration
      const domainMatch = trimmed.match(/^domain\s+(\w+)\s*{?/);
      if (domainMatch && domainMatch[1]) {
        currentDomain = {
          type: 'domain',
          name: domainMatch[1],
          range: {
            start: { line: i, character: 0 },
            end: { line: i, character: line.length },
          },
          types: [],
          entities: [],
          behaviors: [],
          invariants: [],
        };
        domains.push(currentDomain);
        continue;
      }

      // Type declaration
      const typeMatch = trimmed.match(/^type\s+(\w+)\s*=?\s*(\w+)?\s*{?/);
      if (typeMatch && typeMatch[1] && currentDomain) {
        const typeNode: TypeNode = {
          type: 'type',
          name: typeMatch[1],
          baseType: typeMatch[2],
          range: {
            start: { line: i, character: 0 },
            end: { line: i, character: line.length },
          },
          constraints: [],
        };
        currentDomain.types.push(typeNode);
        continue;
      }

      // Entity declaration
      const entityMatch = trimmed.match(/^entity\s+(\w+)\s*{?/);
      if (entityMatch && entityMatch[1] && currentDomain) {
        const entityNode: EntityNode = {
          type: 'entity',
          name: entityMatch[1],
          range: {
            start: { line: i, character: 0 },
            end: { line: i, character: line.length },
          },
          fields: [],
          invariants: [],
        };
        currentDomain.entities.push(entityNode);
        continue;
      }

      // Behavior declaration
      const behaviorMatch = trimmed.match(/^behavior\s+(\w+)\s*{?/);
      if (behaviorMatch && behaviorMatch[1] && currentDomain) {
        const behaviorNode: BehaviorNode = {
          type: 'behavior',
          name: behaviorMatch[1],
          range: {
            start: { line: i, character: 0 },
            end: { line: i, character: line.length },
          },
          input: [],
          output: { type: 'output', range: { start: { line: i, character: 0 }, end: { line: i, character: 0 } }, errors: [] },
          preconditions: [],
          postconditions: [],
          invariants: [],
        };
        currentDomain.behaviors.push(behaviorNode);
        continue;
      }
    }

    return { domains };
  }

  private extractSymbols(ast: { domains: DomainNode[] }, uri: string): ISLSymbol[] {
    const symbols: ISLSymbol[] = [];

    for (const domain of ast.domains) {
      const domainSymbol: ISLSymbol = {
        name: domain.name,
        kind: 'domain',
        uri,
        range: domain.range,
        children: [],
      };

      // Types
      for (const type of domain.types) {
        domainSymbol.children!.push({
          name: type.name,
          kind: 'type',
          uri,
          range: type.range,
          detail: type.baseType ? `= ${type.baseType}` : undefined,
        });
      }

      // Entities
      for (const entity of domain.entities) {
        domainSymbol.children!.push({
          name: entity.name,
          kind: 'entity',
          uri,
          range: entity.range,
        });
      }

      // Behaviors
      for (const behavior of domain.behaviors) {
        domainSymbol.children!.push({
          name: behavior.name,
          kind: 'behavior',
          uri,
          range: behavior.range,
          detail: behavior.description,
        });
      }

      symbols.push(domainSymbol);
    }

    return symbols;
  }

  private analyze(ast: { domains: DomainNode[] }): ParseError[] {
    const errors: ParseError[] = [];

    for (const domain of ast.domains) {
      // Check for duplicate type names
      const typeNames = new Set<string>();
      for (const type of domain.types) {
        if (typeNames.has(type.name)) {
          errors.push({
            message: `Duplicate type name: ${type.name}`,
            range: type.range,
            severity: 'error',
          });
        }
        typeNames.add(type.name);
      }

      // Check for duplicate entity names
      const entityNames = new Set<string>();
      for (const entity of domain.entities) {
        if (entityNames.has(entity.name)) {
          errors.push({
            message: `Duplicate entity name: ${entity.name}`,
            range: entity.range,
            severity: 'error',
          });
        }
        entityNames.add(entity.name);
      }

      // Check behaviors
      for (const behavior of domain.behaviors) {
        // Behaviors should have input or output
        if (behavior.input.length === 0 && behavior.output.errors.length === 0) {
          errors.push({
            message: `Behavior ${behavior.name} has no input or output defined`,
            range: behavior.range,
            severity: 'warning',
          });
        }
      }
    }

    return errors;
  }

  private findSymbolAtPosition(symbols: ISLSymbol[], position: Position): ISLSymbol | undefined {
    for (const symbol of symbols) {
      if (this.positionInRange(position, symbol.range)) {
        // Check children first
        if (symbol.children) {
          const child = this.findSymbolAtPosition(symbol.children, position);
          if (child) return child;
        }
        return symbol;
      }
    }
    return undefined;
  }

  private positionInRange(position: Position, range: Range): boolean {
    if (position.line < range.start.line || position.line > range.end.line) {
      return false;
    }
    if (position.line === range.start.line && position.character < range.start.character) {
      return false;
    }
    if (position.line === range.end.line && position.character > range.end.character) {
      return false;
    }
    return true;
  }

  private getTypeNames(): string[] {
    const types: string[] = ['String', 'Int', 'Float', 'Boolean', 'UUID', 'Timestamp', 'Duration'];
    
    for (const doc of this.documents.values()) {
      for (const domain of doc.domains) {
        for (const type of domain.types) {
          types.push(type.name);
        }
        for (const entity of domain.entities) {
          types.push(entity.name);
        }
      }
    }

    return types;
  }
}

// ============================================
// Types
// ============================================

export interface ParsedDocument {
  uri: string;
  version: number;
  domains: DomainNode[];
  symbols: ISLSymbol[];
  errors: ParseError[];
}

export interface ParseError {
  message: string;
  range: Range;
  severity: 'error' | 'warning' | 'info' | 'hint';
}
