// ============================================================================
// ISL Language Analyzer
// Integrates parser and type checker for language intelligence
// ============================================================================

import { parse, type ParseResult, type Domain, type SourceLocation, type ASTNode } from '@intentos/parser';
import { TypeChecker, type TypeCheckResult, type Diagnostic as TypeDiagnostic } from '@intentos/typechecker';
import type { ISLDiagnostic, ISLSymbolInfo, SymbolKind } from './types.js';
import { DiagnosticSeverity } from './types.js';

// ============================================================================
// Analysis Options
// ============================================================================

export interface AnalysisOptions {
  /** File path for error reporting */
  filePath: string;
  /** Whether to run type checking (slower but more thorough) */
  typeCheck?: boolean;
  /** Whether to collect symbols for outline view */
  collectSymbols?: boolean;
  /** Whether to collect references for go-to-definition */
  collectReferences?: boolean;
}

// ============================================================================
// Analysis Result
// ============================================================================

export interface AnalysisResult {
  /** Whether parsing succeeded (may have recovered from errors) */
  parseSuccess: boolean;
  /** Whether type checking passed */
  typeCheckSuccess: boolean;
  /** The parsed AST domain, if parsing succeeded */
  domain?: Domain;
  /** All diagnostics (parse errors + type errors + warnings) */
  diagnostics: ISLDiagnostic[];
  /** Document symbols for outline view */
  symbols: ISLSymbolInfo[];
  /** All references in the document (for go-to-definition) */
  references: Map<string, SourceLocation[]>;
  /** Type information map for hover */
  typeMap: Map<ASTNode, string>;
  /** Parse time in ms */
  parseTimeMs: number;
  /** Type check time in ms */
  typeCheckTimeMs: number;
}

// ============================================================================
// Analyzer Class
// ============================================================================

export class ISLAnalyzer {
  private typeChecker: TypeChecker;

  constructor() {
    this.typeChecker = new TypeChecker();
  }

  /**
   * Analyze ISL source code
   */
  analyze(source: string, options: AnalysisOptions): AnalysisResult {
    const result: AnalysisResult = {
      parseSuccess: false,
      typeCheckSuccess: false,
      diagnostics: [],
      symbols: [],
      references: new Map(),
      typeMap: new Map(),
      parseTimeMs: 0,
      typeCheckTimeMs: 0,
    };

    // Phase 1: Parse
    const parseStart = performance.now();
    let parseResult: ParseResult;
    try {
      parseResult = parse(source, options.filePath);
      result.parseSuccess = parseResult.success;
      result.domain = parseResult.domain;

      // Convert parse errors to diagnostics
      for (const error of parseResult.errors) {
        result.diagnostics.push(this.convertParserDiagnostic(error));
      }
    } catch (e) {
      // Catastrophic parse failure
      result.diagnostics.push({
        message: `Parse error: ${e instanceof Error ? e.message : String(e)}`,
        severity: DiagnosticSeverity.Error,
        location: {
          file: options.filePath,
          line: 1,
          column: 1,
          endLine: 1,
          endColumn: 1,
        },
        code: 'ISL0001',
        source: 'isl-parser',
      });
      result.parseTimeMs = performance.now() - parseStart;
      return result;
    }
    result.parseTimeMs = performance.now() - parseStart;

    // Phase 2: Type Check (if enabled and parse succeeded with domain)
    if (options.typeCheck && parseResult.domain) {
      const typeCheckStart = performance.now();
      try {
        const typeResult = this.typeChecker.check(parseResult.domain);
        result.typeCheckSuccess = typeResult.success;

        // Convert type errors to diagnostics
        for (const diag of typeResult.diagnostics) {
          result.diagnostics.push(this.convertTypeDiagnostic(diag));
        }

        // Store type map for hover
        // Note: TypeChecker returns Map<ASTNode, ResolvedType>, we convert to string for simplicity
        for (const [node, type] of typeResult.typeMap) {
          result.typeMap.set(node, this.typeToString(type));
        }
      } catch (e) {
        result.diagnostics.push({
          message: `Type check error: ${e instanceof Error ? e.message : String(e)}`,
          severity: DiagnosticSeverity.Warning,
          location: parseResult.domain.location,
          code: 'ISL0002',
          source: 'isl-typechecker',
        });
      }
      result.typeCheckTimeMs = performance.now() - typeCheckStart;
    }

    // Phase 3: Collect symbols (if enabled)
    if (options.collectSymbols && parseResult.domain) {
      result.symbols = this.collectSymbols(parseResult.domain);
    }

    // Phase 4: Collect references (if enabled)
    if (options.collectReferences && parseResult.domain) {
      result.references = this.collectReferences(parseResult.domain);
    }

    // Phase 5: Add semantic warnings
    if (parseResult.domain) {
      result.diagnostics.push(...this.analyzeSemantics(parseResult.domain, options.filePath));
    }

    return result;
  }

  // ============================================================================
  // Symbol Collection
  // ============================================================================

  private collectSymbols(domain: Domain): ISLSymbolInfo[] {
    const symbols: ISLSymbolInfo[] = [];

    // Domain itself
    const domainSymbol: ISLSymbolInfo = {
      name: domain.name.name,
      kind: 'domain',
      location: domain.location,
      selectionLocation: domain.name.location,
      detail: `v${domain.version?.value || 'unknown'}`,
      children: [],
    };

    // Types
    for (const type of domain.types) {
      const typeSymbol: ISLSymbolInfo = {
        name: type.name.name,
        kind: this.getTypeKind(type),
        location: type.location,
        selectionLocation: type.name.location,
        detail: this.getTypeDetail(type),
        parent: domain.name.name,
      };

      // Enum variants or struct fields as children
      if (type.definition.kind === 'EnumType') {
        typeSymbol.children = type.definition.variants.map(v => ({
          name: v.name.name,
          kind: 'variant' as SymbolKind,
          location: v.location,
          selectionLocation: v.name.location,
          parent: type.name.name,
        }));
      } else if (type.definition.kind === 'StructType') {
        typeSymbol.children = type.definition.fields.map(f => ({
          name: f.name.name,
          kind: 'field' as SymbolKind,
          location: f.location,
          selectionLocation: f.name.location,
          detail: this.getFieldTypeString(f),
          parent: type.name.name,
        }));
      }

      domainSymbol.children?.push(typeSymbol);
    }

    // Entities
    for (const entity of domain.entities) {
      const entitySymbol: ISLSymbolInfo = {
        name: entity.name.name,
        kind: 'entity',
        location: entity.location,
        selectionLocation: entity.name.location,
        parent: domain.name.name,
        children: [],
      };

      // Entity fields
      for (const field of entity.fields) {
        entitySymbol.children?.push({
          name: field.name.name,
          kind: 'field',
          location: field.location,
          selectionLocation: field.name.location,
          detail: this.getFieldTypeString(field),
          parent: entity.name.name,
        });
      }

      // Lifecycle states
      if (entity.lifecycle) {
        const states = new Set<string>();
        for (const transition of entity.lifecycle.transitions) {
          states.add(transition.from.name);
          states.add(transition.to.name);
        }
        for (const state of states) {
          entitySymbol.children?.push({
            name: state,
            kind: 'lifecycle-state',
            location: entity.lifecycle.location,
            selectionLocation: entity.lifecycle.location,
            parent: entity.name.name,
          });
        }
      }

      domainSymbol.children?.push(entitySymbol);
    }

    // Behaviors
    for (const behavior of domain.behaviors) {
      const behaviorSymbol: ISLSymbolInfo = {
        name: behavior.name.name,
        kind: 'behavior',
        location: behavior.location,
        selectionLocation: behavior.name.location,
        detail: behavior.description?.value,
        parent: domain.name.name,
        children: [],
      };

      // Input fields
      for (const field of behavior.input.fields) {
        behaviorSymbol.children?.push({
          name: field.name.name,
          kind: 'input',
          location: field.location,
          selectionLocation: field.name.location,
          detail: this.getFieldTypeString(field),
          parent: behavior.name.name,
        });
      }

      // Output type
      behaviorSymbol.children?.push({
        name: 'success',
        kind: 'output',
        location: behavior.output.location,
        selectionLocation: behavior.output.location,
        detail: this.getTypeDefString(behavior.output.success),
        parent: behavior.name.name,
      });

      // Errors
      for (const error of behavior.output.errors) {
        behaviorSymbol.children?.push({
          name: error.name.name,
          kind: 'error',
          location: error.location,
          selectionLocation: error.name.location,
          detail: error.when?.value,
          parent: behavior.name.name,
        });
      }

      domainSymbol.children?.push(behaviorSymbol);
    }

    // Invariants
    for (const invariant of domain.invariants) {
      domainSymbol.children?.push({
        name: invariant.name.name,
        kind: 'invariant',
        location: invariant.location,
        selectionLocation: invariant.name.location,
        detail: invariant.description?.value,
        parent: domain.name.name,
      });
    }

    // Policies
    for (const policy of domain.policies) {
      domainSymbol.children?.push({
        name: policy.name.name,
        kind: 'policy',
        location: policy.location,
        selectionLocation: policy.name.location,
        parent: domain.name.name,
      });
    }

    // Views
    for (const view of domain.views) {
      domainSymbol.children?.push({
        name: view.name.name,
        kind: 'view',
        location: view.location,
        selectionLocation: view.name.location,
        parent: domain.name.name,
      });
    }

    // Scenarios
    for (const scenarioBlock of domain.scenarios) {
      for (const scenario of scenarioBlock.scenarios) {
        domainSymbol.children?.push({
          name: scenario.name.value,
          kind: 'scenario',
          location: scenario.location,
          selectionLocation: scenario.name.location,
          detail: `for ${scenarioBlock.behaviorName.name}`,
          parent: domain.name.name,
        });
      }
    }

    // Chaos tests
    for (const chaosBlock of domain.chaos) {
      for (const chaos of chaosBlock.scenarios) {
        domainSymbol.children?.push({
          name: chaos.name.value,
          kind: 'chaos',
          location: chaos.location,
          selectionLocation: chaos.name.location,
          detail: `for ${chaosBlock.behaviorName.name}`,
          parent: domain.name.name,
        });
      }
    }

    symbols.push(domainSymbol);
    return symbols;
  }

  // ============================================================================
  // Reference Collection
  // ============================================================================

  private collectReferences(domain: Domain): Map<string, SourceLocation[]> {
    const refs = new Map<string, SourceLocation[]>();

    const addRef = (name: string, loc: SourceLocation) => {
      const existing = refs.get(name) || [];
      existing.push(loc);
      refs.set(name, existing);
    };

    // Collect type references from fields
    const collectFromType = (typeDef: unknown) => {
      if (!typeDef || typeof typeDef !== 'object') return;
      const t = typeDef as Record<string, unknown>;
      
      if (t.kind === 'ReferenceType' && t.name && typeof t.name === 'object') {
        const name = t.name as { parts?: Array<{ name: string; location: SourceLocation }> };
        if (name.parts && name.parts.length > 0) {
          const part = name.parts[0];
          if (part) {
            addRef(part.name, part.location);
          }
        }
      }
      
      // Recurse into container types
      if (t.element) collectFromType(t.element);
      if (t.key) collectFromType(t.key);
      if (t.value) collectFromType(t.value);
      if (t.inner) collectFromType(t.inner);
      if (t.base) collectFromType(t.base);
    };

    // Collect from all entities
    for (const entity of domain.entities) {
      for (const field of entity.fields) {
        collectFromType(field.type);
      }
    }

    // Collect from all behaviors
    for (const behavior of domain.behaviors) {
      for (const field of behavior.input.fields) {
        collectFromType(field.type);
      }
      collectFromType(behavior.output.success);
    }

    // Collect from all type definitions
    for (const type of domain.types) {
      if (type.definition.kind === 'StructType') {
        for (const field of type.definition.fields) {
          collectFromType(field.type);
        }
      }
    }

    return refs;
  }

  // ============================================================================
  // Semantic Analysis
  // ============================================================================

  private analyzeSemantics(domain: Domain, filePath: string): ISLDiagnostic[] {
    const diagnostics: ISLDiagnostic[] = [];

    // Check for behaviors without postconditions
    for (const behavior of domain.behaviors) {
      if (behavior.postconditions.length === 0) {
        diagnostics.push({
          message: `Behavior '${behavior.name.name}' has no postconditions`,
          severity: DiagnosticSeverity.Warning,
          location: behavior.name.location,
          code: 'ISL1001',
          source: 'isl-analyzer',
          data: {
            type: 'missing-postcondition',
            behaviorName: behavior.name.name,
          },
        });
      }

      // Check for behaviors with preconditions but no error cases
      if (behavior.preconditions.length > 0 && behavior.output.errors.length === 0) {
        diagnostics.push({
          message: `Behavior '${behavior.name.name}' has preconditions but no error cases defined`,
          severity: DiagnosticSeverity.Hint,
          location: behavior.name.location,
          code: 'ISL1002',
          source: 'isl-analyzer',
        });
      }
    }

    // Check for unused types
    const usedTypes = new Set<string>();
    
    // Collect used types from entities
    for (const entity of domain.entities) {
      for (const field of entity.fields) {
        this.collectUsedTypes(field.type, usedTypes);
      }
    }

    // Collect used types from behaviors
    for (const behavior of domain.behaviors) {
      for (const field of behavior.input.fields) {
        this.collectUsedTypes(field.type, usedTypes);
      }
      this.collectUsedTypes(behavior.output.success, usedTypes);
    }

    // Report unused types
    for (const type of domain.types) {
      if (!usedTypes.has(type.name.name)) {
        diagnostics.push({
          message: `Type '${type.name.name}' is defined but never used`,
          severity: DiagnosticSeverity.Hint,
          location: type.name.location,
          code: 'ISL1003',
          source: 'isl-analyzer',
        });
      }
    }

    // Check for scenarios without corresponding behaviors
    for (const scenarioBlock of domain.scenarios) {
      const behaviorExists = domain.behaviors.some(b => b.name.name === scenarioBlock.behaviorName.name);
      if (!behaviorExists) {
        diagnostics.push({
          message: `Scenarios reference undefined behavior '${scenarioBlock.behaviorName.name}'`,
          severity: DiagnosticSeverity.Error,
          location: scenarioBlock.behaviorName.location,
          code: 'ISL1004',
          source: 'isl-analyzer',
        });
      }
    }

    return diagnostics;
  }

  private collectUsedTypes(typeDef: unknown, usedTypes: Set<string>): void {
    if (!typeDef || typeof typeDef !== 'object') return;
    const t = typeDef as Record<string, unknown>;

    if (t.kind === 'ReferenceType' && t.name && typeof t.name === 'object') {
      const name = t.name as { parts?: Array<{ name: string }> };
      if (name.parts && name.parts.length > 0 && name.parts[0]) {
        usedTypes.add(name.parts[0].name);
      }
    }

    // Recurse into container types
    if (t.element) this.collectUsedTypes(t.element, usedTypes);
    if (t.key) this.collectUsedTypes(t.key, usedTypes);
    if (t.value) this.collectUsedTypes(t.value, usedTypes);
    if (t.inner) this.collectUsedTypes(t.inner, usedTypes);
    if (t.base) this.collectUsedTypes(t.base, usedTypes);
  }

  // ============================================================================
  // Helper Methods
  // ============================================================================

  private convertParserDiagnostic(error: { message: string; location: SourceLocation; code?: string }): ISLDiagnostic {
    return {
      message: error.message,
      severity: DiagnosticSeverity.Error,
      location: error.location,
      code: error.code || 'ISL0001',
      source: 'isl-parser',
    };
  }

  private convertTypeDiagnostic(diag: TypeDiagnostic): ISLDiagnostic {
    return {
      message: diag.message,
      severity: diag.severity === 'error' ? DiagnosticSeverity.Error :
                diag.severity === 'warning' ? DiagnosticSeverity.Warning :
                DiagnosticSeverity.Information,
      location: diag.location,
      code: diag.code || 'ISL0002',
      source: 'isl-typechecker',
    };
  }

  private typeToString(type: unknown): string {
    if (!type || typeof type !== 'object') return 'unknown';
    const t = type as Record<string, unknown>;

    switch (t.kind) {
      case 'primitive':
        return String(t.name);
      case 'entity':
        return `entity ${t.name}`;
      case 'behavior':
        return `behavior ${t.name}`;
      case 'list':
        return `List<${this.typeToString(t.element)}>`;
      case 'map':
        return `Map<${this.typeToString(t.key)}, ${this.typeToString(t.value)}>`;
      case 'optional':
        return `${this.typeToString(t.inner)}?`;
      case 'struct':
        return 'struct';
      case 'enum':
        return 'enum';
      default:
        return 'unknown';
    }
  }

  private getTypeKind(type: { definition: { kind: string } }): SymbolKind {
    switch (type.definition.kind) {
      case 'EnumType': return 'enum';
      case 'StructType': return 'type';
      default: return 'type';
    }
  }

  private getTypeDetail(type: { definition: { kind: string } }): string {
    switch (type.definition.kind) {
      case 'EnumType': return 'enum';
      case 'StructType': return 'struct';
      case 'PrimitiveType': return 'alias';
      case 'ConstrainedType': return 'constrained';
      default: return 'type';
    }
  }

  private getFieldTypeString(field: { type: unknown; optional: boolean }): string {
    const typeStr = this.getTypeDefString(field.type);
    return field.optional ? `${typeStr}?` : typeStr;
  }

  private getTypeDefString(typeDef: unknown): string {
    if (!typeDef || typeof typeDef !== 'object') return 'unknown';
    const t = typeDef as Record<string, unknown>;

    switch (t.kind) {
      case 'PrimitiveType':
        return String(t.name);
      case 'ReferenceType': {
        const name = t.name as { parts?: Array<{ name: string }> };
        return name.parts?.map(p => p.name).join('.') || 'unknown';
      }
      case 'ListType':
        return `List<${this.getTypeDefString(t.element)}>`;
      case 'MapType':
        return `Map<${this.getTypeDefString(t.key)}, ${this.getTypeDefString(t.value)}>`;
      case 'OptionalType':
        return `${this.getTypeDefString(t.inner)}?`;
      default:
        return 'unknown';
    }
  }
}
