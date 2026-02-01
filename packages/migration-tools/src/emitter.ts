/**
 * ISL Emitter
 * 
 * Generate ISL code from domain objects.
 */

export interface EmitterOptions {
  /** Pretty print with indentation */
  pretty?: boolean;
  /** Include comments from descriptions */
  includeComments?: boolean;
  /** Indentation string */
  indent?: string;
}

interface ISLDomain {
  name: string;
  description?: string;
  entities: ISLEntity[];
  behaviors: ISLBehavior[];
  types: ISLType[];
  enums: ISLEnum[];
}

interface ISLEntity {
  name: string;
  description?: string;
  fields: ISLField[];
  invariants?: string[];
}

interface ISLBehavior {
  name: string;
  description?: string;
  input?: ISLField[];
  output?: { success: string; failure?: string };
  preconditions?: string[];
  postconditions?: string[];
  temporal?: string[];
  security?: string[];
}

interface ISLType {
  name: string;
  baseType: string;
  constraints?: string[];
}

interface ISLEnum {
  name: string;
  description?: string;
  variants: string[];
}

interface ISLField {
  name: string;
  type: string;
  optional?: boolean;
  description?: string;
}

/**
 * ISL Code Emitter
 */
export class ISLEmitter {
  private options: Required<EmitterOptions>;
  private output: string[] = [];
  private currentIndent = 0;

  constructor(options: EmitterOptions = {}) {
    this.options = {
      pretty: options.pretty ?? true,
      includeComments: options.includeComments ?? true,
      indent: options.indent ?? '  ',
    };
  }

  /**
   * Emit ISL code from domain
   */
  emit(domain: ISLDomain): string {
    this.output = [];
    this.currentIndent = 0;

    // Domain header
    if (this.options.includeComments && domain.description) {
      this.emitComment(domain.description);
    }

    this.emitLine(`domain ${domain.name} {`);
    this.indent();

    // Enums
    if (domain.enums.length > 0) {
      this.emitLine('');
      this.emitComment('Enumerations');
      for (const enumDef of domain.enums) {
        this.emitEnum(enumDef);
      }
    }

    // Types
    if (domain.types.length > 0) {
      this.emitLine('');
      this.emitComment('Type definitions');
      for (const type of domain.types) {
        this.emitType(type);
      }
    }

    // Entities
    if (domain.entities.length > 0) {
      this.emitLine('');
      this.emitComment('Entities');
      for (const entity of domain.entities) {
        this.emitEntity(entity);
      }
    }

    // Behaviors
    if (domain.behaviors.length > 0) {
      this.emitLine('');
      this.emitComment('Behaviors');
      for (const behavior of domain.behaviors) {
        this.emitBehavior(behavior);
      }
    }

    this.dedent();
    this.emitLine('}');

    return this.output.join('\n');
  }

  /**
   * Emit enum definition
   */
  private emitEnum(enumDef: ISLEnum): void {
    if (this.options.includeComments && enumDef.description) {
      this.emitComment(enumDef.description);
    }

    this.emitLine(`enum ${enumDef.name} {`);
    this.indent();

    for (const variant of enumDef.variants) {
      this.emitLine(variant);
    }

    this.dedent();
    this.emitLine('}');
    this.emitLine('');
  }

  /**
   * Emit type definition
   */
  private emitType(type: ISLType): void {
    if (type.constraints && type.constraints.length > 0) {
      this.emitLine(`type ${type.name} = ${type.baseType} {`);
      this.indent();
      
      for (const constraint of type.constraints) {
        this.emitLine(constraint);
      }
      
      this.dedent();
      this.emitLine('}');
    } else {
      this.emitLine(`type ${type.name} = ${type.baseType}`);
    }
    this.emitLine('');
  }

  /**
   * Emit entity definition
   */
  private emitEntity(entity: ISLEntity): void {
    if (this.options.includeComments && entity.description) {
      this.emitComment(entity.description);
    }

    this.emitLine(`entity ${entity.name} {`);
    this.indent();

    // Fields
    for (const field of entity.fields) {
      this.emitField(field);
    }

    // Invariants
    if (entity.invariants && entity.invariants.length > 0) {
      this.emitLine('');
      this.emitLine('invariants {');
      this.indent();
      
      for (const invariant of entity.invariants) {
        this.emitLine(`- ${invariant}`);
      }
      
      this.dedent();
      this.emitLine('}');
    }

    this.dedent();
    this.emitLine('}');
    this.emitLine('');
  }

  /**
   * Emit behavior definition
   */
  private emitBehavior(behavior: ISLBehavior): void {
    if (this.options.includeComments && behavior.description) {
      this.emitComment(behavior.description);
    }

    this.emitLine(`behavior ${behavior.name} {`);
    this.indent();

    // Input
    if (behavior.input && behavior.input.length > 0) {
      this.emitLine('input {');
      this.indent();
      
      for (const field of behavior.input) {
        this.emitField(field);
      }
      
      this.dedent();
      this.emitLine('}');
    }

    // Output
    if (behavior.output) {
      this.emitLine('');
      this.emitLine('output {');
      this.indent();
      this.emitLine(`success: ${behavior.output.success}`);
      if (behavior.output.failure) {
        this.emitLine(`failure: ${behavior.output.failure}`);
      }
      this.dedent();
      this.emitLine('}');
    }

    // Preconditions
    if (behavior.preconditions && behavior.preconditions.length > 0) {
      this.emitLine('');
      this.emitLine('preconditions {');
      this.indent();
      
      for (const cond of behavior.preconditions) {
        this.emitLine(`- ${cond}`);
      }
      
      this.dedent();
      this.emitLine('}');
    }

    // Postconditions
    if (behavior.postconditions && behavior.postconditions.length > 0) {
      this.emitLine('');
      this.emitLine('postconditions {');
      this.indent();
      
      for (const cond of behavior.postconditions) {
        this.emitLine(`- ${cond}`);
      }
      
      this.dedent();
      this.emitLine('}');
    }

    // Temporal
    if (behavior.temporal && behavior.temporal.length > 0) {
      this.emitLine('');
      this.emitLine('temporal {');
      this.indent();
      
      for (const temp of behavior.temporal) {
        this.emitLine(`- ${temp}`);
      }
      
      this.dedent();
      this.emitLine('}');
    }

    // Security
    if (behavior.security && behavior.security.length > 0) {
      this.emitLine('');
      this.emitLine('security {');
      this.indent();
      
      for (const sec of behavior.security) {
        this.emitLine(`- ${sec}`);
      }
      
      this.dedent();
      this.emitLine('}');
    }

    this.dedent();
    this.emitLine('}');
    this.emitLine('');
  }

  /**
   * Emit field definition
   */
  private emitField(field: ISLField): void {
    const optional = field.optional ? '?' : '';
    const comment = this.options.includeComments && field.description
      ? ` // ${field.description}`
      : '';
    
    this.emitLine(`${field.name}${optional}: ${field.type}${comment}`);
  }

  /**
   * Emit a comment
   */
  private emitComment(text: string): void {
    if (!this.options.includeComments) return;

    const lines = text.split('\n');
    for (const line of lines) {
      this.emitLine(`// ${line}`);
    }
  }

  /**
   * Emit a line with current indentation
   */
  private emitLine(line: string): void {
    if (this.options.pretty) {
      const indent = this.options.indent.repeat(this.currentIndent);
      this.output.push(`${indent}${line}`);
    } else {
      this.output.push(line);
    }
  }

  /**
   * Increase indentation
   */
  private indent(): void {
    this.currentIndent++;
  }

  /**
   * Decrease indentation
   */
  private dedent(): void {
    this.currentIndent = Math.max(0, this.currentIndent - 1);
  }
}

/**
 * Quick emit helper
 */
export function emitISL(domain: ISLDomain, options?: EmitterOptions): string {
  const emitter = new ISLEmitter(options);
  return emitter.emit(domain);
}
