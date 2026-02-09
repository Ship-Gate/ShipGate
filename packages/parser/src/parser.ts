// ============================================================================
// ISL Recursive Descent Parser
// ============================================================================

import type { Token, TokenKind } from './tokens.js';
import { isPrimitiveType } from './tokens.js';
import * as AST from './ast.js';
import {
  ErrorCollector,
  ErrorCode,
  unexpectedToken,
  expectedToken,
  SYNC_TOKENS,
  type Diagnostic,
} from './errors.js';
import { Lexer } from './lexer.js';
import { checkParserLimits, DEFAULT_PARSER_LIMITS, type ParserLimits } from './parser-limits.js';

// Parse result interface
export interface ParseResult {
  success: boolean;
  domain?: AST.Domain;
  errors: Diagnostic[];
  tokens?: Token[];
  islVersion?: string; // ISL language version (e.g., "0.1", "0.2")
}

export class Parser {
  private tokens: Token[] = [];
  private current: number = 0;
  private filename: string;
  private errors: ErrorCollector;
  private _panicMode: boolean = false;
  private limits: ParserLimits;
  private parseDepth: number = 0;

  /** Check if parser is in panic mode (for error recovery) */
  get inPanicMode(): boolean {
    return this._panicMode;
  }

  constructor(filename: string = '<input>', limits?: ParserLimits) {
    this.filename = filename;
    this.errors = new ErrorCollector();
    this.limits = limits ?? DEFAULT_PARSER_LIMITS;
  }

  private incrementDepth(): void {
    this.parseDepth++;
  }

  private decrementDepth(): void {
    this.parseDepth--;
  }

  private checkDepth(): void {
    if (this.limits.enabled && this.parseDepth >= this.limits.maxDepth) {
      throw new Error('Max parse depth exceeded');
    }
    this.incrementDepth();
  }

  parse(source: string): ParseResult {
    // Check limits upfront
    try {
      checkParserLimits(source, this.limits);
    } catch (err) {
      if (err instanceof Error) {
        this.errors.addError(
          err.message,
          ErrorCode.UNEXPECTED_TOKEN,
          { file: this.filename, line: 1, column: 1, endLine: 1, endColumn: 1 }
        );
        return {
          success: false,
          errors: this.errors.getAll(),
        };
      }
    }
    
    // Extract islVersion directive from source (before tokenization)
    const islVersion = this.extractISLVersion(source);
    
    // Reset parse depth
    this.parseDepth = 0;
    
    // Lexical analysis
    const lexer = new Lexer(source, this.filename, this.errors);
    const { tokens } = lexer.tokenize();
    
    // Check token count limit
    if (this.limits.enabled && tokens.length > this.limits.maxTokens) {
      this.errors.addError(
        `Token count ${tokens.length} exceeds maximum ${this.limits.maxTokens}`,
        ErrorCode.UNEXPECTED_TOKEN,
        { file: this.filename, line: 1, column: 1, endLine: 1, endColumn: 1 }
      );
      return {
        success: false,
        errors: this.errors.getAll(),
        tokens,
        islVersion,
      };
    }
    
    this.tokens = tokens.filter(t => t.type !== 'COMMENT'); // Remove comments for parsing
    this.current = 0;

    try {
      const domain = this.parseDomain();
      return {
        success: !this.errors.hasErrors(),
        domain,
        errors: this.errors.getAll(),
        tokens,
        islVersion,
      };
    } catch (e) {
      if (e instanceof Error) {
        this.errors.addError(
          e.message,
          ErrorCode.UNEXPECTED_TOKEN,
          this.currentLocation()
        );
      }
      return {
        success: false,
        errors: this.errors.getAll(),
        tokens,
        islVersion,
      };
    }
  }

  /**
   * Extract islVersion directive from source text.
   * Supports formats:
   *   #islVersion "0.1"
   *   islVersion "0.1"
   * Returns undefined if not found (defaults to current version).
   */
  private extractISLVersion(source: string): string | undefined {
    const lines = source.split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      // Check for #islVersion "version" format
      const hashMatch = trimmed.match(/^#\s*islVersion\s+["']([^"']+)["']/i);
      if (hashMatch) {
        return hashMatch[1];
      }
      // Check for islVersion "version" format (at start of file)
      const directMatch = trimmed.match(/^islVersion\s+["']([^"']+)["']/i);
      if (directMatch) {
        return directMatch[1];
      }
      // Stop searching if we hit the domain declaration
      if (trimmed.startsWith('domain ')) {
        break;
      }
    }
    return undefined;
  }

  // ============================================================================
  // DOMAIN PARSING
  // ============================================================================

  private parseDomain(): AST.Domain {
    const start = this.currentToken();
    this.checkDepth();
    try {
    this.expect('DOMAIN', "Expected 'domain'");
    const name = this.parseIdentifier();
    
    // Support both braced syntax: domain Name { ... }
    // and brace-less syntax: domain Name\nversion "1.0.0"\n...
    const useBraces = this.check('LBRACE');
    if (useBraces) {
      this.advance(); // consume '{'
    }

    const domain: AST.Domain = {
      kind: 'Domain',
      name,
      version: { kind: 'StringLiteral', value: '', location: name.location },
      uses: [],
      imports: [],
      types: [],
      entities: [],
      behaviors: [],
      invariants: [],
      policies: [],
      views: [],
      scenarios: [],
      chaos: [],
      location: start.location,
    };

    // Parse until RBRACE (braced) or EOF (brace-less)
    const shouldContinue = () => useBraces 
      ? !this.check('RBRACE') && !this.isAtEnd()
      : !this.isAtEnd();

    while (shouldContinue()) {
      try {
        this.parseDomainMember(domain);
      } catch (e) {
        // Report the error before synchronizing
        if (e instanceof Error) {
          this.errors.addError(
            e.message,
            ErrorCode.UNEXPECTED_TOKEN,
            this.currentLocation()
          );
        }
        this.synchronize();
      }
    }

    if (useBraces) {
      const endToken = this.expect('RBRACE', "Expected '}'");
      domain.location = AST.mergeLocations(start.location, endToken.location);
    } else {
      // For brace-less syntax, extend location to last parsed item
      const lastLocation = this.previousToken().location;
      domain.location = AST.mergeLocations(start.location, lastLocation);
    }

    // Validate required fields
    if (domain.version.value === '') {
      this.errors.addError(
        'Missing required field: version',
        ErrorCode.MISSING_VERSION,
        domain.location
      );
    }

    return domain;
  } finally {
      this.decrementDepth();
    }
  }

  private parseDomainMember(domain: AST.Domain): void {
    const token = this.currentToken();

    switch (token.kind) {
      case 'VERSION':
        domain.version = this.parseVersionField();
        break;
      case 'OWNER':
        domain.owner = this.parseOwnerField();
        break;
      case 'USE':
        domain.uses.push(this.parseUseStatement());
        break;
      case 'IMPORTS':
        domain.imports.push(...this.parseImports());
        break;
      case 'TYPE':
        domain.types.push(this.parseTypeDeclaration());
        break;
      case 'ENUM':
        domain.types.push(this.parseEnumDeclaration());
        break;
      case 'ENTITY':
        domain.entities.push(this.parseEntity());
        break;
      case 'BEHAVIOR':
        domain.behaviors.push(this.parseBehavior());
        break;
      case 'INVARIANTS':
        domain.invariants.push(this.parseInvariantBlock());
        break;
      case 'POLICY':
        domain.policies.push(this.parsePolicy());
        break;
      case 'VIEW':
        domain.views.push(this.parseView());
        break;
      case 'SCENARIOS':
        domain.scenarios.push(this.parseScenarioBlock());
        break;
      case 'CHAOS':
        domain.chaos.push(this.parseChaosBlock());
        break;
      default:
        throw unexpectedToken(token, 'domain member');
    }
  }

  private parseVersionField(): AST.StringLiteral {
    this.advance(); // consume 'version'
    // Support both `version: "1.0.0"` and `version "1.0.0"` (brace-less)
    this.match('COLON');
    return this.parseStringLiteral();
  }

  private parseOwnerField(): AST.StringLiteral {
    this.advance(); // consume 'owner'
    // Support both `owner: "Acme"` and `owner "Acme"` (brace-less)
    this.match('COLON');
    return this.parseStringLiteral();
  }

  // ============================================================================
  // USE STATEMENTS
  // ============================================================================

  private parseUseStatement(): AST.UseStatement {
    const start = this.advance(); // consume 'use'
    let module: AST.Identifier | AST.StringLiteral;
    if (this.check('STRING_LITERAL')) {
      module = this.parseStringLiteral();
    } else {
      const first = this.parseIdentifier();
      let name = first.name;
      let endLoc = first.location;
      while (this.match('MINUS') && this.check('IDENTIFIER')) {
        const next = this.parseIdentifier();
        name += '-' + next.name;
        endLoc = next.location;
      }
      module = { kind: 'Identifier', name, location: AST.mergeLocations(first.location, endLoc) };
    }
    let version: AST.StringLiteral | undefined;
    if (this.match('AT')) {
      version = this.parseStringLiteral();
    }
    let alias: AST.Identifier | undefined;
    if (this.match('AS')) {
      alias = this.parseIdentifier();
    }
    const end = alias ?? version ?? module;
    return {
      kind: 'UseStatement',
      module,
      version,
      alias,
      location: AST.mergeLocations(start.location, end.location),
    };
  }

  // ============================================================================
  // IMPORTS
  // ============================================================================

  private parseImports(): AST.Import[] {
    const imports: AST.Import[] = [];
    this.advance(); // consume 'imports'
    this.expect('LBRACE', "Expected '{'");

    while (!this.check('RBRACE') && !this.isAtEnd()) {
      imports.push(this.parseImport());
    }

    this.expect('RBRACE', "Expected '}'");
    return imports;
  }

  private parseImport(): AST.Import {
    const start = this.currentToken();
    const items: AST.ImportItem[] = [];

    const hasBraces = this.match('LBRACE');
    if (hasBraces) {
      while (!this.check('RBRACE') && !this.isAtEnd()) {
        items.push(this.parseImportItem());
        this.match('COMMA');
      }
      this.expect('RBRACE', "Expected '}'");
    } else {
      const item = this.parseImportItem();
      items.push(item);
      while (this.match('COMMA')) {
        if (this.check('FROM')) break;
        items.push(this.parseImportItem());
      }
    }

    this.expect('FROM', "Expected 'from'");
    const from = this.parseStringLiteral();

    return {
      kind: 'Import',
      items,
      from,
      location: AST.mergeLocations(start.location, from.location),
    };
  }

  private parseImportItem(): AST.ImportItem {
    const name = this.parseIdentifier();
    let alias: AST.Identifier | undefined;

    if (this.match('AS')) {
      alias = this.parseIdentifier();
    }

    return {
      kind: 'ImportItem',
      name,
      alias,
      location: alias ? AST.mergeLocations(name.location, alias.location) : name.location,
    };
  }

  // ============================================================================
  // TYPE DECLARATIONS
  // ============================================================================

  private parseTypeDeclaration(): AST.TypeDeclaration {
    const start = this.advance(); // consume 'type'
    const name = this.parseIdentifier();
    this.expect('ASSIGN', "Expected '='");

    const definition = this.parseTypeDefinition();
    const annotations = this.parseAnnotations();

    return {
      kind: 'TypeDeclaration',
      name,
      definition,
      annotations,
      location: AST.mergeLocations(start.location, definition.location),
    };
  }

  private parseEnumDeclaration(): AST.TypeDeclaration {
    const start = this.advance(); // consume 'enum'
    const name = this.parseIdentifier();
    this.expect('LBRACE', "Expected '{'");

    const variants: AST.EnumVariant[] = [];
    while (!this.check('RBRACE') && !this.isAtEnd()) {
      variants.push(this.parseEnumVariant());
    }

    const end = this.expect('RBRACE', "Expected '}'");

    const enumType: AST.EnumType = {
      kind: 'EnumType',
      variants,
      location: AST.mergeLocations(start.location, end.location),
    };

    return {
      kind: 'TypeDeclaration',
      name,
      definition: enumType,
      annotations: [],
      location: enumType.location,
    };
  }

  private parseEnumVariant(): AST.EnumVariant {
    const name = this.parseIdentifier();
    let value: AST.Literal | undefined;

    if (this.match('ASSIGN')) {
      value = this.parseLiteral() as AST.Literal;
    }

    return {
      kind: 'EnumVariant',
      name,
      value,
      location: value ? AST.mergeLocations(name.location, value.location) : name.location,
    };
  }

  private parseTypeDefinition(): AST.TypeDefinition {
    const token = this.currentToken();

    // Union type with leading pipe
    if (this.check('PIPE')) {
      return this.parseUnionType();
    }

    // Struct type
    if (this.check('LBRACE')) {
      return this.parseStructType();
    }

    // List type
    if (token.kind === 'LIST') {
      return this.parseListType();
    }

    // Map type
    if (token.kind === 'MAP') {
      return this.parseMapType();
    }

    // Primitive or reference type
    const baseType = this.parseBaseType();

    // Check for optional marker
    if (this.check('QUESTION')) {
      this.advance();
      return {
        kind: 'OptionalType',
        inner: baseType,
        location: baseType.location,
      };
    }

    // Check for constraints
    if (this.check('LBRACE')) {
      return this.parseConstrainedType(baseType);
    }

    return baseType;
  }

  private parseBaseType(): AST.TypeDefinition {
    const token = this.currentToken();

    // Check for primitive types
    if (isPrimitiveType(token.value)) {
      this.advance();
      return {
        kind: 'PrimitiveType',
        name: token.value as AST.PrimitiveType['name'],
        location: token.location,
      };
    }

    // Reference type (identifier or qualified name)
    const name = this.parseQualifiedName();
    return {
      kind: 'ReferenceType',
      name,
      location: name.location,
    };
  }

  private parseListType(): AST.ListType {
    const start = this.advance(); // consume 'List'
    this.expect('LT', "Expected '<'");
    const element = this.parseTypeDefinition();
    const end = this.expect('GT', "Expected '>'");

    return {
      kind: 'ListType',
      element,
      location: AST.mergeLocations(start.location, end.location),
    };
  }

  private parseMapType(): AST.MapType {
    const start = this.advance(); // consume 'Map'
    this.expect('LT', "Expected '<'");
    const key = this.parseTypeDefinition();
    this.expect('COMMA', "Expected ','");
    const value = this.parseTypeDefinition();
    const end = this.expect('GT', "Expected '>'");

    return {
      kind: 'MapType',
      key,
      value,
      location: AST.mergeLocations(start.location, end.location),
    };
  }

  private parseStructType(): AST.StructType {
    const start = this.expect('LBRACE', "Expected '{'");
    const fields: AST.Field[] = [];

    while (!this.check('RBRACE') && !this.isAtEnd()) {
      fields.push(this.parseField());
    }

    const end = this.expect('RBRACE', "Expected '}'");

    return {
      kind: 'StructType',
      fields,
      location: AST.mergeLocations(start.location, end.location),
    };
  }

  private parseUnionType(): AST.UnionType {
    const variants: AST.UnionVariant[] = [];
    const start = this.currentToken();

    while (this.match('PIPE')) {
      variants.push(this.parseUnionVariant());
    }

    return {
      kind: 'UnionType',
      variants,
      location: AST.mergeLocations(start.location, variants[variants.length - 1]?.location ?? start.location),
    };
  }

  private parseUnionVariant(): AST.UnionVariant {
    const name = this.parseIdentifier();
    const fields: AST.Field[] = [];

    if (this.check('LBRACE')) {
      this.advance();
      while (!this.check('RBRACE') && !this.isAtEnd()) {
        fields.push(this.parseField());
        this.match('COMMA'); // optional comma
      }
      this.expect('RBRACE', "Expected '}'");
    }

    return {
      kind: 'UnionVariant',
      name,
      fields,
      location: name.location,
    };
  }

  private parseConstrainedType(base: AST.TypeDefinition): AST.ConstrainedType {
    this.expect('LBRACE', "Expected '{'");
    const constraints: AST.Constraint[] = [];

    while (!this.check('RBRACE') && !this.isAtEnd()) {
      constraints.push(this.parseConstraint());
    }

    const end = this.expect('RBRACE', "Expected '}'");

    return {
      kind: 'ConstrainedType',
      base,
      constraints,
      location: AST.mergeLocations(base.location, end.location),
    };
  }

  private parseConstraint(): AST.Constraint {
    const name = this.parseIdentifier();
    this.expect('COLON', "Expected ':'");
    const value = this.parseExpression();

    return {
      kind: 'Constraint',
      name: name.name,
      value,
      location: AST.mergeLocations(name.location, value.location),
    };
  }

  // ============================================================================
  // ENTITIES
  // ============================================================================

  private parseEntity(): AST.Entity {
    const start = this.advance(); // consume 'entity'
    const name = this.parseIdentifier();
    this.expect('LBRACE', "Expected '{'");

    const fields: AST.Field[] = [];
    const invariants: AST.Expression[] = [];
    let lifecycle: AST.LifecycleSpec | undefined;

    while (!this.check('RBRACE') && !this.isAtEnd()) {
      if (this.check('INVARIANTS')) {
        invariants.push(...this.parseEntityInvariants());
      } else if (this.check('LIFECYCLE')) {
        lifecycle = this.parseLifecycle();
      } else {
        fields.push(this.parseField());
      }
    }

    const end = this.expect('RBRACE', "Expected '}'");

    return {
      kind: 'Entity',
      name,
      fields,
      invariants,
      lifecycle,
      location: AST.mergeLocations(start.location, end.location),
    };
  }

  private parseField(): AST.Field {
    const name = this.parseIdentifier();
    this.expect('COLON', "Expected ':'");
    
    let type = this.parseTypeDefinition();
    let optional = false;

    // Check for optional suffix on field name
    if (type.kind === 'OptionalType') {
      optional = true;
    }

    const annotations = this.parseAnnotations();
    let defaultValue: AST.Expression | undefined;

    if (this.match('ASSIGN')) {
      defaultValue = this.parseExpression();
    }

    return {
      kind: 'Field',
      name,
      type,
      optional,
      annotations,
      defaultValue,
      location: AST.mergeLocations(name.location, type.location),
    };
  }

  private parseAnnotations(): AST.Annotation[] {
    const annotations: AST.Annotation[] = [];

    if (!this.check('LBRACKET')) {
      return annotations;
    }

    this.advance(); // consume '['

    while (!this.check('RBRACKET') && !this.isAtEnd()) {
      const annotation = this.parseAnnotation();
      annotations.push(annotation);
      this.match('COMMA'); // optional comma
    }

    this.expect('RBRACKET', "Expected ']'");
    return annotations;
  }

  private parseAnnotation(): AST.Annotation {
    const name = this.parseIdentifier();
    let value: AST.Expression | undefined;

    if (this.match('COLON')) {
      value = this.parseExpression();
    }

    return {
      kind: 'Annotation',
      name,
      value,
      location: value ? AST.mergeLocations(name.location, value.location) : name.location,
    };
  }

  private parseEntityInvariants(): AST.Expression[] {
    this.advance(); // consume 'invariants'
    this.expect('LBRACE', "Expected '{'");

    const invariants: AST.Expression[] = [];
    while (!this.check('RBRACE') && !this.isAtEnd()) {
      this.skipOptionalBullet();
      invariants.push(this.parseExpression());
    }

    this.expect('RBRACE', "Expected '}'");
    return invariants;
  }

  private parseLifecycle(): AST.LifecycleSpec {
    const start = this.advance(); // consume 'lifecycle'
    this.expect('LBRACE', "Expected '{'");

    const transitions: AST.LifecycleTransition[] = [];
    while (!this.check('RBRACE') && !this.isAtEnd()) {
      transitions.push(this.parseLifecycleTransition());
    }

    const end = this.expect('RBRACE', "Expected '}'");

    return {
      kind: 'LifecycleSpec',
      transitions,
      location: AST.mergeLocations(start.location, end.location),
    };
  }

  private parseLifecycleTransition(): AST.LifecycleTransition {
    const from = this.parseIdentifier();
    this.expect('ARROW', "Expected '->'");
    const to = this.parseIdentifier();

    // Handle chained transitions: A -> B -> C
    const transitions: AST.LifecycleTransition[] = [{
      kind: 'LifecycleTransition',
      from,
      to,
      location: AST.mergeLocations(from.location, to.location),
    }];

    while (this.match('ARROW')) {
      const nextTo = this.parseIdentifier();
      const prevTo = transitions[transitions.length - 1]?.to;
      if (prevTo) {
        transitions.push({
          kind: 'LifecycleTransition',
          from: prevTo,
          to: nextTo,
          location: AST.mergeLocations(prevTo.location, nextTo.location),
        });
      }
    }

    // Return first transition; caller should handle multiple
    return transitions[0]!;
  }

  // ============================================================================
  // BEHAVIORS
  // ============================================================================

  private parseBehavior(): AST.Behavior {
    const start = this.advance(); // consume 'behavior'
    const name = this.parseIdentifier();
    this.expect('LBRACE', "Expected '{'");

    const behavior: AST.Behavior = {
      kind: 'Behavior',
      name,
      input: { kind: 'InputSpec', fields: [], location: name.location },
      output: {
        kind: 'OutputSpec',
        success: { kind: 'PrimitiveType', name: 'Boolean', location: name.location },
        errors: [],
        location: name.location,
      },
      preconditions: [],
      postconditions: [],
      invariants: [],
      temporal: [],
      security: [],
      compliance: [],
      location: start.location,
    };

    while (!this.check('RBRACE') && !this.isAtEnd()) {
      this.parseBehaviorMember(behavior);
    }

    const end = this.expect('RBRACE', "Expected '}'");
    behavior.location = AST.mergeLocations(start.location, end.location);

    return behavior;
  }

  private parseBehaviorMember(behavior: AST.Behavior): void {
    const token = this.currentToken();

    switch (token.kind) {
      case 'DESCRIPTION':
        behavior.description = this.parseDescriptionField();
        break;
      case 'ACTORS':
        behavior.actors = this.parseActors();
        break;
      case 'INPUT':
        behavior.input = this.parseInput();
        break;
      case 'OUTPUT':
        behavior.output = this.parseOutput();
        break;
      // Shorthand syntax: pre { }
      case 'PRE':
        behavior.preconditions = this.parsePreconditions();
        break;
      // Legacy verbose syntax: preconditions { }
      case 'PRECONDITIONS':
        behavior.preconditions = this.parsePreconditions();
        break;
      // Shorthand syntax: post success { }, post ErrorName { }
      case 'POST':
        behavior.postconditions.push(this.parsePostShorthand());
        break;
      // Legacy verbose syntax: postconditions { success implies { } }
      case 'POSTCONDITIONS':
        behavior.postconditions = this.parsePostconditions();
        break;
      case 'INVARIANTS':
        behavior.invariants = this.parseInvariants();
        break;
      case 'TEMPORAL':
        behavior.temporal = this.parseTemporalSpecs();
        break;
      case 'SECURITY':
        behavior.security = this.parseSecuritySpecs();
        break;
      case 'COMPLIANCE':
        behavior.compliance = this.parseComplianceSpecs();
        break;
      case 'OBSERVABILITY':
        behavior.observability = this.parseObservability();
        break;
      default:
        throw unexpectedToken(token, 'behavior member');
    }
  }

  private parseDescriptionField(): AST.StringLiteral {
    this.advance(); // consume 'description'
    this.expect('COLON', "Expected ':'");
    return this.parseStringLiteral();
  }

  private parseActors(): AST.ActorSpec[] {
    this.advance(); // consume 'actors'
    this.expect('LBRACE', "Expected '{'");

    const actors: AST.ActorSpec[] = [];
    while (!this.check('RBRACE') && !this.isAtEnd()) {
      actors.push(this.parseActorSpec());
    }

    this.expect('RBRACE', "Expected '}'");
    return actors;
  }

  private parseActorSpec(): AST.ActorSpec {
    const name = this.parseIdentifier();
    this.expect('LBRACE', "Expected '{'");

    const constraints: AST.Expression[] = [];
    while (!this.check('RBRACE') && !this.isAtEnd()) {
      if (this.check('MUST')) {
        this.advance();
        this.expect('COLON', "Expected ':'");
      }
      constraints.push(this.parseExpression());
    }

    const end = this.expect('RBRACE', "Expected '}'");

    return {
      kind: 'ActorSpec',
      name,
      constraints,
      location: AST.mergeLocations(name.location, end.location),
    };
  }

  private parseInput(): AST.InputSpec {
    const start = this.advance(); // consume 'input'
    this.expect('LBRACE', "Expected '{'");

    const fields: AST.Field[] = [];
    while (!this.check('RBRACE') && !this.isAtEnd()) {
      fields.push(this.parseField());
    }

    const end = this.expect('RBRACE', "Expected '}'");

    return {
      kind: 'InputSpec',
      fields,
      location: AST.mergeLocations(start.location, end.location),
    };
  }

  private parseOutput(): AST.OutputSpec {
    const start = this.advance(); // consume 'output'
    this.expect('LBRACE', "Expected '{'");

    let success: AST.TypeDefinition = {
      kind: 'PrimitiveType',
      name: 'Boolean',
      location: start.location,
    };
    const errors: AST.ErrorSpec[] = [];

    while (!this.check('RBRACE') && !this.isAtEnd()) {
      if (this.check('SUCCESS')) {
        this.advance();
        this.expect('COLON', "Expected ':'");
        success = this.parseTypeDefinition();
      } else if (this.check('ERRORS')) {
        this.advance();
        this.expect('LBRACE', "Expected '{'");
        while (!this.check('RBRACE') && !this.isAtEnd()) {
          errors.push(this.parseErrorSpec());
        }
        this.expect('RBRACE', "Expected '}'");
      } else {
        throw unexpectedToken(this.currentToken(), 'output member');
      }
    }

    const end = this.expect('RBRACE', "Expected '}'");

    return {
      kind: 'OutputSpec',
      success,
      errors,
      location: AST.mergeLocations(start.location, end.location),
    };
  }

  private parseErrorSpec(): AST.ErrorSpec {
    const name = this.parseIdentifier();
    this.expect('LBRACE', "Expected '{'");

    let when: AST.StringLiteral | undefined;
    let retriable = false;
    let retryAfter: AST.Expression | undefined;
    let returns: AST.TypeDefinition | undefined;

    while (!this.check('RBRACE') && !this.isAtEnd()) {
      const token = this.currentToken();
      if (token.kind === 'WHEN') {
        this.advance();
        this.expect('COLON', "Expected ':'");
        when = this.parseStringLiteral();
      } else if (token.kind === 'RETRIABLE') {
        this.advance();
        this.expect('COLON', "Expected ':'");
        retriable = this.parseBooleanLiteral().value;
      } else if (token.kind === 'RETRY_AFTER') {
        this.advance();
        this.expect('COLON', "Expected ':'");
        retryAfter = this.parseExpression();
      } else if (token.kind === 'RETURNS') {
        this.advance();
        this.expect('COLON', "Expected ':'");
        returns = this.parseTypeDefinition();
      } else {
        throw unexpectedToken(token, 'error spec member');
      }
    }

    const end = this.expect('RBRACE', "Expected '}'");

    return {
      kind: 'ErrorSpec',
      name,
      when,
      retriable,
      retryAfter,
      returns,
      location: AST.mergeLocations(name.location, end.location),
    };
  }

  private parsePreconditions(): AST.Expression[] {
    this.advance(); // consume 'preconditions'
    this.expect('LBRACE', "Expected '{'");

    const preconditions: AST.Expression[] = [];
    while (!this.check('RBRACE') && !this.isAtEnd()) {
      this.skipOptionalBullet();
      preconditions.push(this.parseExpression());
    }

    this.expect('RBRACE', "Expected '}'");
    return preconditions;
  }

  /**
   * Skip optional bullet point prefix (- ) before expressions in lists.
   * This supports the shorthand syntax: `- User.exists(id)` 
   * instead of just `User.exists(id)`.
   */
  private skipOptionalBullet(): void {
    // Skip `-` when followed by an identifier (not a number literal)
    // This allows `- expr` as a bullet point marker
    if (this.check('MINUS')) {
      const next = this.peekNextToken();
      if (next && (next.type === 'IDENTIFIER' || next.type === 'KEYWORD')) {
        this.advance(); // consume the bullet `-`
      }
    }
  }

  private parsePostconditions(): AST.PostconditionBlock[] {
    this.advance(); // consume 'postconditions'
    this.expect('LBRACE', "Expected '{'");

    const blocks: AST.PostconditionBlock[] = [];
    while (!this.check('RBRACE') && !this.isAtEnd()) {
      blocks.push(this.parsePostconditionBlock());
    }

    this.expect('RBRACE', "Expected '}'");
    return blocks;
  }

  private parsePostconditionBlock(): AST.PostconditionBlock {
    let condition: AST.Identifier | 'success' | 'any_error';
    const start = this.currentToken();

    if (this.check('SUCCESS') || this.currentToken().value === 'success') {
      condition = 'success';
      this.advance();
    } else if (this.check('ANY') || this.currentToken().value === 'any_error') {
      condition = 'any_error';
      this.advance();
    } else {
      condition = this.parseIdentifier();
    }

    this.expect('IMPLIES', "Expected 'implies'");
    this.expect('LBRACE', "Expected '{'");

    const predicates: AST.Expression[] = [];
    while (!this.check('RBRACE') && !this.isAtEnd()) {
      this.skipOptionalBullet();
      predicates.push(this.parseExpression());
    }

    const end = this.expect('RBRACE', "Expected '}'");

    return {
      kind: 'PostconditionBlock',
      condition,
      predicates,
      location: AST.mergeLocations(start.location, end.location),
    };
  }

  /**
   * Parse shorthand postcondition syntax: post success { } or post ErrorName { }
   * This is the canonical syntax (preferred over verbose postconditions { success implies { } })
   */
  private parsePostShorthand(): AST.PostconditionBlock {
    const start = this.advance(); // consume 'post'
    
    let condition: AST.Identifier | 'success' | 'any_error';

    if (this.check('SUCCESS') || this.currentToken().value === 'success') {
      condition = 'success';
      this.advance();
    } else if (this.check('ANY') || this.currentToken().value === 'any_error') {
      condition = 'any_error';
      this.advance();
    } else if (this.currentToken().value === 'failure') {
      // 'failure' is an alias for 'any_error'
      condition = 'any_error';
      this.advance();
    } else {
      condition = this.parseIdentifier();
    }

    this.expect('LBRACE', "Expected '{'");

    const predicates: AST.Expression[] = [];
    while (!this.check('RBRACE') && !this.isAtEnd()) {
      this.skipOptionalBullet();
      predicates.push(this.parseExpression());
    }

    const end = this.expect('RBRACE', "Expected '}'");

    return {
      kind: 'PostconditionBlock',
      condition,
      predicates,
      location: AST.mergeLocations(start.location, end.location),
    };
  }

  private parseInvariants(): AST.Expression[] {
    this.advance(); // consume 'invariants'
    this.expect('LBRACE', "Expected '{'");

    const invariants: AST.Expression[] = [];
    while (!this.check('RBRACE') && !this.isAtEnd()) {
      this.skipOptionalBullet();
      invariants.push(this.parseExpression());
    }

    this.expect('RBRACE', "Expected '}'");
    return invariants;
  }

  private parseTemporalSpecs(): AST.TemporalSpec[] {
    this.advance(); // consume 'temporal'
    this.expect('LBRACE', "Expected '{'");

    const specs: AST.TemporalSpec[] = [];
    while (!this.check('RBRACE') && !this.isAtEnd()) {
      specs.push(this.parseTemporalSpec());
    }

    this.expect('RBRACE', "Expected '}'");
    return specs;
  }

  private parseTemporalSpec(): AST.TemporalSpec {
    const start = this.currentToken();
    let operator: AST.TemporalSpec['operator'] = 'eventually';
    let duration: AST.DurationLiteral | undefined;
    let percentile: number | undefined;

    // Parse operator: response, eventually, always, within, never, immediately
    if (this.currentToken().value === 'response') {
      operator = 'response';
      this.advance();
    } else if (this.check('EVENTUALLY')) {
      operator = 'eventually';
      this.advance();
    } else if (this.check('ALWAYS')) {
      operator = 'always';
      this.advance();
    } else if (this.check('WITHIN')) {
      operator = 'within';
      this.advance();
    } else if (this.check('NEVER')) {
      operator = 'never';
      this.advance();
    } else if (this.check('IMMEDIATELY') || this.currentToken().value === 'immediately') {
      operator = 'immediately';
      this.advance();
    }

    // Parse "within duration" if present
    if (this.check('WITHIN') || this.currentToken().value === 'within') {
      this.advance();
      duration = this.parseDurationLiteral();
    }

    // Parse percentile if present: (p50), (p99)
    if (this.check('LPAREN')) {
      this.advance();
      const pValue = this.currentToken().value;
      if (pValue.startsWith('p')) {
        percentile = parseInt(pValue.slice(1), 10);
        this.advance();
      }
      this.expect('RPAREN', "Expected ')'");
    }

    // Parse colon and predicate
    if (this.check('COLON')) {
      this.advance();
    }

    const predicate = this.parseExpression();

    return {
      kind: 'TemporalSpec',
      operator,
      predicate,
      duration,
      percentile,
      location: AST.mergeLocations(start.location, predicate.location),
    };
  }

  private parseSecuritySpecs(): AST.SecuritySpec[] {
    this.advance(); // consume 'security'
    this.expect('LBRACE', "Expected '{'");

    const specs: AST.SecuritySpec[] = [];
    while (!this.check('RBRACE') && !this.isAtEnd()) {
      specs.push(this.parseSecuritySpec());
    }

    this.expect('RBRACE', "Expected '}'");
    return specs;
  }

  private parseSecuritySpec(): AST.SecuritySpec {
    const start = this.currentToken();
    let type: AST.SecuritySpec['type'] = 'requires';

    if (this.check('REQUIRES') || this.currentToken().value === 'requires') {
      type = 'requires';
      this.advance();
    } else if (this.check('RATE_LIMIT') || this.currentToken().value === 'rate_limit') {
      type = 'rate_limit';
      this.advance();
    } else if (this.currentToken().value === 'fraud_check') {
      type = 'fraud_check';
      this.advance();
    }

    const details = this.parseExpression();

    return {
      kind: 'SecuritySpec',
      type,
      details,
      location: AST.mergeLocations(start.location, details.location),
    };
  }

  private parseComplianceSpecs(): AST.ComplianceSpec[] {
    this.advance(); // consume 'compliance'
    this.expect('LBRACE', "Expected '{'");

    const specs: AST.ComplianceSpec[] = [];
    while (!this.check('RBRACE') && !this.isAtEnd()) {
      specs.push(this.parseComplianceSpec());
    }

    this.expect('RBRACE', "Expected '}'");
    return specs;
  }

  private parseComplianceSpec(): AST.ComplianceSpec {
    const standard = this.parseIdentifier();
    this.expect('LBRACE', "Expected '{'");

    const requirements: AST.Expression[] = [];
    while (!this.check('RBRACE') && !this.isAtEnd()) {
      requirements.push(this.parseExpression());
    }

    const end = this.expect('RBRACE', "Expected '}'");

    return {
      kind: 'ComplianceSpec',
      standard,
      requirements,
      location: AST.mergeLocations(standard.location, end.location),
    };
  }

  private parseObservability(): AST.ObservabilitySpec {
    const start = this.advance(); // consume 'observability'
    this.expect('LBRACE', "Expected '{'");

    const metrics: AST.MetricSpec[] = [];
    const traces: AST.TraceSpec[] = [];
    const logs: AST.LogSpec[] = [];

    while (!this.check('RBRACE') && !this.isAtEnd()) {
      const token = this.currentToken();
      if (token.kind === 'METRICS') {
        this.advance();
        this.expect('LBRACE', "Expected '{'");
        while (!this.check('RBRACE') && !this.isAtEnd()) {
          metrics.push(this.parseMetricSpec());
        }
        this.expect('RBRACE', "Expected '}'");
      } else if (token.kind === 'TRACES') {
        this.advance();
        this.expect('LBRACE', "Expected '{'");
        while (!this.check('RBRACE') && !this.isAtEnd()) {
          traces.push(this.parseTraceSpec());
        }
        this.expect('RBRACE', "Expected '}'");
      } else if (token.kind === 'LOGS') {
        this.advance();
        this.expect('LBRACE', "Expected '{'");
        while (!this.check('RBRACE') && !this.isAtEnd()) {
          logs.push(this.parseLogSpec());
        }
        this.expect('RBRACE', "Expected '}'");
      } else {
        throw unexpectedToken(token, 'observability member');
      }
    }

    const end = this.expect('RBRACE', "Expected '}'");

    return {
      kind: 'ObservabilitySpec',
      metrics,
      traces,
      logs,
      location: AST.mergeLocations(start.location, end.location),
    };
  }

  private parseMetricSpec(): AST.MetricSpec {
    const name = this.parseIdentifier();
    this.expect('LPAREN', "Expected '('");
    const typeToken = this.currentToken();
    let metricType: AST.MetricSpec['type'] = 'counter';
    if (typeToken.value === 'counter' || typeToken.kind === 'COUNTER') {
      metricType = 'counter';
    } else if (typeToken.value === 'gauge' || typeToken.kind === 'GAUGE') {
      metricType = 'gauge';
    } else if (typeToken.value === 'histogram' || typeToken.kind === 'HISTOGRAM') {
      metricType = 'histogram';
    }
    this.advance();
    this.expect('RPAREN', "Expected ')'");

    const labels: AST.Identifier[] = [];
    if (this.check('BY') || this.currentToken().value === 'by') {
      this.advance();
      this.expect('LBRACKET', "Expected '['");
      while (!this.check('RBRACKET') && !this.isAtEnd()) {
        labels.push(this.parseIdentifier());
        this.match('COMMA');
      }
      this.expect('RBRACKET', "Expected ']'");
    }

    return {
      kind: 'MetricSpec',
      name,
      type: metricType,
      labels,
      location: name.location,
    };
  }

  private parseTraceSpec(): AST.TraceSpec {
    if (this.check('SPAN') || this.currentToken().value === 'span') {
      this.advance();
    }
    const name = this.parseStringLiteral();

    return {
      kind: 'TraceSpec',
      name,
      location: name.location,
    };
  }

  private parseLogSpec(): AST.LogSpec {
    let condition: AST.LogSpec['condition'] = 'always';
    let level: AST.LogSpec['level'] = 'info';
    const include: AST.Identifier[] = [];
    const exclude: AST.Identifier[] = [];

    // Parse "on success/error" or "always"
    if (this.check('ON') || this.currentToken().value === 'on') {
      this.advance();
      const condToken = this.currentToken().value;
      if (condToken === 'success') {
        condition = 'success';
      } else if (condToken === 'error') {
        condition = 'error';
      }
      this.advance();
    }

    this.expect('COLON', "Expected ':'");

    // Parse level and include/exclude
    while (!this.check('ON') && !this.check('RBRACE') && !this.isAtEnd()) {
      const token = this.currentToken();
      if (token.kind === 'LEVEL' || token.value === 'level') {
        this.advance();
        const levelToken = this.currentToken().value;
        if (['debug', 'info', 'warn', 'error'].includes(levelToken)) {
          level = levelToken as AST.LogSpec['level'];
          this.advance();
        }
      } else if (token.kind === 'INCLUDE' || token.value === 'include') {
        this.advance();
        this.expect('LBRACKET', "Expected '['");
        while (!this.check('RBRACKET') && !this.isAtEnd()) {
          include.push(this.parseIdentifier());
          this.match('COMMA');
        }
        this.expect('RBRACKET', "Expected ']'");
      } else if (token.kind === 'EXCLUDE' || token.value === 'exclude') {
        this.advance();
        this.expect('LBRACKET', "Expected '['");
        while (!this.check('RBRACKET') && !this.isAtEnd()) {
          exclude.push(this.parseIdentifier());
          this.match('COMMA');
        }
        this.expect('RBRACKET', "Expected ']'");
      } else if (token.kind === 'COMMA') {
        this.advance();
      } else {
        break;
      }
    }

    return {
      kind: 'LogSpec',
      condition,
      level,
      include,
      exclude,
      location: this.currentLocation(),
    };
  }

  // ============================================================================
  // INVARIANTS, POLICIES, VIEWS
  // ============================================================================

  private parseInvariantBlock(): AST.InvariantBlock {
    const start = this.advance(); // consume 'invariants'
    const name = this.parseIdentifier();
    this.expect('LBRACE', "Expected '{'");

    let description: AST.StringLiteral | undefined;
    let scope: 'global' | 'transaction' = 'global';
    const predicates: AST.Expression[] = [];

    while (!this.check('RBRACE') && !this.isAtEnd()) {
      const token = this.currentToken();
      if (token.kind === 'DESCRIPTION') {
        description = this.parseDescriptionField();
      } else if (token.kind === 'SCOPE') {
        this.advance();
        this.expect('COLON', "Expected ':'");
        const scopeToken = this.currentToken().value;
        if (scopeToken === 'global' || scopeToken === 'transaction') {
          scope = scopeToken;
        }
        this.advance();
      } else if (token.kind === 'ALWAYS' || token.value === 'always') {
        this.advance();
        this.expect('LBRACE', "Expected '{'");
        while (!this.check('RBRACE') && !this.isAtEnd()) {
          this.skipOptionalBullet();
          predicates.push(this.parseExpression());
        }
        this.expect('RBRACE', "Expected '}'");
      } else {
        this.skipOptionalBullet();
        predicates.push(this.parseExpression());
      }
    }

    const end = this.expect('RBRACE', "Expected '}'");

    return {
      kind: 'InvariantBlock',
      name,
      description,
      scope,
      predicates,
      location: AST.mergeLocations(start.location, end.location),
    };
  }

  private parsePolicy(): AST.Policy {
    const start = this.advance(); // consume 'policy'
    const name = this.parseIdentifier();
    this.expect('LBRACE', "Expected '{'");

    let appliesTo: AST.PolicyTarget = {
      kind: 'PolicyTarget',
      target: 'all',
      location: name.location,
    };
    const rules: AST.PolicyRule[] = [];

    while (!this.check('RBRACE') && !this.isAtEnd()) {
      const token = this.currentToken();
      if (token.kind === 'APPLIES_TO' || token.value === 'applies_to') {
        this.advance();
        this.expect('COLON', "Expected ':'");
        if (this.currentToken().value === 'all') {
          this.advance();
          if (this.currentToken().value === 'behaviors') {
            this.advance();
          }
        } else {
          const targets: AST.Identifier[] = [];
          while (!this.check('RULES') && !this.check('RBRACE') && !this.isAtEnd()) {
            targets.push(this.parseIdentifier());
            this.match('COMMA');
          }
          appliesTo.target = targets;
        }
      } else if (token.kind === 'RULES' || token.value === 'rules') {
        this.advance();
        this.expect('LBRACE', "Expected '{'");
        while (!this.check('RBRACE') && !this.isAtEnd()) {
          rules.push(this.parsePolicyRule());
        }
        this.expect('RBRACE', "Expected '}'");
      } else {
        throw unexpectedToken(token, 'policy member');
      }
    }

    const end = this.expect('RBRACE', "Expected '}'");

    return {
      kind: 'Policy',
      name,
      appliesTo,
      rules,
      location: AST.mergeLocations(start.location, end.location),
    };
  }

  private parsePolicyRule(): AST.PolicyRule {
    const start = this.currentToken();
    let condition: AST.Expression | undefined;

    // Check for "default:" or condition
    if (this.check('DEFAULT') || this.currentToken().value === 'default') {
      this.advance();
    } else {
      condition = this.parseExpression();
    }

    this.expect('COLON', "Expected ':'");
    const action = this.parseExpression();

    return {
      kind: 'PolicyRule',
      condition,
      action,
      location: AST.mergeLocations(start.location, action.location),
    };
  }

  private parseView(): AST.View {
    const start = this.advance(); // consume 'view'
    const name = this.parseIdentifier();
    this.expect('LBRACE', "Expected '{'");

    let forEntity: AST.ReferenceType | undefined;
    const fields: AST.ViewField[] = [];
    let consistency: AST.ConsistencySpec = {
      kind: 'ConsistencySpec',
      mode: 'eventual',
      location: name.location,
    };
    let cache: AST.CacheSpec | undefined;

    while (!this.check('RBRACE') && !this.isAtEnd()) {
      const token = this.currentToken();
      if (token.kind === 'FOR' || token.value === 'for') {
        this.advance();
        this.expect('COLON', "Expected ':'");
        const entityName = this.parseQualifiedName();
        forEntity = {
          kind: 'ReferenceType',
          name: entityName,
          location: entityName.location,
        };
      } else if (token.kind === 'FIELDS' || token.value === 'fields') {
        this.advance();
        this.expect('LBRACE', "Expected '{'");
        while (!this.check('RBRACE') && !this.isAtEnd()) {
          fields.push(this.parseViewField());
        }
        this.expect('RBRACE', "Expected '}'");
      } else if (token.kind === 'CONSISTENCY' || token.value === 'consistency') {
        this.advance();
        this.expect('LBRACE', "Expected '{'");
        consistency = this.parseConsistencySpec();
        this.expect('RBRACE', "Expected '}'");
      } else if (token.kind === 'CACHE' || token.value === 'cache') {
        this.advance();
        this.expect('LBRACE', "Expected '{'");
        cache = this.parseCacheSpec();
        this.expect('RBRACE', "Expected '}'");
      } else {
        throw unexpectedToken(token, 'view member');
      }
    }

    const end = this.expect('RBRACE', "Expected '}'");

    return {
      kind: 'View',
      name,
      forEntity: forEntity ?? { kind: 'ReferenceType', name: { kind: 'QualifiedName', parts: [], location: name.location }, location: name.location },
      fields,
      consistency,
      cache,
      location: AST.mergeLocations(start.location, end.location),
    };
  }

  private parseViewField(): AST.ViewField {
    const name = this.parseIdentifier();
    this.expect('COLON', "Expected ':'");
    const type = this.parseTypeDefinition();
    this.expect('ASSIGN', "Expected '='");
    const computation = this.parseExpression();

    return {
      kind: 'ViewField',
      name,
      type,
      computation,
      location: AST.mergeLocations(name.location, computation.location),
    };
  }

  private parseConsistencySpec(): AST.ConsistencySpec {
    const start = this.currentToken();
    let mode: 'strong' | 'eventual' = 'eventual';
    let maxDelay: AST.DurationLiteral | undefined;
    const strongFields: AST.Identifier[] = [];

    while (!this.check('RBRACE') && !this.isAtEnd()) {
      const token = this.currentToken();
      if (token.kind === 'EVENTUAL' || token.value === 'eventual') {
        mode = 'eventual';
        this.advance();
        if (this.check('WITHIN') || this.currentToken().value === 'within') {
          this.advance();
          maxDelay = this.parseDurationLiteral();
        }
      } else if (token.kind === 'STRONG' || token.value === 'strong') {
        mode = 'strong';
        this.advance();
      } else if (token.kind === 'STRONGLY_CONSISTENT' || token.value === 'strongly_consistent') {
        this.advance();
        this.expect('COLON', "Expected ':'");
        this.expect('LBRACKET', "Expected '['");
        while (!this.check('RBRACKET') && !this.isAtEnd()) {
          strongFields.push(this.parseIdentifier());
          this.match('COMMA');
        }
        this.expect('RBRACKET', "Expected ']'");
      } else {
        break;
      }
    }

    return {
      kind: 'ConsistencySpec',
      mode,
      maxDelay,
      strongFields: strongFields.length > 0 ? strongFields : undefined,
      location: start.location,
    };
  }

  private parseCacheSpec(): AST.CacheSpec {
    const start = this.currentToken();
    let ttl: AST.DurationLiteral = {
      kind: 'DurationLiteral',
      value: 0,
      unit: 'seconds',
      location: start.location,
    };
    const invalidateOn: AST.Expression[] = [];

    while (!this.check('RBRACE') && !this.isAtEnd()) {
      const token = this.currentToken();
      if (token.kind === 'TTL' || token.value === 'ttl') {
        this.advance();
        this.expect('COLON', "Expected ':'");
        ttl = this.parseDurationLiteral();
      } else if (token.kind === 'INVALIDATE_ON' || token.value === 'invalidate_on') {
        this.advance();
        this.expect('COLON', "Expected ':'");
        this.expect('LBRACKET', "Expected '['");
        while (!this.check('RBRACKET') && !this.isAtEnd()) {
          invalidateOn.push(this.parseExpression());
          this.match('COMMA');
        }
        this.expect('RBRACKET', "Expected ']'");
      } else {
        break;
      }
    }

    return {
      kind: 'CacheSpec',
      ttl,
      invalidateOn,
      location: start.location,
    };
  }

  // ============================================================================
  // SCENARIOS & CHAOS
  // ============================================================================

  private parseScenarioBlock(): AST.ScenarioBlock {
    const start = this.advance(); // consume 'scenarios'
    const behaviorName = this.parseIdentifier();
    this.expect('LBRACE', "Expected '{'");

    const scenarios: AST.Scenario[] = [];
    while (!this.check('RBRACE') && !this.isAtEnd()) {
      scenarios.push(this.parseScenario());
    }

    const end = this.expect('RBRACE', "Expected '}'");

    return {
      kind: 'ScenarioBlock',
      behaviorName,
      scenarios,
      location: AST.mergeLocations(start.location, end.location),
    };
  }

  private parseScenario(): AST.Scenario {
    this.expect('SCENARIO', "Expected 'scenario'");
    const name = this.parseStringLiteral();
    this.expect('LBRACE', "Expected '{'");

    const given: AST.Statement[] = [];
    const when: AST.Statement[] = [];
    const then: AST.Expression[] = [];

    while (!this.check('RBRACE') && !this.isAtEnd()) {
      const token = this.currentToken();
      if (token.kind === 'GIVEN' || token.value === 'given') {
        this.advance();
        this.expect('LBRACE', "Expected '{'");
        while (!this.check('RBRACE') && !this.isAtEnd()) {
          given.push(this.parseStatement());
        }
        this.expect('RBRACE', "Expected '}'");
      } else if (token.kind === 'WHEN') {
        this.advance();
        this.expect('LBRACE', "Expected '{'");
        while (!this.check('RBRACE') && !this.isAtEnd()) {
          when.push(this.parseStatement());
        }
        this.expect('RBRACE', "Expected '}'");
      } else if (token.kind === 'THEN') {
        this.advance();
        this.expect('LBRACE', "Expected '{'");
        while (!this.check('RBRACE') && !this.isAtEnd()) {
          then.push(this.parseExpression());
        }
        this.expect('RBRACE', "Expected '}'");
      } else {
        throw unexpectedToken(token, 'scenario block');
      }
    }

    const end = this.expect('RBRACE', "Expected '}'");

    return {
      kind: 'Scenario',
      name,
      given,
      when,
      then,
      location: AST.mergeLocations(name.location, end.location),
    };
  }

  private parseChaosBlock(): AST.ChaosBlock {
    const start = this.advance(); // consume 'chaos'
    const behaviorName = this.parseIdentifier();
    this.expect('LBRACE', "Expected '{'");

    const scenarios: AST.ChaosScenario[] = [];
    while (!this.check('RBRACE') && !this.isAtEnd()) {
      scenarios.push(this.parseChaosScenario());
    }

    const end = this.expect('RBRACE', "Expected '}'");

    return {
      kind: 'ChaosBlock',
      behaviorName,
      scenarios,
      location: AST.mergeLocations(start.location, end.location),
    };
  }

  private parseChaosScenario(): AST.ChaosScenario {
    // Accept both 'chaos' and 'scenario' keywords inside chaos blocks
    if (this.check('CHAOS')) {
      this.advance();
    } else if (this.check('SCENARIO')) {
      this.advance();
    } else {
      throw expectedToken("'chaos' or 'scenario'", this.currentToken());
    }

    const name = this.parseStringLiteral();
    this.expect('LBRACE', "Expected '{'");

    const inject: AST.Injection[] = [];
    const when: AST.Statement[] = [];
    const then: AST.Expression[] = [];
    const expectBlock: AST.ChaosExpectation[] = [];
    let withClause: AST.ChaosWithClause | undefined;

    while (!this.check('RBRACE') && !this.isAtEnd()) {
      const token = this.currentToken();
      if (token.kind === 'INJECT' || token.value === 'inject') {
        this.advance(); // consume 'inject'
        if (this.check('LBRACE')) {
          // Old block syntax: inject { ... }
          this.advance(); // consume '{'
          while (!this.check('RBRACE') && !this.isAtEnd()) {
            inject.push(this.parseInjection());
          }
          this.expect('RBRACE', "Expected '}'");
        } else {
          // New inline syntax: inject <type> on <target> [with { ... }]
          inject.push(this.parseChaosInlineInjection());
        }
      } else if (token.kind === 'EXPECT' || token.value === 'expect') {
        this.advance(); // consume 'expect'
        this.expect('LBRACE', "Expected '{'");
        while (!this.check('RBRACE') && !this.isAtEnd()) {
          expectBlock.push(this.parseChaosExpectation());
        }
        this.expect('RBRACE', "Expected '}'");
      } else if (token.kind === 'WHEN') {
        this.advance();
        this.expect('LBRACE', "Expected '{'");
        while (!this.check('RBRACE') && !this.isAtEnd()) {
          when.push(this.parseStatement());
        }
        this.expect('RBRACE', "Expected '}'");
      } else if (token.kind === 'THEN') {
        this.advance();
        this.expect('LBRACE', "Expected '{'");
        while (!this.check('RBRACE') && !this.isAtEnd()) {
          then.push(this.parseExpression());
        }
        this.expect('RBRACE', "Expected '}'");
      } else if (token.kind === 'WITH' || token.value === 'with') {
        withClause = this.parseChaosWithClause();
      } else {
        throw unexpectedToken(token, 'chaos scenario block');
      }
    }

    const end = this.expect('RBRACE', "Expected '}'");

    // Populate granular ChaosInjection nodes for isl-core compatibility
    const injections: AST.ChaosInjection[] = inject.map((inj): AST.ChaosInjection => ({
      kind: 'ChaosInjection',
      type: {
        kind: 'Identifier',
        name: typeof inj.type === 'string' ? inj.type : 'database_failure',
        location: inj.location,
      },
      arguments: inj.parameters.map((p): AST.ChaosArgument => ({
        kind: 'ChaosArgument',
        name: p.name,
        value: p.value,
        location: p.location,
      })),
      location: inj.location,
    }));

    // Bridge: derive expectations from then expressions for backward compat
    const thenExpectations: AST.ChaosExpectation[] = then.map((expr): AST.ChaosExpectation => ({
      kind: 'ChaosExpectation',
      condition: expr,
      expression: expr,
      location: expr.location,
    }));

    // Merge direct expect-block expectations with then-derived expectations
    const expectations: AST.ChaosExpectation[] = [...expectBlock, ...thenExpectations];

    return {
      kind: 'ChaosScenario',
      name,
      inject,
      when,
      then,
      injections,
      expectations,
      withClause,
      withClauses: withClause ? [withClause] : [],
      location: AST.mergeLocations(name.location, end.location),
    };
  }

  /**
   * Parse inline chaos injection: inject <type> on <target> [with { key: value, ... }]
   * Called after 'inject' has been consumed.
   */
  private parseChaosInlineInjection(): AST.Injection {
    const startLoc = this.previousToken().location; // location of consumed 'inject'

    const typeId = this.parseIdentifier();

    // Expect 'on' keyword
    if (this.check('ON') || this.currentToken().value === 'on') {
      this.advance();
    } else {
      throw expectedToken("'on'", this.currentToken());
    }

    const target = this.parseExpression();

    // Optional with { ... } clause for injection parameters
    const parameters: AST.InjectionParam[] = [];
    if (this.check('WITH') || this.currentToken().value === 'with') {
      this.advance(); // consume 'with'
      this.expect('LBRACE', "Expected '{'");
      while (!this.check('RBRACE') && !this.isAtEnd()) {
        const paramName = this.parseIdentifier();
        this.expect('COLON', "Expected ':'");
        const paramValue = this.parseExpression();
        parameters.push({
          kind: 'InjectionParam',
          name: paramName,
          value: paramValue,
          location: AST.mergeLocations(paramName.location, paramValue.location),
        });
        this.match('COMMA'); // optional trailing comma
      }
      this.expect('RBRACE', "Expected '}'");
    }

    return {
      kind: 'Injection',
      type: typeId.name as AST.InjectionType,
      target,
      parameters,
      location: AST.mergeLocations(startLoc, this.previousToken().location),
    };
  }

  /**
   * Parse a single expectation expression inside an expect { } block.
   */
  private parseChaosExpectation(): AST.ChaosExpectation {
    const condition = this.parseExpression();

    // Optional description string after the condition expression
    let description: AST.StringLiteral | undefined;
    if (this.check('STRING_LITERAL')) {
      description = this.parseStringLiteral();
    }

    return {
      kind: 'ChaosExpectation',
      condition,
      description,
      expression: condition,
      location: description
        ? AST.mergeLocations(condition.location, description.location)
        : condition.location,
    };
  }

  /**
   * Parse scenario-level with { key: value, ... } clause → ChaosWithClause.
   */
  private parseChaosWithClause(): AST.ChaosWithClause {
    const start = this.advance(); // consume 'with'
    this.expect('LBRACE', "Expected '{'");

    const args: AST.ChaosArgument[] = [];
    while (!this.check('RBRACE') && !this.isAtEnd()) {
      args.push(this.parseChaosArgument());
      this.match('COMMA'); // optional trailing comma
    }

    const end = this.expect('RBRACE', "Expected '}'");

    return {
      kind: 'ChaosWithClause',
      args,
      location: AST.mergeLocations(start.location, end.location),
    };
  }

  /**
   * Parse a single key: value argument inside a with { } clause → ChaosArgument.
   */
  private parseChaosArgument(): AST.ChaosArgument {
    const name = this.parseIdentifier();
    this.expect('COLON', "Expected ':'");
    const value = this.parseExpression();

    return {
      kind: 'ChaosArgument',
      name,
      value,
      location: AST.mergeLocations(name.location, value.location),
    };
  }

  private parseInjection(): AST.Injection {
    const start = this.currentToken();
    const typeExpr = this.parseExpression();

    // Extract injection type from call expression
    let injectionType: AST.InjectionType = 'database_failure';
    const parameters: AST.InjectionParam[] = [];

    if (typeExpr.kind === 'CallExpr') {
      const callee = typeExpr.callee;
      if (callee.kind === 'Identifier') {
        injectionType = callee.name as AST.InjectionType;
      }
      // Parse arguments as parameters
      for (const arg of typeExpr.arguments) {
        if (arg.kind === 'BinaryExpr' && arg.operator === '==') {
          // key: value style
        }
      }
    }

    return {
      kind: 'Injection',
      type: injectionType,
      target: typeExpr,
      parameters,
      location: AST.mergeLocations(start.location, typeExpr.location),
    };
  }

  private parseStatement(): AST.Statement {
    const start = this.currentToken();

    // Check for assignment: identifier = expression
    // Note: identifiers can be IDENTIFIER type or KEYWORD type (for reserved words used as names)
    const tokenType = this.currentToken().type;
    if ((tokenType === 'IDENTIFIER' || tokenType === 'KEYWORD') && 
        this.peekNextToken()?.kind === 'ASSIGN') {
      const target = this.parseIdentifier();
      this.expect('ASSIGN', "Expected '='");
      const value = this.parseExpression();

      return {
        kind: 'AssignmentStmt',
        target,
        value,
        location: AST.mergeLocations(start.location, value.location),
      };
    }

    // Otherwise it's a call statement
    const expr = this.parseExpression();
    if (expr.kind === 'CallExpr') {
      return {
        kind: 'CallStmt',
        call: expr,
        location: expr.location,
      };
    }

    // Wrap non-call expressions in call statement
    return {
      kind: 'CallStmt',
      call: {
        kind: 'CallExpr',
        callee: expr,
        arguments: [],
        location: expr.location,
      },
      location: expr.location,
    };
  }

  // ============================================================================
  // EXPRESSIONS
  // ============================================================================

  private parseExpression(): AST.Expression {
    this.checkDepth();
    try {
      return this.parseOr();
    } finally {
      this.decrementDepth();
    }
  }

  private parseOr(): AST.Expression {
    let left = this.parseAnd();

    while (this.check('OR') || this.currentToken().value === 'or') {
      this.advance();
      const right = this.parseAnd();
      left = {
        kind: 'BinaryExpr',
        operator: 'or',
        left,
        right,
        location: AST.mergeLocations(left.location, right.location),
      };
    }

    return left;
  }

  private parseAnd(): AST.Expression {
    let left = this.parseImplies();

    while (this.check('AND') || this.currentToken().value === 'and') {
      this.advance();
      const right = this.parseImplies();
      left = {
        kind: 'BinaryExpr',
        operator: 'and',
        left,
        right,
        location: AST.mergeLocations(left.location, right.location),
      };
    }

    return left;
  }

  private parseImplies(): AST.Expression {
    let left = this.parseEquality();

    while (this.check('IMPLIES') || this.currentToken().value === 'implies' || this.check('IFF') || this.currentToken().value === 'iff') {
      const op = this.currentToken().value === 'iff' ? 'iff' : 'implies';
      this.advance();
      const right = this.parseEquality();
      left = {
        kind: 'BinaryExpr',
        operator: op,
        left,
        right,
        location: AST.mergeLocations(left.location, right.location),
      };
    }

    return left;
  }

  private parseEquality(): AST.Expression {
    let left = this.parseComparison();

    while (this.check('EQUALS') || this.check('NOT_EQUALS') || this.currentToken().value === 'is') {
      const op = this.currentToken().kind === 'NOT_EQUALS' ? '!=' : '==';
      this.advance();
      const right = this.parseComparison();
      left = {
        kind: 'BinaryExpr',
        operator: op,
        left,
        right,
        location: AST.mergeLocations(left.location, right.location),
      };
    }

    return left;
  }

  private parseComparison(): AST.Expression {
    let left = this.parseAdditive();

    while (this.check('LT') || this.check('GT') || this.check('LTE') || this.check('GTE') || this.check('IN') || this.currentToken().value === 'in') {
      let op: AST.BinaryOperator;
      switch (this.currentToken().kind) {
        case 'LT': op = '<'; break;
        case 'GT': op = '>'; break;
        case 'LTE': op = '<='; break;
        case 'GTE': op = '>='; break;
        default: op = 'in'; break;
      }
      this.advance();
      const right = this.parseAdditive();
      left = {
        kind: 'BinaryExpr',
        operator: op,
        left,
        right,
        location: AST.mergeLocations(left.location, right.location),
      };
    }

    return left;
  }

  private parseAdditive(): AST.Expression {
    let left = this.parseMultiplicative();

    while (this.check('PLUS') || this.check('MINUS')) {
      const op = this.currentToken().kind === 'PLUS' ? '+' : '-';
      this.advance();
      const right = this.parseMultiplicative();
      left = {
        kind: 'BinaryExpr',
        operator: op,
        left,
        right,
        location: AST.mergeLocations(left.location, right.location),
      };
    }

    return left;
  }

  private parseMultiplicative(): AST.Expression {
    let left = this.parseUnary();

    while (this.check('STAR') || this.check('SLASH') || this.check('PERCENT')) {
      let op: AST.BinaryOperator;
      switch (this.currentToken().kind) {
        case 'STAR': op = '*'; break;
        case 'SLASH': op = '/'; break;
        default: op = '%'; break;
      }
      this.advance();
      const right = this.parseUnary();
      left = {
        kind: 'BinaryExpr',
        operator: op,
        left,
        right,
        location: AST.mergeLocations(left.location, right.location),
      };
    }

    return left;
  }

  private parseUnary(): AST.Expression {
    if (this.check('NOT') || this.currentToken().value === 'not') {
      const start = this.advance();
      const operand = this.parseUnary();
      return {
        kind: 'UnaryExpr',
        operator: 'not',
        operand,
        location: AST.mergeLocations(start.location, operand.location),
      };
    }

    if (this.check('MINUS')) {
      const start = this.advance();
      const operand = this.parseUnary();
      return {
        kind: 'UnaryExpr',
        operator: '-',
        operand,
        location: AST.mergeLocations(start.location, operand.location),
      };
    }

    return this.parsePostfix();
  }

  private parsePostfix(): AST.Expression {
    let expr = this.parsePrimary();

    while (true) {
      if (this.check('DOT')) {
        this.advance();
        const property = this.parseIdentifier();
        expr = {
          kind: 'MemberExpr',
          object: expr,
          property,
          location: AST.mergeLocations(expr.location, property.location),
        };
      } else if (this.check('LPAREN')) {
        this.advance();
        const args: AST.Expression[] = [];
        while (!this.check('RPAREN') && !this.isAtEnd()) {
          // Handle named arguments: name: value
          // Note: named argument names can be IDENTIFIER or KEYWORD type
          const argToken = this.currentToken();
          if ((argToken.type === 'IDENTIFIER' || argToken.type === 'KEYWORD') && 
              this.peekNextToken()?.kind === 'COLON') {
            this.advance(); // name
            this.advance(); // :
          }
          args.push(this.parseExpression());
          this.match('COMMA');
        }
        const end = this.expect('RPAREN', "Expected ')'");
        expr = {
          kind: 'CallExpr',
          callee: expr,
          arguments: args,
          location: AST.mergeLocations(expr.location, end.location),
        };
      } else if (this.check('LBRACKET')) {
        this.advance();
        const index = this.parseExpression();
        const end = this.expect('RBRACKET', "Expected ']'");
        expr = {
          kind: 'IndexExpr',
          object: expr,
          index,
          location: AST.mergeLocations(expr.location, end.location),
        };
      } else {
        break;
      }
    }

    return expr;
  }

  private parsePrimary(): AST.Expression {
    const token = this.currentToken();

    // Special expressions
    if (token.kind === 'OLD' || token.value === 'old') {
      return this.parseOldExpr();
    }
    if (token.kind === 'RESULT' || token.value === 'result') {
      return this.parseResultExpr();
    }
    if (token.kind === 'NOW' || token.value === 'now') {
      this.advance();
      return {
        kind: 'CallExpr',
        callee: { kind: 'Identifier', name: 'now', location: token.location },
        arguments: [],
        location: token.location,
      };
    }
    if (token.kind === 'THIS' || token.value === 'this') {
      this.advance();
      return { kind: 'Identifier', name: 'this', location: token.location };
    }

    // Quantifiers - only if followed by '(' (otherwise treat as identifier)
    if ((token.kind === 'ALL' || token.kind === 'ANY' || token.kind === 'NONE' || 
        token.kind === 'COUNT' || token.kind === 'SUM' || token.kind === 'FILTER') &&
        this.peekNextToken()?.kind === 'LPAREN') {
      return this.parseQuantifier();
    }

    // Literals
    if (token.type === 'STRING') {
      return this.parseStringLiteral();
    }
    if (token.type === 'NUMBER') {
      return this.parseNumberLiteral();
    }
    if (token.type === 'BOOLEAN') {
      return this.parseBooleanLiteral();
    }
    if (token.type === 'DURATION') {
      return this.parseDurationLiteral();
    }
    if (token.type === 'REGEX') {
      return this.parseRegexLiteral();
    }

    // List literal
    if (this.check('LBRACKET')) {
      return this.parseListLiteral();
    }

    // Parenthesized expression or lambda
    if (this.check('LPAREN')) {
      return this.parseParenOrLambda();
    }

    // Map literal or block
    if (this.check('LBRACE')) {
      return this.parseMapLiteral();
    }

    // Identifier
    if (token.type === 'IDENTIFIER' || token.type === 'KEYWORD') {
      return this.parseIdentifier();
    }

    throw unexpectedToken(token, 'expression');
  }

  private parseOldExpr(): AST.OldExpr {
    const start = this.advance(); // consume 'old'
    this.expect('LPAREN', "Expected '('");
    const expression = this.parseExpression();
    const end = this.expect('RPAREN', "Expected ')'");

    return {
      kind: 'OldExpr',
      expression,
      location: AST.mergeLocations(start.location, end.location),
    };
  }

  private parseResultExpr(): AST.ResultExpr {
    const start = this.advance(); // consume 'result'
    let property: AST.Identifier | undefined;

    if (this.check('DOT')) {
      this.advance();
      property = this.parseIdentifier();
    }

    return {
      kind: 'ResultExpr',
      property,
      location: property ? AST.mergeLocations(start.location, property.location) : start.location,
    };
  }

  private parseQuantifier(): AST.QuantifierExpr {
    const start = this.currentToken();
    const quantifier = start.value as AST.QuantifierExpr['quantifier'];
    this.advance();

    this.expect('LPAREN', "Expected '('");
    
    // Parse collection
    const collection = this.parseExpression();
    
    // Check for lambda style: all(items, item => predicate)
    let variable: AST.Identifier;
    let predicate: AST.Expression;

    if (this.match('COMMA')) {
      // Lambda style
      variable = this.parseIdentifier();
      this.expect('FAT_ARROW', "Expected '=>'");
      predicate = this.parseExpression();
    } else {
      // Simple style - variable is implicit
      variable = { kind: 'Identifier', name: '_', location: collection.location };
      predicate = collection;
    }

    const end = this.expect('RPAREN', "Expected ')'");

    return {
      kind: 'QuantifierExpr',
      quantifier,
      variable,
      collection,
      predicate,
      location: AST.mergeLocations(start.location, end.location),
    };
  }

  private parseListLiteral(): AST.ListExpr {
    const start = this.expect('LBRACKET', "Expected '['");
    const elements: AST.Expression[] = [];

    while (!this.check('RBRACKET') && !this.isAtEnd()) {
      elements.push(this.parseExpression());
      this.match('COMMA');
    }

    const end = this.expect('RBRACKET', "Expected ']'");

    return {
      kind: 'ListExpr',
      elements,
      location: AST.mergeLocations(start.location, end.location),
    };
  }

  private parseMapLiteral(): AST.MapExpr {
    const start = this.expect('LBRACE', "Expected '{'");
    const entries: AST.MapEntry[] = [];

    while (!this.check('RBRACE') && !this.isAtEnd()) {
      const key = this.parseExpression();
      this.expect('COLON', "Expected ':'");
      const value = this.parseExpression();
      entries.push({
        kind: 'MapEntry',
        key,
        value,
        location: AST.mergeLocations(key.location, value.location),
      });
      this.match('COMMA');
    }

    const end = this.expect('RBRACE', "Expected '}'");

    return {
      kind: 'MapExpr',
      entries,
      location: AST.mergeLocations(start.location, end.location),
    };
  }

  private parseParenOrLambda(): AST.Expression {
    const start = this.expect('LPAREN', "Expected '('");

    // Check for lambda: (x) => expr or (x, y) => expr
    if (this.check('RPAREN')) {
      this.advance();
      if (this.check('FAT_ARROW')) {
        this.advance();
        const body = this.parseExpression();
        return {
          kind: 'LambdaExpr',
          params: [],
          body,
          location: AST.mergeLocations(start.location, body.location),
        };
      }
      // Empty parentheses - not valid
      throw unexpectedToken(this.currentToken(), 'expression');
    }

    const first = this.parseExpression();

    if (this.check('RPAREN')) {
      this.advance();
      if (this.check('FAT_ARROW')) {
        // Single param lambda
        this.advance();
        const body = this.parseExpression();
        const params = first.kind === 'Identifier' ? [first] : [];
        return {
          kind: 'LambdaExpr',
          params,
          body,
          location: AST.mergeLocations(start.location, body.location),
        };
      }
      // Just a parenthesized expression
      return first;
    }

    // Multiple params or tuple
    if (this.check('COMMA')) {
      const params: AST.Identifier[] = first.kind === 'Identifier' ? [first] : [];
      while (this.match('COMMA')) {
        // Check if this was a trailing comma (next token is ')')
        if (this.check('RPAREN')) break;
        const param = this.parseIdentifier();
        params.push(param);
      }
      this.expect('RPAREN', "Expected ')'");
      if (this.check('FAT_ARROW')) {
        this.advance();
        const body = this.parseExpression();
        return {
          kind: 'LambdaExpr',
          params,
          body,
          location: AST.mergeLocations(start.location, body.location),
        };
      }
    }

    this.expect('RPAREN', "Expected ')'");
    return first;
  }

  // ============================================================================
  // LITERAL PARSING
  // ============================================================================

  private parseIdentifier(): AST.Identifier {
    const token = this.currentToken();
    if (token.type !== 'IDENTIFIER' && token.type !== 'KEYWORD') {
      throw expectedToken('identifier', token);
    }
    this.advance();
    return {
      kind: 'Identifier',
      name: token.value,
      location: token.location,
    };
  }

  private parseQualifiedName(): AST.QualifiedName {
    const parts: AST.Identifier[] = [this.parseIdentifier()];

    while (this.check('DOT')) {
      this.advance();
      parts.push(this.parseIdentifier());
    }

    const lastPart = parts[parts.length - 1];
    return {
      kind: 'QualifiedName',
      parts,
      location: lastPart 
        ? AST.mergeLocations(parts[0]!.location, lastPart.location)
        : parts[0]!.location,
    };
  }

  private parseStringLiteral(): AST.StringLiteral {
    const token = this.expect('STRING_LITERAL', 'string literal');
    return {
      kind: 'StringLiteral',
      value: token.value,
      location: token.location,
    };
  }

  private parseNumberLiteral(): AST.NumberLiteral {
    const token = this.currentToken();
    if (token.type !== 'NUMBER') {
      throw expectedToken('number', token);
    }
    this.advance();
    const value = parseFloat(token.value);
    return {
      kind: 'NumberLiteral',
      value,
      isFloat: token.value.includes('.'),
      location: token.location,
    };
  }

  private parseBooleanLiteral(): AST.BooleanLiteral {
    const token = this.currentToken();
    if (token.type !== 'BOOLEAN') {
      throw expectedToken('boolean', token);
    }
    this.advance();
    return {
      kind: 'BooleanLiteral',
      value: token.value === 'true',
      location: token.location,
    };
  }

  private parseDurationLiteral(): AST.DurationLiteral {
    const token = this.currentToken();
    
    // Handle "number.unit" style (e.g., 15.minutes)
    if (token.type === 'NUMBER') {
      const numToken = this.advance();
      if (this.check('DOT')) {
        this.advance();
        const unitToken = this.currentToken();
        const unit = unitToken.value as AST.DurationLiteral['unit'];
        this.advance();
        return {
          kind: 'DurationLiteral',
          value: parseFloat(numToken.value),
          unit,
          location: AST.mergeLocations(numToken.location, unitToken.location),
        };
      }
      // Fall back to number literal interpretation
      return {
        kind: 'DurationLiteral',
        value: parseFloat(numToken.value),
        unit: 'ms',
        location: numToken.location,
      };
    }

    // Handle "numberunit" style (e.g., 200ms, 1s, 15m, 1h, 1d)
    if (token.type === 'DURATION') {
      this.advance();
      // Parse the value and unit from the token - supports both long and short forms
      const match = token.value.match(/^(\d+(?:\.\d+)?)(ms|seconds|minutes|hours|days|s|m|h|d)$/);
      if (match) {
        // Map short units to canonical form
        const unitMap: Record<string, AST.DurationLiteral['unit']> = {
          'ms': 'ms',
          's': 'seconds',
          'seconds': 'seconds',
          'm': 'minutes',
          'minutes': 'minutes',
          'h': 'hours',
          'hours': 'hours',
          'd': 'days',
          'days': 'days',
        };
        const rawUnit = match[2] ?? 'ms';
        const unit = unitMap[rawUnit] ?? 'ms';
        return {
          kind: 'DurationLiteral',
          value: parseFloat(match[1] ?? '0'),
          unit,
          location: token.location,
        };
      }
    }

    throw expectedToken('duration', token);
  }

  private parseRegexLiteral(): AST.RegexLiteral {
    const token = this.currentToken();
    if (token.type !== 'REGEX') {
      throw expectedToken('regex', token);
    }
    this.advance();

    // Parse /pattern/flags
    const match = token.value.match(/^\/(.*)\/([a-z]*)$/);
    return {
      kind: 'RegexLiteral',
      pattern: match?.[1] ?? token.value,
      flags: match?.[2] ?? '',
      location: token.location,
    };
  }

  private parseLiteral(): AST.Expression {
    const token = this.currentToken();
    switch (token.type) {
      case 'STRING': return this.parseStringLiteral();
      case 'NUMBER': return this.parseNumberLiteral();
      case 'BOOLEAN': return this.parseBooleanLiteral();
      case 'DURATION': return this.parseDurationLiteral();
      case 'REGEX': return this.parseRegexLiteral();
      default: throw expectedToken('literal', token);
    }
  }

  // ============================================================================
  // UTILITIES
  // ============================================================================

  private currentToken(): Token {
    return this.tokens[this.current] ?? this.eofToken();
  }

  private previousToken(): Token {
    return this.tokens[this.current - 1] ?? this.eofToken();
  }

  private peekNextToken(): Token | undefined {
    return this.tokens[this.current + 1];
  }

  private eofToken(): Token {
    return {
      type: 'EOF',
      kind: 'EOF',
      value: '',
      location: {
        file: this.filename,
        line: 1,
        column: 1,
        endLine: 1,
        endColumn: 1,
      },
    };
  }

  private currentLocation(): AST.SourceLocation {
    return this.currentToken().location;
  }

  private isAtEnd(): boolean {
    return this.currentToken().kind === 'EOF';
  }

  private check(kind: TokenKind): boolean {
    if (this.isAtEnd()) return false;
    return this.currentToken().kind === kind;
  }

  private match(kind: TokenKind): boolean {
    if (this.check(kind)) {
      this.advance();
      return true;
    }
    return false;
  }

  private advance(): Token {
    if (!this.isAtEnd()) {
      this.current++;
    }
    return this.tokens[this.current - 1] ?? this.eofToken();
  }

  private expect(kind: TokenKind, message: string): Token {
    if (this.check(kind)) {
      return this.advance();
    }
    throw expectedToken(message, this.currentToken());
  }

  private synchronize(): void {
    this._panicMode = true;
    this.advance();

    while (!this.isAtEnd()) {
      if (SYNC_TOKENS.has(this.currentToken().kind)) {
        this._panicMode = false;
        return;
      }
      this.advance();
    }
    this._panicMode = false;
  }
}

// ============================================================================
// PUBLIC API
// ============================================================================

export function parse(source: string, filename?: string): ParseResult {
  const parser = new Parser(filename);
  return parser.parse(source);
}
