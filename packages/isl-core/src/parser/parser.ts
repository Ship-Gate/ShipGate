/**
 * ISL Parser
 * 
 * Recursive descent parser that produces a typed AST from ISL tokens.
 */

import {
  Token,
  TokenType,
  tokenTypeName,
  type SourceSpan,
} from '../lexer/tokens.js';
import * as AST from '../ast/types.js';
import * as B from '../ast/builders.js';

export interface ParseError {
  message: string;
  span: SourceSpan;
}

export class ParseException extends Error {
  constructor(public readonly parseError: ParseError) {
    super(parseError.message);
    this.name = 'ParseException';
  }
}

export class Parser {
  private tokens: Token[];
  private pos: number = 0;
  private errors: ParseError[] = [];

  constructor(tokens: Token[]) {
    // Filter out newlines for easier parsing (they're not significant in ISL)
    this.tokens = tokens.filter(t => t.type !== TokenType.NEWLINE);
  }

  /**
   * Parse the token stream into a domain declaration
   */
  parse(): { ast: AST.DomainDeclaration | null; errors: ParseError[] } {
    try {
      const ast = this.parseDomain();
      return { ast, errors: this.errors };
    } catch (e) {
      if (e instanceof ParseException) {
        return { ast: null, errors: this.errors };
      }
      throw e;
    }
  }

  // ============================================
  // Top-Level Parsing
  // ============================================

  private parseDomain(): AST.DomainDeclaration {
    const start = this.current().span.start;
    
    this.expect(TokenType.DOMAIN, "Expected 'domain' keyword");
    const name = this.parseIdentifier();
    this.expect(TokenType.LBRACE, "Expected '{' after domain name");
    
    const uses: AST.UseStatement[] = [];
    const imports: AST.ImportDeclaration[] = [];
    const entities: AST.EntityDeclaration[] = [];
    const types: AST.TypeDeclaration[] = [];
    const enums: AST.EnumDeclaration[] = [];
    const behaviors: AST.BehaviorDeclaration[] = [];
    const invariants: AST.InvariantsBlock[] = [];
    const uiBlueprints: AST.UIBlueprintDeclaration[] = [];
    let version: AST.StringLiteral | undefined;

    while (!this.check(TokenType.RBRACE) && !this.isAtEnd()) {
      if (this.check(TokenType.USE)) {
        uses.push(this.parseUseStatement());
      } else if (this.check(TokenType.ENTITY)) {
        entities.push(this.parseEntity());
      } else if (this.check(TokenType.BEHAVIOR)) {
        behaviors.push(this.parseBehavior());
      } else if (this.check(TokenType.TYPE)) {
        types.push(this.parseType());
      } else if (this.check(TokenType.ENUM)) {
        enums.push(this.parseEnum());
      } else if (this.check(TokenType.INVARIANTS)) {
        invariants.push(this.parseInvariantsBlock());
      } else if (this.check(TokenType.UI_BLUEPRINT)) {
        uiBlueprints.push(this.parseUIBlueprint());
      } else if (this.checkIdentifier('imports')) {
        this.advance();
        this.expect(TokenType.LBRACE, "Expected '{' after imports");
        while (!this.check(TokenType.RBRACE) && !this.isAtEnd()) {
          imports.push(this.parseImport());
        }
        this.expect(TokenType.RBRACE, "Expected '}' after imports block");
      } else if (this.checkIdentifier('version')) {
        this.advance();
        this.expect(TokenType.COLON, "Expected ':' after version");
        version = this.parseStringLiteral();
      } else {
        this.error(`Unexpected token ${tokenTypeName(this.current().type)}`);
        this.advance();
      }
    }

    this.expect(TokenType.RBRACE, "Expected '}' to close domain");
    
    const end = this.previous().span.end;
    return B.domainDeclaration(name, B.span(start, end), {
      version,
      uses,
      imports,
      entities,
      types,
      enums,
      behaviors,
      invariants,
      uiBlueprints,
    });
  }

  /**
   * Parse a use statement for importing modules.
   *
   * Syntax variations:
   * - `use stdlib-auth`
   * - `use stdlib-auth as auth`
   * - `use stdlib-auth@1.0.0`
   * - `use stdlib-auth@1.0.0 as auth`
   * - `use "./local/module"`
   */
  private parseUseStatement(): AST.UseStatement {
    const start = this.current().span.start;
    this.expect(TokenType.USE, "Expected 'use' keyword");

    // Parse module specifier - can be identifier or string literal for paths
    let module: AST.Identifier | AST.StringLiteral;
    let version: AST.StringLiteral | undefined;
    let alias: AST.Identifier | undefined;

    if (this.check(TokenType.STRING)) {
      // String literal for relative paths: use "./local/module"
      module = this.parseStringLiteral();
    } else {
      // Identifier for module names: use stdlib-auth
      // Module names can contain hyphens, so we need to parse them specially
      module = this.parseModuleName();
    }

    // Check for version: use module@version
    if (this.match(TokenType.AT)) {
      version = this.parseStringLiteral();
    }

    // Check for alias: use module as alias
    if (this.check(TokenType.AS)) {
      this.advance();
      alias = this.parseIdentifier();
    }

    const end = this.previous().span.end;
    return B.useStatement(module, B.span(start, end), { alias, version });
  }

  /**
   * Parse a module name that may contain hyphens.
   * Module names like "stdlib-auth" are parsed as a single identifier.
   */
  private parseModuleName(): AST.Identifier {
    const start = this.current().span.start;
    let name = '';

    // Parse the first part
    const firstToken = this.expect(TokenType.IDENTIFIER, "Expected module name");
    name = firstToken.value;

    // Continue parsing if followed by dash and identifier
    while (this.check(TokenType.DASH)) {
      this.advance(); // consume the dash
      name += '-';
      
      // The next part could be an identifier or a number (for versions in name)
      if (this.check(TokenType.IDENTIFIER)) {
        name += this.advance().value;
      } else if (this.check(TokenType.NUMBER)) {
        // Handle cases like stdlib-v2
        name += this.advance().value;
      } else {
        break;
      }
    }

    const end = this.previous().span.end;
    return B.identifier(name, B.span(start, end));
  }

  private parseImport(): AST.ImportDeclaration {
    const start = this.current().span.start;
    const names: AST.Identifier[] = [];

    // Parse name or { name, name }
    if (this.check(TokenType.LBRACE)) {
      this.advance();
      do {
        names.push(this.parseIdentifier());
      } while (this.match(TokenType.COMMA));
      this.expect(TokenType.RBRACE, "Expected '}' after import names");
    } else {
      names.push(this.parseIdentifier());
    }

    this.expectIdentifier('from', "Expected 'from' in import");
    const from = this.parseStringLiteral();

    const end = this.previous().span.end;
    return {
      kind: 'ImportDeclaration',
      names,
      from,
      span: B.span(start, end),
    };
  }

  // ============================================
  // Entity Parsing
  // ============================================

  private parseEntity(): AST.EntityDeclaration {
    const start = this.current().span.start;
    
    this.expect(TokenType.ENTITY, "Expected 'entity' keyword");
    const name = this.parseIdentifier();
    this.expect(TokenType.LBRACE, "Expected '{' after entity name");

    const fields: AST.FieldDeclaration[] = [];
    let invariants: AST.InvariantStatement[] | undefined;
    let lifecycle: AST.LifecycleBlock | undefined;

    while (!this.check(TokenType.RBRACE) && !this.isAtEnd()) {
      if (this.check(TokenType.INVARIANTS)) {
        this.advance();
        this.expect(TokenType.LBRACE, "Expected '{' after invariants");
        invariants = [];
        while (!this.check(TokenType.RBRACE) && !this.isAtEnd()) {
          invariants.push(this.parseInvariantStatement());
        }
        this.expect(TokenType.RBRACE, "Expected '}' after invariants");
      } else if (this.checkIdentifier('lifecycle')) {
        lifecycle = this.parseLifecycle();
      } else {
        fields.push(this.parseField());
      }
    }

    this.expect(TokenType.RBRACE, "Expected '}' to close entity");

    const end = this.previous().span.end;
    return B.entityDeclaration(name, fields, B.span(start, end), { invariants, lifecycle });
  }

  private parseField(): AST.FieldDeclaration {
    const start = this.current().span.start;
    const name = this.parseIdentifier();
    
    this.expect(TokenType.COLON, "Expected ':' after field name");
    const type = this.parseTypeExpression();
    
    let optional = false;
    if (this.match(TokenType.QUESTION)) {
      optional = true;
    }

    // Parse annotations [immutable, unique, ...]
    const annotations: AST.Annotation[] = [];
    const constraints: AST.TypeConstraint[] = [];
    
    if (this.match(TokenType.LBRACKET)) {
      do {
        const annotStart = this.current().span.start;
        const annotName = this.parseIdentifier();
        let value: AST.Expression | undefined;
        
        if (this.match(TokenType.COLON)) {
          value = this.parseExpression();
        }
        
        const annotEnd = this.previous().span.end;
        annotations.push(B.annotation(annotName, B.span(annotStart, annotEnd), value));
      } while (this.match(TokenType.COMMA));
      this.expect(TokenType.RBRACKET, "Expected ']' after annotations");
    }

    // Parse inline constraints { min: 0, max: 100 }
    if (this.match(TokenType.LBRACE)) {
      do {
        const constraintStart = this.current().span.start;
        const constraintName = this.parseIdentifier();
        this.expect(TokenType.COLON, "Expected ':' after constraint name");
        const constraintValue = this.parseExpression();
        const constraintEnd = this.previous().span.end;
        constraints.push(B.typeConstraint(constraintName, B.span(constraintStart, constraintEnd), constraintValue));
      } while (this.match(TokenType.COMMA));
      this.expect(TokenType.RBRACE, "Expected '}' after constraints");
    }

    // Parse default value or computed
    let defaultValue: AST.Expression | undefined;
    let computed: AST.Expression | undefined;

    if (this.match(TokenType.ASSIGN)) {
      defaultValue = this.parseExpression();
    }

    const end = this.previous().span.end;
    return B.fieldDeclaration(name, type, B.span(start, end), {
      optional,
      annotations,
      constraints,
      defaultValue,
      computed,
    });
  }

  private parseLifecycle(): AST.LifecycleBlock {
    const start = this.current().span.start;
    this.expectIdentifier('lifecycle', "Expected 'lifecycle'");
    this.expect(TokenType.LBRACE, "Expected '{' after lifecycle");

    const transitions: AST.LifecycleTransition[] = [];

    while (!this.check(TokenType.RBRACE) && !this.isAtEnd()) {
      const transStart = this.current().span.start;
      const states: AST.Identifier[] = [];
      
      states.push(this.parseIdentifier());
      while (this.match(TokenType.ARROW)) {
        states.push(this.parseIdentifier());
      }

      const transEnd = this.previous().span.end;
      transitions.push({
        kind: 'LifecycleTransition',
        states,
        span: B.span(transStart, transEnd),
      });
    }

    this.expect(TokenType.RBRACE, "Expected '}' after lifecycle");
    const end = this.previous().span.end;

    return {
      kind: 'LifecycleBlock',
      transitions,
      span: B.span(start, end),
    };
  }

  // ============================================
  // Behavior Parsing
  // ============================================

  private parseBehavior(): AST.BehaviorDeclaration {
    const start = this.current().span.start;
    
    this.expect(TokenType.BEHAVIOR, "Expected 'behavior' keyword");
    const name = this.parseIdentifier();
    this.expect(TokenType.LBRACE, "Expected '{' after behavior name");

    let description: AST.StringLiteral | undefined;
    let actors: AST.ActorsBlock | undefined;
    let input: AST.InputBlock | undefined;
    let output: AST.OutputBlock | undefined;
    let preconditions: AST.ConditionBlock | undefined;
    let postconditions: AST.ConditionBlock | undefined;
    let invariants: AST.InvariantStatement[] | undefined;
    let temporal: AST.TemporalBlock | undefined;
    let security: AST.SecurityBlock | undefined;
    let compliance: AST.ComplianceBlock | undefined;

    let chaos: AST.ChaosBlock | undefined;

    while (!this.check(TokenType.RBRACE) && !this.isAtEnd()) {
      if (this.checkIdentifier('description')) {
        this.advance();
        this.expect(TokenType.COLON, "Expected ':' after description");
        description = this.parseStringLiteral();
      } else if (this.check(TokenType.ACTORS)) {
        actors = this.parseActors();
      } else if (this.check(TokenType.INPUT)) {
        input = this.parseInput();
      } else if (this.check(TokenType.OUTPUT)) {
        output = this.parseOutput();
      } else if (this.check(TokenType.PRECONDITIONS)) {
        preconditions = this.parseConditionBlock('preconditions');
      } else if (this.check(TokenType.POSTCONDITIONS)) {
        postconditions = this.parseConditionBlock('postconditions');
      } else if (this.check(TokenType.INVARIANTS)) {
        this.advance();
        this.expect(TokenType.LBRACE, "Expected '{' after invariants");
        invariants = [];
        while (!this.check(TokenType.RBRACE) && !this.isAtEnd()) {
          invariants.push(this.parseInvariantStatement());
        }
        this.expect(TokenType.RBRACE, "Expected '}' after invariants");
      } else if (this.check(TokenType.TEMPORAL)) {
        temporal = this.parseTemporal();
      } else if (this.check(TokenType.SECURITY)) {
        security = this.parseSecurity();
      } else if (this.check(TokenType.COMPLIANCE)) {
        compliance = this.parseCompliance();
      } else if (this.check(TokenType.CHAOS)) {
        chaos = this.parseChaos();
      } else {
        this.error(`Unexpected token in behavior: ${tokenTypeName(this.current().type)}`);
        this.advance();
      }
    }

    this.expect(TokenType.RBRACE, "Expected '}' to close behavior");

    const end = this.previous().span.end;
    return B.behaviorDeclaration(name, B.span(start, end), {
      description,
      actors,
      input,
      output,
      preconditions,
      postconditions,
      invariants,
      temporal,
      security,
      compliance,
      chaos,
    });
  }

  private parseActors(): AST.ActorsBlock {
    const start = this.current().span.start;
    this.expect(TokenType.ACTORS, "Expected 'actors'");
    this.expect(TokenType.LBRACE, "Expected '{' after actors");

    const actors: AST.ActorDeclaration[] = [];

    while (!this.check(TokenType.RBRACE) && !this.isAtEnd()) {
      const actorStart = this.current().span.start;
      const actorName = this.parseIdentifier();
      this.expect(TokenType.LBRACE, "Expected '{' after actor name");

      const constraints: AST.ActorConstraint[] = [];
      while (!this.check(TokenType.RBRACE) && !this.isAtEnd()) {
        const constraintStart = this.current().span.start;
        const constraintType = this.parseIdentifier();
        this.expect(TokenType.COLON, "Expected ':' after constraint type");
        const constraintValue = this.parseExpression();
        const constraintEnd = this.previous().span.end;

        constraints.push({
          kind: 'ActorConstraint',
          type: constraintType.name as 'must' | 'owns' | 'with_permission' | 'for',
          value: constraintValue,
          span: B.span(constraintStart, constraintEnd),
        });
      }

      this.expect(TokenType.RBRACE, "Expected '}' after actor constraints");
      const actorEnd = this.previous().span.end;

      actors.push({
        kind: 'ActorDeclaration',
        name: actorName,
        constraints,
        span: B.span(actorStart, actorEnd),
      });
    }

    this.expect(TokenType.RBRACE, "Expected '}' after actors block");
    const end = this.previous().span.end;

    return {
      kind: 'ActorsBlock',
      actors,
      span: B.span(start, end),
    };
  }

  private parseInput(): AST.InputBlock {
    const start = this.current().span.start;
    this.expect(TokenType.INPUT, "Expected 'input'");
    this.expect(TokenType.LBRACE, "Expected '{' after input");

    const fields: AST.FieldDeclaration[] = [];
    while (!this.check(TokenType.RBRACE) && !this.isAtEnd()) {
      fields.push(this.parseField());
    }

    this.expect(TokenType.RBRACE, "Expected '}' after input");
    const end = this.previous().span.end;

    return B.inputBlock(fields, B.span(start, end));
  }

  private parseOutput(): AST.OutputBlock {
    const start = this.current().span.start;
    this.expect(TokenType.OUTPUT, "Expected 'output'");
    this.expect(TokenType.LBRACE, "Expected '{' after output");

    let success: AST.TypeExpression | undefined;
    const errors: AST.ErrorDeclaration[] = [];

    while (!this.check(TokenType.RBRACE) && !this.isAtEnd()) {
      if (this.check(TokenType.SUCCESS)) {
        this.advance();
        this.expect(TokenType.COLON, "Expected ':' after success");
        success = this.parseTypeExpression();
      } else if (this.checkIdentifier('failure') || this.check(TokenType.ERRORS)) {
        this.advance();
        this.expect(TokenType.LBRACE, "Expected '{' after errors");
        while (!this.check(TokenType.RBRACE) && !this.isAtEnd()) {
          errors.push(this.parseError());
        }
        this.expect(TokenType.RBRACE, "Expected '}' after errors");
      } else {
        this.error(`Unexpected token in output: ${tokenTypeName(this.current().type)}`);
        this.advance();
      }
    }

    this.expect(TokenType.RBRACE, "Expected '}' after output");
    const end = this.previous().span.end;

    if (!success) {
      success = B.simpleType(B.identifier('void', B.emptySpan()), B.emptySpan());
    }

    return B.outputBlock(success, errors, B.span(start, end));
  }

  private parseError(): AST.ErrorDeclaration {
    const start = this.current().span.start;
    const name = this.parseIdentifier();
    
    let when: AST.StringLiteral | undefined;
    let retriable: boolean | undefined;
    let retryAfter: AST.Expression | undefined;
    let returns: AST.Identifier | undefined;
    let includes: AST.Identifier | undefined;

    if (this.match(TokenType.LBRACE)) {
      while (!this.check(TokenType.RBRACE) && !this.isAtEnd()) {
        // Handle 'when' keyword specially since it's a reserved keyword
        if (this.check(TokenType.WHEN)) {
          this.advance();
          this.expect(TokenType.COLON, "Expected ':' after 'when'");
          when = this.parseStringLiteral();
        } else if (this.check(TokenType.IDENTIFIER)) {
          const propName = this.parseIdentifier();
          this.expect(TokenType.COLON, "Expected ':' after property name");

          switch (propName.name) {
            case 'retriable':
              retriable = this.match(TokenType.TRUE);
              if (!retriable) {
                this.expect(TokenType.FALSE, "Expected 'true' or 'false'");
              }
              break;
            case 'retry_after':
              retryAfter = this.parseExpression();
              break;
            case 'returns':
              returns = this.parseIdentifier();
              break;
            case 'includes':
              includes = this.parseIdentifier();
              break;
            default:
              this.error(`Unknown error property: ${propName.name}`);
              this.parseExpression(); // Skip value
          }
        } else {
          // Unknown token, skip it
          this.error(`Unexpected token in error properties: ${tokenTypeName(this.current().type)}`);
          this.advance();
        }
      }
      this.expect(TokenType.RBRACE, "Expected '}' after error properties");
    }

    const end = this.previous().span.end;
    return B.errorDeclaration(name, B.span(start, end), {
      when,
      retriable,
      retryAfter,
      returns,
      includes,
    });
  }

  private parseConditionBlock(type: 'preconditions' | 'postconditions'): AST.ConditionBlock {
    const start = this.current().span.start;
    this.advance(); // Skip 'preconditions' or 'postconditions'
    this.expect(TokenType.LBRACE, `Expected '{' after ${type}`);

    const conditions: AST.Condition[] = [];

    while (!this.check(TokenType.RBRACE) && !this.isAtEnd()) {
      conditions.push(this.parseCondition());
    }

    this.expect(TokenType.RBRACE, `Expected '}' after ${type}`);
    const end = this.previous().span.end;

    return B.conditionBlock(conditions, B.span(start, end));
  }

  private parseCondition(): AST.Condition {
    const start = this.current().span.start;
    
    let guard: 'success' | 'failure' | AST.Identifier | undefined;
    let implies = false;

    // Check for guard: success implies: or failure implies:
    if (this.check(TokenType.SUCCESS)) {
      this.advance();
      guard = 'success';
      if (this.check(TokenType.IMPLIES)) {
        this.advance();
        implies = true;
      }
    } else if (this.check(TokenType.FAILURE)) {
      this.advance();
      guard = 'failure';
      if (this.check(TokenType.IMPLIES)) {
        this.advance();
        implies = true;
      }
    } else if (this.check(TokenType.IDENTIFIER) && this.peekNext()?.type === TokenType.IMPLIES) {
      guard = this.parseIdentifier();
      this.advance(); // Skip 'implies'
      implies = true;
    }

    // Parse the condition body
    const statements: AST.ConditionStatement[] = [];

    // Handle block of statements
    if (this.check(TokenType.LBRACE)) {
      this.advance();
      while (!this.check(TokenType.RBRACE) && !this.isAtEnd()) {
        statements.push(this.parseConditionStatement());
      }
      this.expect(TokenType.RBRACE, "Expected '}' after condition block");
    } else if (this.check(TokenType.DASH)) {
      // Handle list items with dashes (parseConditionStatement handles the dash)
      while (this.check(TokenType.DASH) && !this.isAtEnd()) {
        statements.push(this.parseConditionStatement());
      }
    } else {
      // Single expression
      statements.push(this.parseConditionStatement());
    }

    const end = this.previous().span.end;
    return B.condition(statements, B.span(start, end), { guard, implies });
  }

  private parseConditionStatement(): AST.ConditionStatement {
    const start = this.current().span.start;
    
    // Skip leading dash if present
    this.match(TokenType.DASH);
    
    const expression = this.parseExpression();
    const end = this.previous().span.end;

    return B.conditionStatement(expression, B.span(start, end));
  }

  private parseInvariantStatement(): AST.InvariantStatement {
    const start = this.current().span.start;
    
    // Skip leading dash if present
    this.match(TokenType.DASH);
    
    const expression = this.parseExpression();
    const end = this.previous().span.end;

    return B.invariantStatement(expression, B.span(start, end));
  }

  private parseInvariantsBlock(): AST.InvariantsBlock {
    const start = this.current().span.start;
    this.expect(TokenType.INVARIANTS, "Expected 'invariants'");
    
    const name = this.parseIdentifier();
    this.expect(TokenType.LBRACE, "Expected '{' after invariants name");

    const invariants: AST.InvariantStatement[] = [];
    let description: AST.StringLiteral | undefined;
    let scope: 'global' | 'entity' | 'behavior' | undefined;

    while (!this.check(TokenType.RBRACE) && !this.isAtEnd()) {
      if (this.checkIdentifier('description')) {
        this.advance();
        this.expect(TokenType.COLON, "Expected ':'");
        description = this.parseStringLiteral();
      } else if (this.checkIdentifier('scope')) {
        this.advance();
        this.expect(TokenType.COLON, "Expected ':'");
        const scopeId = this.parseIdentifier();
        scope = scopeId.name as 'global' | 'entity' | 'behavior';
      } else if (this.check(TokenType.ALWAYS) || this.match(TokenType.DASH)) {
        if (this.check(TokenType.ALWAYS)) {
          this.advance();
          this.expect(TokenType.LBRACE, "Expected '{' after always");
          while (!this.check(TokenType.RBRACE) && !this.isAtEnd()) {
            invariants.push(this.parseInvariantStatement());
          }
          this.expect(TokenType.RBRACE, "Expected '}' after always block");
        } else {
          invariants.push(this.parseInvariantStatement());
        }
      } else {
        invariants.push(this.parseInvariantStatement());
      }
    }

    this.expect(TokenType.RBRACE, "Expected '}' after invariants block");
    const end = this.previous().span.end;

    return {
      kind: 'InvariantsBlock',
      name,
      description,
      scope,
      invariants,
      span: B.span(start, end),
    };
  }

  private parseTemporal(): AST.TemporalBlock {
    const start = this.current().span.start;
    this.expect(TokenType.TEMPORAL, "Expected 'temporal'");
    this.expect(TokenType.LBRACE, "Expected '{' after temporal");

    const requirements: AST.TemporalRequirement[] = [];

    while (!this.check(TokenType.RBRACE) && !this.isAtEnd()) {
      requirements.push(this.parseTemporalRequirement());
    }

    this.expect(TokenType.RBRACE, "Expected '}' after temporal");
    const end = this.previous().span.end;

    return B.temporalBlock(requirements, B.span(start, end));
  }

  private parseTemporalRequirement(): AST.TemporalRequirement {
    const start = this.current().span.start;
    
    // Skip leading dash
    this.match(TokenType.DASH);

    let type: 'eventually' | 'within' | 'immediately' | 'never' | 'always';
    let duration: AST.DurationLiteral | undefined;
    let percentile: string | undefined;

    if (this.match(TokenType.EVENTUALLY)) {
      type = 'eventually';
      if (this.checkIdentifier('within')) {
        this.advance();
        duration = this.parseDuration();
      }
    } else if (this.match(TokenType.WITHIN)) {
      type = 'within';
      duration = this.parseDuration();
    } else if (this.match(TokenType.IMMEDIATELY)) {
      type = 'immediately';
    } else if (this.match(TokenType.NEVER)) {
      type = 'never';
    } else if (this.match(TokenType.ALWAYS)) {
      type = 'always';
    } else {
      // Default to 'always' for bare expressions
      type = 'always';
    }

    // Check for percentile like (p99)
    if (this.match(TokenType.LPAREN)) {
      const pct = this.parseIdentifier();
      percentile = pct.name;
      this.expect(TokenType.RPAREN, "Expected ')' after percentile");
    }

    this.match(TokenType.COLON); // Optional colon before condition
    const condition = this.parseExpression();

    const end = this.previous().span.end;
    return B.temporalRequirement(type, condition, B.span(start, end), { duration, percentile });
  }

  private parseDuration(): AST.DurationLiteral {
    const start = this.current().span.start;
    const numToken = this.expect(TokenType.NUMBER, "Expected duration value");
    
    // Parse unit from the number value (e.g., "500ms", "5s", "1h")
    const match = numToken.value.match(/^(\d+(?:\.\d+)?)(ms|s|m|h|d)?$/);
    if (!match) {
      this.error(`Invalid duration: ${numToken.value}`);
      return B.durationLiteral(0, 'ms', B.span(start, this.previous().span.end));
    }

    const value = parseFloat(match[1]!);
    const unit = (match[2] || 's') as 'ms' | 's' | 'm' | 'h' | 'd';

    const end = this.previous().span.end;
    return B.durationLiteral(value, unit, B.span(start, end));
  }

  private parseSecurity(): AST.SecurityBlock {
    const start = this.current().span.start;
    this.expect(TokenType.SECURITY, "Expected 'security'");
    this.expect(TokenType.LBRACE, "Expected '{' after security");

    const requirements: AST.SecurityRequirement[] = [];

    while (!this.check(TokenType.RBRACE) && !this.isAtEnd()) {
      const reqStart = this.current().span.start;
      this.match(TokenType.DASH);
      
      const expr = this.parseExpression();
      const reqEnd = this.previous().span.end;

      requirements.push({
        kind: 'SecurityRequirement',
        type: 'requirement',
        expression: expr,
        span: B.span(reqStart, reqEnd),
      });
    }

    this.expect(TokenType.RBRACE, "Expected '}' after security");
    const end = this.previous().span.end;

    return {
      kind: 'SecurityBlock',
      requirements,
      span: B.span(start, end),
    };
  }

  private parseCompliance(): AST.ComplianceBlock {
    const start = this.current().span.start;
    this.expect(TokenType.COMPLIANCE, "Expected 'compliance'");
    this.expect(TokenType.LBRACE, "Expected '{' after compliance");

    const standards: AST.ComplianceStandard[] = [];

    while (!this.check(TokenType.RBRACE) && !this.isAtEnd()) {
      const stdStart = this.current().span.start;
      const name = this.parseIdentifier();
      this.expect(TokenType.LBRACE, "Expected '{' after compliance standard name");

      const requirements: AST.ComplianceRequirement[] = [];
      while (!this.check(TokenType.RBRACE) && !this.isAtEnd()) {
        const reqStart = this.current().span.start;
        this.match(TokenType.DASH);
        const expr = this.parseExpression();
        const reqEnd = this.previous().span.end;

        requirements.push({
          kind: 'ComplianceRequirement',
          expression: expr,
          span: B.span(reqStart, reqEnd),
        });
      }

      this.expect(TokenType.RBRACE, "Expected '}' after compliance standard");
      const stdEnd = this.previous().span.end;

      standards.push({
        kind: 'ComplianceStandard',
        name,
        requirements,
        span: B.span(stdStart, stdEnd),
      });
    }

    this.expect(TokenType.RBRACE, "Expected '}' after compliance");
    const end = this.previous().span.end;

    return {
      kind: 'ComplianceBlock',
      standards,
      span: B.span(start, end),
    };
  }

  // ============================================
  // Chaos Engineering Parsing
  // ============================================

  private parseChaos(): AST.ChaosBlock {
    const start = this.current().span.start;
    this.expect(TokenType.CHAOS, "Expected 'chaos'");
    this.expect(TokenType.LBRACE, "Expected '{' after chaos");

    const scenarios: AST.ChaosScenario[] = [];

    while (!this.check(TokenType.RBRACE) && !this.isAtEnd()) {
      if (this.check(TokenType.SCENARIO)) {
        scenarios.push(this.parseChaosScenario());
      } else {
        this.error(`Expected 'scenario' in chaos block, got ${tokenTypeName(this.current().type)}`);
        this.advance();
      }
    }

    this.expect(TokenType.RBRACE, "Expected '}' after chaos");
    const end = this.previous().span.end;

    return B.chaosBlock(scenarios, B.span(start, end));
  }

  private parseChaosScenario(): AST.ChaosScenario {
    const start = this.current().span.start;
    this.expect(TokenType.SCENARIO, "Expected 'scenario'");
    
    const name = this.parseStringLiteral();
    this.expect(TokenType.LBRACE, "Expected '{' after scenario name");

    const injections: AST.ChaosInjection[] = [];
    const expectations: AST.ChaosExpectation[] = [];
    let retries: AST.NumberLiteral | undefined;
    const withClauses: AST.ChaosWithClause[] = [];

    while (!this.check(TokenType.RBRACE) && !this.isAtEnd()) {
      if (this.check(TokenType.INJECT)) {
        injections.push(this.parseChaosInjection());
      } else if (this.check(TokenType.EXPECT)) {
        expectations.push(this.parseChaosExpectation());
      } else if (this.check(TokenType.RETRIES)) {
        this.advance();
        this.expect(TokenType.COLON, "Expected ':' after retries");
        const numToken = this.expect(TokenType.NUMBER, "Expected number for retries");
        retries = B.numberLiteral(parseInt(numToken.value, 10), numToken.span);
      } else if (this.check(TokenType.WITH)) {
        withClauses.push(this.parseChaosWithClause());
      } else {
        this.error(`Unexpected token in chaos scenario: ${tokenTypeName(this.current().type)}`);
        this.advance();
      }
    }

    this.expect(TokenType.RBRACE, "Expected '}' after scenario");
    const end = this.previous().span.end;

    return B.chaosScenario(name, injections, expectations, B.span(start, end), {
      retries,
      withClauses: withClauses.length > 0 ? withClauses : undefined,
    });
  }

  private parseChaosInjection(): AST.ChaosInjection {
    const start = this.current().span.start;
    this.expect(TokenType.INJECT, "Expected 'inject'");
    this.expect(TokenType.COLON, "Expected ':' after inject");

    const type = this.parseIdentifier();
    const args: AST.ChaosArgument[] = [];

    // Parse injection arguments: inject: rate_limit_storm(requests: 100, window: 1s)
    if (this.match(TokenType.LPAREN)) {
      if (!this.check(TokenType.RPAREN)) {
        do {
          const argStart = this.current().span.start;
          const argName = this.parseIdentifier();
          this.expect(TokenType.COLON, "Expected ':' after argument name");
          const argValue = this.parseExpression();
          const argEnd = this.previous().span.end;
          args.push(B.chaosArgument(argName, argValue, B.span(argStart, argEnd)));
        } while (this.match(TokenType.COMMA));
      }
      this.expect(TokenType.RPAREN, "Expected ')' after injection arguments");
    }

    const end = this.previous().span.end;
    return B.chaosInjection(type, args, B.span(start, end));
  }

  private parseChaosExpectation(): AST.ChaosExpectation {
    const start = this.current().span.start;
    this.expect(TokenType.EXPECT, "Expected 'expect'");
    this.expect(TokenType.COLON, "Expected ':' after expect");

    const expression = this.parseExpression();
    const end = this.previous().span.end;

    return B.chaosExpectation(expression, B.span(start, end));
  }

  private parseChaosWithClause(): AST.ChaosWithClause {
    const start = this.current().span.start;
    this.expect(TokenType.WITH, "Expected 'with'");
    this.expect(TokenType.COLON, "Expected ':' after with");

    const name = this.parseIdentifier();
    const args: AST.Expression[] = [];

    // Parse with clause arguments: with: idempotency_key("checkout-123")
    if (this.match(TokenType.LPAREN)) {
      if (!this.check(TokenType.RPAREN)) {
        do {
          args.push(this.parseExpression());
        } while (this.match(TokenType.COMMA));
      }
      this.expect(TokenType.RPAREN, "Expected ')' after with arguments");
    }

    const end = this.previous().span.end;
    return B.chaosWithClause(name, args, B.span(start, end));
  }

  // ============================================
  // Type Parsing
  // ============================================

  private parseType(): AST.TypeDeclaration {
    const start = this.current().span.start;
    this.expect(TokenType.TYPE, "Expected 'type'");
    
    const name = this.parseIdentifier();
    this.expect(TokenType.ASSIGN, "Expected '=' after type name");
    
    const baseType = this.parseTypeExpression();
    
    const constraints: AST.TypeConstraint[] = [];
    if (this.match(TokenType.LBRACE)) {
      do {
        const constraintStart = this.current().span.start;
        const constraintName = this.parseIdentifier();
        this.expect(TokenType.COLON, "Expected ':' after constraint name");
        const constraintValue = this.parseExpression();
        const constraintEnd = this.previous().span.end;
        constraints.push(B.typeConstraint(constraintName, B.span(constraintStart, constraintEnd), constraintValue));
      } while (this.match(TokenType.COMMA));
      this.expect(TokenType.RBRACE, "Expected '}' after type constraints");
    }

    const end = this.previous().span.end;
    return {
      kind: 'TypeDeclaration',
      name,
      baseType,
      constraints,
      span: B.span(start, end),
    };
  }

  private parseEnum(): AST.EnumDeclaration {
    const start = this.current().span.start;
    this.expect(TokenType.ENUM, "Expected 'enum'");
    
    const name = this.parseIdentifier();
    this.expect(TokenType.LBRACE, "Expected '{' after enum name");
    
    const variants: AST.Identifier[] = [];
    do {
      variants.push(this.parseIdentifier());
    } while (this.match(TokenType.COMMA) || (!this.check(TokenType.RBRACE) && this.check(TokenType.IDENTIFIER)));

    this.expect(TokenType.RBRACE, "Expected '}' after enum variants");

    const end = this.previous().span.end;
    return {
      kind: 'EnumDeclaration',
      name,
      variants,
      span: B.span(start, end),
    };
  }

  private parseTypeExpression(): AST.TypeExpression {
    const start = this.current().span.start;

    // Check for union type with |
    if (this.match(TokenType.PIPE)) {
      const variants: AST.TypeVariant[] = [];
      do {
        variants.push(this.parseTypeVariant());
      } while (this.match(TokenType.PIPE));

      const end = this.previous().span.end;
      return B.unionType(variants, B.span(start, end));
    }

    // Simple or generic type
    const name = this.parseIdentifier();

    // Check for generic arguments
    if (this.match(TokenType.LT)) {
      const typeArgs: AST.TypeExpression[] = [];
      do {
        typeArgs.push(this.parseTypeExpression());
      } while (this.match(TokenType.COMMA));
      this.expect(TokenType.GT, "Expected '>' after type arguments");

      const end = this.previous().span.end;
      return B.genericType(name, typeArgs, B.span(start, end));
    }

    const end = this.previous().span.end;
    return B.simpleType(name, B.span(start, end));
  }

  private parseTypeVariant(): AST.TypeVariant {
    const start = this.current().span.start;
    const name = this.parseIdentifier();
    
    let fields: AST.FieldDeclaration[] | undefined;
    if (this.match(TokenType.LBRACE)) {
      fields = [];
      while (!this.check(TokenType.RBRACE) && !this.isAtEnd()) {
        fields.push(this.parseField());
        this.match(TokenType.COMMA);
      }
      this.expect(TokenType.RBRACE, "Expected '}' after variant fields");
    }

    const end = this.previous().span.end;
    return {
      kind: 'TypeVariant',
      name,
      fields,
      span: B.span(start, end),
    };
  }

  // ============================================
  // Expression Parsing
  // ============================================

  private parseExpression(): AST.Expression {
    return this.parseLogicalOr();
  }

  private parseLogicalOr(): AST.Expression {
    let left = this.parseLogicalAnd();

    while (this.match(TokenType.OR)) {
      const right = this.parseLogicalAnd();
      const span = B.span(left.span.start, right.span.end);
      left = B.logicalExpression('or', left, right, span);
    }

    return left;
  }

  private parseLogicalAnd(): AST.Expression {
    let left = this.parseEquality();

    while (this.match(TokenType.AND)) {
      const right = this.parseEquality();
      const span = B.span(left.span.start, right.span.end);
      left = B.logicalExpression('and', left, right, span);
    }

    return left;
  }

  private parseEquality(): AST.Expression {
    let left = this.parseComparison();

    while (this.match(TokenType.EQUALS) || this.match(TokenType.NOT_EQUALS)) {
      const operator = this.previous().type === TokenType.EQUALS ? '==' : '!=';
      const right = this.parseComparison();
      const span = B.span(left.span.start, right.span.end);
      left = B.comparisonExpression(operator, left, right, span);
    }

    return left;
  }

  private parseComparison(): AST.Expression {
    let left = this.parseUnary();

    while (this.match(TokenType.LT) || this.match(TokenType.GT) ||
           this.match(TokenType.LTE) || this.match(TokenType.GTE)) {
      const prev = this.previous();
      let operator: '<' | '>' | '<=' | '>=';
      switch (prev.type) {
        case TokenType.LT: operator = '<'; break;
        case TokenType.GT: operator = '>'; break;
        case TokenType.LTE: operator = '<='; break;
        case TokenType.GTE: operator = '>='; break;
        default: operator = '<';
      }
      const right = this.parseUnary();
      const span = B.span(left.span.start, right.span.end);
      left = B.comparisonExpression(operator, left, right, span);
    }

    return left;
  }

  private parseUnary(): AST.Expression {
    if (this.match(TokenType.NOT)) {
      const start = this.previous().span.start;
      const operand = this.parseUnary();
      return B.unaryExpression('not', operand, B.span(start, operand.span.end));
    }

    return this.parseCall();
  }

  private parseCall(): AST.Expression {
    let expr = this.parsePrimary();

    while (true) {
      if (this.match(TokenType.LPAREN)) {
        // Function call
        const args: AST.Expression[] = [];
        if (!this.check(TokenType.RPAREN)) {
          do {
            args.push(this.parseExpression());
          } while (this.match(TokenType.COMMA));
        }
        this.expect(TokenType.RPAREN, "Expected ')' after arguments");
        const end = this.previous().span.end;
        expr = B.callExpression(expr, args, B.span(expr.span.start, end));
      } else if (this.match(TokenType.DOT)) {
        // Member access
        const property = this.parseIdentifier();
        const end = property.span.end;
        expr = B.memberExpression(expr, property, B.span(expr.span.start, end));
      } else {
        break;
      }
    }

    return expr;
  }

  private parsePrimary(): AST.Expression {
    const token = this.current();

    // Literals
    if (this.match(TokenType.TRUE)) {
      return B.booleanLiteral(true, token.span);
    }
    if (this.match(TokenType.FALSE)) {
      return B.booleanLiteral(false, token.span);
    }
    if (this.match(TokenType.NULL)) {
      return B.nullLiteral(token.span);
    }
    if (this.match(TokenType.STRING)) {
      return B.stringLiteral(token.value, token.span);
    }
    if (this.match(TokenType.NUMBER)) {
      // Check for unit suffix
      const match = token.value.match(/^(\d+(?:\.\d+)?)(ms|s|m|h|d)?$/);
      if (match && match[2]) {
        return B.durationLiteral(
          parseFloat(match[1]!),
          match[2] as 'ms' | 's' | 'm' | 'h' | 'd',
          token.span
        );
      }
      return B.numberLiteral(parseFloat(token.value), token.span);
    }

    // old(expr) for postconditions
    if (this.checkIdentifier('old') && this.peekNext()?.type === TokenType.LPAREN) {
      const start = this.current().span.start;
      this.advance(); // Skip 'old'
      this.advance(); // Skip '('
      const inner = this.parseExpression();
      this.expect(TokenType.RPAREN, "Expected ')' after old()");
      const end = this.previous().span.end;
      return B.oldExpression(inner, B.span(start, end));
    }

    // Identifier (or keywords used as identifiers in expressions)
    if (this.check(TokenType.IDENTIFIER)) {
      return this.parseIdentifier();
    }

    // Allow certain keywords to be used as identifiers in expressions
    // (e.g., "input.email", "success", "result", etc.)
    if (this.check(TokenType.INPUT) || this.check(TokenType.OUTPUT) || 
        this.check(TokenType.SUCCESS) || this.check(TokenType.FAILURE)) {
      const token = this.advance();
      return B.identifier(token.value, token.span);
    }

    // Parenthesized expression
    if (this.match(TokenType.LPAREN)) {
      const expr = this.parseExpression();
      this.expect(TokenType.RPAREN, "Expected ')' after expression");
      return expr;
    }

    this.error(`Unexpected token: ${tokenTypeName(token.type)}`);
    this.advance(); // Skip the problematic token to prevent infinite loops
    return B.identifier('error', token.span);
  }

  // ============================================
  // UI Blueprint Parsing
  // ============================================

  private parseUIBlueprint(): AST.UIBlueprintDeclaration {
    const start = this.current().span.start;
    
    this.expect(TokenType.UI_BLUEPRINT, "Expected 'ui_blueprint' keyword");
    const name = this.parseIdentifier();
    this.expect(TokenType.LBRACE, "Expected '{' after blueprint name");

    const sections: AST.UISection[] = [];
    let tokens: AST.UITokenBlock | undefined;
    let constraints: AST.UIConstraintBlock | undefined;

    while (!this.check(TokenType.RBRACE) && !this.isAtEnd()) {
      if (this.checkIdentifier('tokens')) {
        tokens = this.parseUITokenBlock();
      } else if (this.checkIdentifier('constraints')) {
        constraints = this.parseUIConstraintBlock();
      } else if (this.checkIdentifier('section')) {
        sections.push(this.parseUISection());
      } else {
        this.error(`Unexpected token in ui_blueprint: ${this.current().value}`);
        this.advance();
      }
    }

    this.expect(TokenType.RBRACE, "Expected '}' to close ui_blueprint");
    
    const end = this.previous().span.end;
    return B.uiBlueprintDeclaration(name, sections, B.span(start, end), { tokens, constraints });
  }

  private parseUITokenBlock(): AST.UITokenBlock {
    const start = this.current().span.start;
    this.advance(); // consume 'tokens'
    this.expect(TokenType.LBRACE, "Expected '{' after tokens");

    const uiTokens: AST.UIToken[] = [];

    while (!this.check(TokenType.RBRACE) && !this.isAtEnd()) {
      const tokenStart = this.current().span.start;
      const tokenName = this.parseIdentifier();
      this.expect(TokenType.COLON, "Expected ':' after token name");
      
      // Parse category (color, spacing, typography, etc.)
      const _categoryToken = this.current(); // Reserved for future error messages
      let category: 'color' | 'spacing' | 'typography' | 'border' | 'shadow' = 'color';
      if (this.checkIdentifier('color')) {
        category = 'color';
        this.advance();
      } else if (this.checkIdentifier('spacing')) {
        category = 'spacing';
        this.advance();
      } else if (this.checkIdentifier('typography')) {
        category = 'typography';
        this.advance();
      } else if (this.checkIdentifier('border')) {
        category = 'border';
        this.advance();
      } else if (this.checkIdentifier('shadow')) {
        category = 'shadow';
        this.advance();
      }

      // Parse value (string or expression)
      const value = this.parseExpression();
      const tokenEnd = this.previous().span.end;
      
      uiTokens.push(B.uiToken(tokenName, category, value, B.span(tokenStart, tokenEnd)));
    }

    this.expect(TokenType.RBRACE, "Expected '}' to close tokens block");
    const end = this.previous().span.end;
    return B.uiTokenBlock(uiTokens, B.span(start, end));
  }

  private parseUIConstraintBlock(): AST.UIConstraintBlock {
    const start = this.current().span.start;
    this.advance(); // consume 'constraints'
    this.expect(TokenType.LBRACE, "Expected '{' after constraints");

    const uiConstraints: AST.UIConstraint[] = [];

    while (!this.check(TokenType.RBRACE) && !this.isAtEnd()) {
      const constraintStart = this.current().span.start;
      
      // Parse constraint type (a11y, seo, perf, security)
      let constraintType: 'a11y' | 'seo' | 'perf' | 'security' = 'a11y';
      if (this.checkIdentifier('a11y')) {
        constraintType = 'a11y';
        this.advance();
      } else if (this.checkIdentifier('seo')) {
        constraintType = 'seo';
        this.advance();
      } else if (this.checkIdentifier('perf')) {
        constraintType = 'perf';
        this.advance();
      } else if (this.checkIdentifier('security')) {
        constraintType = 'security';
        this.advance();
      }

      this.expect(TokenType.COLON, "Expected ':' after constraint type");
      const rule = this.parseIdentifier();
      
      let value: AST.Expression | undefined;
      if (this.match(TokenType.ASSIGN)) {
        value = this.parseExpression();
      }

      const constraintEnd = this.previous().span.end;
      uiConstraints.push(B.uiConstraint(constraintType, rule, B.span(constraintStart, constraintEnd), value));
    }

    this.expect(TokenType.RBRACE, "Expected '}' to close constraints block");
    const end = this.previous().span.end;
    return B.uiConstraintBlock(uiConstraints, B.span(start, end));
  }

  private parseUISection(): AST.UISection {
    const start = this.current().span.start;
    this.advance(); // consume 'section'
    
    const name = this.parseIdentifier();
    this.expect(TokenType.COLON, "Expected ':' after section name");
    
    // Parse section type
    const typeToken = this.current();
    type SectionType = 'hero' | 'features' | 'testimonials' | 'cta' | 'footer' | 'header' | 'content';
    let sectionType: SectionType = 'content';
    const typeMap: Record<string, SectionType> = {
      hero: 'hero', features: 'features', testimonials: 'testimonials',
      cta: 'cta', footer: 'footer', header: 'header', content: 'content'
    };
    if (typeToken.type === TokenType.IDENTIFIER && typeMap[typeToken.value.toLowerCase()]) {
      sectionType = typeMap[typeToken.value.toLowerCase()]!;
      this.advance();
    }

    this.expect(TokenType.LBRACE, "Expected '{' after section type");

    const blocks: AST.UIContentBlock[] = [];
    let layout: AST.UILayout | undefined;

    while (!this.check(TokenType.RBRACE) && !this.isAtEnd()) {
      if (this.checkIdentifier('layout')) {
        layout = this.parseUILayout();
      } else {
        blocks.push(this.parseUIContentBlock());
      }
    }

    this.expect(TokenType.RBRACE, "Expected '}' to close section");
    const end = this.previous().span.end;
    return B.uiSection(name, sectionType, blocks, B.span(start, end), layout);
  }

  private parseUILayout(): AST.UILayout {
    const start = this.current().span.start;
    this.advance(); // consume 'layout'
    this.expect(TokenType.COLON, "Expected ':' after layout");

    // Parse layout type
    let layoutType: 'grid' | 'flex' | 'stack' = 'flex';
    if (this.checkIdentifier('grid')) {
      layoutType = 'grid';
      this.advance();
    } else if (this.checkIdentifier('flex')) {
      layoutType = 'flex';
      this.advance();
    } else if (this.checkIdentifier('stack')) {
      layoutType = 'stack';
      this.advance();
    }

    let columns: AST.NumberLiteral | undefined;
    let gap: AST.Expression | undefined;

    // Optional properties in braces
    if (this.match(TokenType.LBRACE)) {
      while (!this.check(TokenType.RBRACE) && !this.isAtEnd()) {
        if (this.checkIdentifier('columns')) {
          this.advance();
          this.expect(TokenType.COLON, "Expected ':' after columns");
          const numToken = this.expect(TokenType.NUMBER, "Expected number for columns");
          columns = B.numberLiteral(parseInt(numToken.value, 10), numToken.span);
        } else if (this.checkIdentifier('gap')) {
          this.advance();
          this.expect(TokenType.COLON, "Expected ':' after gap");
          gap = this.parseExpression();
        } else {
          this.advance();
        }
      }
      this.expect(TokenType.RBRACE, "Expected '}' to close layout options");
    }

    const end = this.previous().span.end;
    return B.uiLayout(layoutType, B.span(start, end), { columns, gap });
  }

  private parseUIContentBlock(): AST.UIContentBlock {
    const start = this.current().span.start;
    
    // Parse block type
    type BlockType = 'text' | 'heading' | 'image' | 'button' | 'form' | 'link' | 'container';
    const typeToken = this.current();
    let blockType: BlockType = 'text';
    const blockTypeMap: Record<string, BlockType> = {
      text: 'text', heading: 'heading', image: 'image', button: 'button',
      form: 'form', link: 'link', container: 'container'
    };
    
    if (typeToken.type === TokenType.IDENTIFIER && blockTypeMap[typeToken.value.toLowerCase()]) {
      blockType = blockTypeMap[typeToken.value.toLowerCase()]!;
      this.advance();
    } else {
      this.error(`Expected content block type, got ${typeToken.value}`);
      this.advance();
    }

    const props: AST.UIBlockProperty[] = [];
    const children: AST.UIContentBlock[] = [];

    if (this.match(TokenType.LBRACE)) {
      while (!this.check(TokenType.RBRACE) && !this.isAtEnd()) {
        // Check if this is a nested block or a property
        const current = this.current();
        if (current.type === TokenType.IDENTIFIER && blockTypeMap[current.value.toLowerCase()]) {
          children.push(this.parseUIContentBlock());
        } else {
          // Parse as property
          const propStart = this.current().span.start;
          const propName = this.parseIdentifier();
          this.expect(TokenType.COLON, "Expected ':' after property name");
          const propValue = this.parseExpression();
          const propEnd = this.previous().span.end;
          props.push(B.uiBlockProperty(propName, propValue, B.span(propStart, propEnd)));
        }
      }
      this.expect(TokenType.RBRACE, "Expected '}' to close content block");
    }

    const end = this.previous().span.end;
    return B.uiContentBlock(blockType, props, B.span(start, end), children.length > 0 ? children : undefined);
  }

  // ============================================
  // Helpers
  // ============================================

  private parseIdentifier(): AST.Identifier {
    const token = this.expect(TokenType.IDENTIFIER, "Expected identifier");
    return B.identifier(token.value, token.span);
  }

  private parseStringLiteral(): AST.StringLiteral {
    const token = this.expect(TokenType.STRING, "Expected string");
    return B.stringLiteral(token.value, token.span);
  }

  // Token navigation helpers

  private current(): Token {
    return this.tokens[this.pos] ?? this.tokens[this.tokens.length - 1]!;
  }

  private previous(): Token {
    return this.tokens[this.pos - 1] ?? this.tokens[0]!;
  }

  private peekNext(): Token | undefined {
    return this.tokens[this.pos + 1];
  }

  private isAtEnd(): boolean {
    return this.current().type === TokenType.EOF;
  }

  private check(type: TokenType): boolean {
    if (this.isAtEnd()) return false;
    return this.current().type === type;
  }

  private checkIdentifier(name: string): boolean {
    if (this.isAtEnd()) return false;
    const token = this.current();
    return token.type === TokenType.IDENTIFIER && token.value.toLowerCase() === name.toLowerCase();
  }

  private match(type: TokenType): boolean {
    if (this.check(type)) {
      this.advance();
      return true;
    }
    return false;
  }

  private advance(): Token {
    if (!this.isAtEnd()) this.pos++;
    return this.previous();
  }

  private expect(type: TokenType, message: string): Token {
    if (this.check(type)) {
      return this.advance();
    }
    this.error(`${message}, got ${tokenTypeName(this.current().type)}`);
    return this.current();
  }

  private expectIdentifier(name: string, message: string): Token {
    if (this.checkIdentifier(name)) {
      return this.advance();
    }
    this.error(message);
    return this.current();
  }

  private error(message: string): void {
    const token = this.current();
    this.errors.push({
      message,
      span: token.span,
    });
  }
}

/**
 * Convenience function to parse ISL source
 */
export function parse(tokens: Token[]): { ast: AST.DomainDeclaration | null; errors: ParseError[] } {
  const parser = new Parser(tokens);
  return parser.parse();
}
