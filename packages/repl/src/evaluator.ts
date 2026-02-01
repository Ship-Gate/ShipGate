// ============================================================================
// ISL Evaluator
// ============================================================================

import type { REPLContext, EvalResult, EntityDefinition, BehaviorDefinition, TypeDefinition, FieldDefinition } from './types';

export class ISLEvaluator {
  constructor(private context: REPLContext) {}

  evaluate(code: string): EvalResult {
    try {
      const trimmed = code.trim();

      // Domain declaration
      const domainMatch = trimmed.match(/^domain\s+(\w+)\s*\{/);
      if (domainMatch) {
        return this.evaluateDomain(trimmed, domainMatch[1]);
      }

      // Entity declaration
      const entityMatch = trimmed.match(/^entity\s+(\w+)\s*\{/);
      if (entityMatch) {
        return this.evaluateEntity(trimmed, entityMatch[1]);
      }

      // Behavior declaration
      const behaviorMatch = trimmed.match(/^behavior\s+(\w+)\s*\{/);
      if (behaviorMatch) {
        return this.evaluateBehavior(trimmed, behaviorMatch[1]);
      }

      // Type declaration
      const typeMatch = trimmed.match(/^type\s+(\w+)\s*=\s*(.+)$/);
      if (typeMatch) {
        return this.evaluateType(typeMatch[1], typeMatch[2]);
      }

      // Variable assignment
      const assignMatch = trimmed.match(/^let\s+(\w+)\s*=\s*(.+)$/);
      if (assignMatch) {
        return this.evaluateAssignment(assignMatch[1], assignMatch[2]);
      }

      // Expression evaluation
      return this.evaluateExpression(trimmed);
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  private evaluateDomain(code: string, name: string): EvalResult {
    // Extract version if present
    const versionMatch = code.match(/version:\s*"([^"]+)"/);
    const version = versionMatch ? versionMatch[1] : undefined;

    this.context.domain = { name, version };

    return {
      success: true,
      value: { name, version },
      type: 'Domain',
      output: `Domain '${name}'${version ? ` v${version}` : ''} defined`,
    };
  }

  private evaluateEntity(code: string, name: string): EvalResult {
    const fields: FieldDefinition[] = [];

    // Parse fields
    const fieldRegex = /(\w+)\s*:\s*(\w+(?:<[^>]+>)?)\s*(\?)?\s*([@\w]*)/g;
    let match;
    while ((match = fieldRegex.exec(code)) !== null) {
      if (match[1] !== 'entity' && match[1] !== 'invariant') {
        fields.push({
          name: match[1],
          type: match[2],
          optional: !!match[3],
        });
      }
    }

    const entity: EntityDefinition = {
      name,
      fields,
      instances: new Map(),
    };

    this.context.entities.set(name, entity);

    return {
      success: true,
      value: { name, fields: fields.length },
      type: 'Entity',
      output: `Entity '${name}' defined with ${fields.length} fields`,
    };
  }

  private evaluateBehavior(code: string, name: string): EvalResult {
    const inputs: FieldDefinition[] = [];
    let outputType = 'void';
    const preconditions: string[] = [];
    const postconditions: string[] = [];

    // Parse sections
    const inputSection = code.match(/input\s*\{([^}]*)\}/s);
    if (inputSection) {
      const fieldRegex = /(\w+)\s*:\s*(\w+(?:<[^>]+>)?)\s*(\?)?/g;
      let match;
      while ((match = fieldRegex.exec(inputSection[1])) !== null) {
        inputs.push({
          name: match[1],
          type: match[2],
          optional: !!match[3],
        });
      }
    }

    const outputSection = code.match(/output\s*\{([^}]*)\}/s);
    if (outputSection) {
      const successMatch = outputSection[1].match(/success:\s*(\w+)/);
      if (successMatch) {
        outputType = successMatch[1];
      }
    }

    const preSection = code.match(/pre\s*\{([^}]*)\}/s);
    if (preSection) {
      preconditions.push(...preSection[1].trim().split('\n').map(l => l.trim()).filter(Boolean));
    }

    const postSection = code.match(/post\s*\{([^}]*)\}/s);
    if (postSection) {
      postconditions.push(...postSection[1].trim().split('\n').map(l => l.trim()).filter(Boolean));
    }

    const behavior: BehaviorDefinition = {
      name,
      inputs,
      outputType,
      preconditions,
      postconditions,
    };

    this.context.behaviors.set(name, behavior);

    return {
      success: true,
      value: { name, inputs: inputs.length, outputType },
      type: 'Behavior',
      output: `Behavior '${name}' defined (${inputs.length} inputs → ${outputType})`,
    };
  }

  private evaluateType(name: string, definition: string): EvalResult {
    const baseType = definition.split('{')[0].trim();
    const constraints: string[] = [];

    const constraintMatch = definition.match(/\{([^}]*)\}/);
    if (constraintMatch) {
      constraints.push(...constraintMatch[1].trim().split('\n').map(l => l.trim()).filter(Boolean));
    }

    const typeDef: TypeDefinition = {
      name,
      baseType,
      constraints,
    };

    this.context.types.set(name, typeDef);

    return {
      success: true,
      value: { name, baseType, constraints: constraints.length },
      type: 'Type',
      output: `Type '${name}' = ${baseType}${constraints.length > 0 ? ` with ${constraints.length} constraint(s)` : ''}`,
    };
  }

  private evaluateAssignment(name: string, expression: string): EvalResult {
    const result = this.evaluateExpression(expression);
    if (result.success && result.value !== undefined) {
      this.context.variables.set(name, result.value);
      return {
        success: true,
        value: result.value,
        type: result.type,
        output: `${name} = ${JSON.stringify(result.value)}`,
      };
    }
    return result;
  }

  private evaluateExpression(expr: string): EvalResult {
    const trimmed = expr.trim();

    // Literal values
    if (trimmed === 'true') return { success: true, value: true, type: 'Boolean' };
    if (trimmed === 'false') return { success: true, value: false, type: 'Boolean' };
    if (trimmed === 'null') return { success: true, value: null, type: 'Null' };
    if (/^-?\d+$/.test(trimmed)) return { success: true, value: parseInt(trimmed), type: 'Int' };
    if (/^-?\d+\.\d+$/.test(trimmed)) return { success: true, value: parseFloat(trimmed), type: 'Decimal' };
    if (/^"[^"]*"$/.test(trimmed)) return { success: true, value: trimmed.slice(1, -1), type: 'String' };

    // Variable lookup
    if (this.context.variables.has(trimmed)) {
      const value = this.context.variables.get(trimmed);
      return { success: true, value, type: typeof value };
    }

    // Entity lookup
    if (this.context.entities.has(trimmed)) {
      const entity = this.context.entities.get(trimmed)!;
      return {
        success: true,
        value: {
          name: entity.name,
          fields: entity.fields,
          instanceCount: entity.instances.size,
        },
        type: 'EntityDefinition',
      };
    }

    // Behavior lookup
    if (this.context.behaviors.has(trimmed)) {
      const behavior = this.context.behaviors.get(trimmed)!;
      return {
        success: true,
        value: {
          name: behavior.name,
          inputs: behavior.inputs,
          outputType: behavior.outputType,
        },
        type: 'BehaviorDefinition',
      };
    }

    // Type lookup
    if (this.context.types.has(trimmed)) {
      const type = this.context.types.get(trimmed)!;
      return {
        success: true,
        value: type,
        type: 'TypeDefinition',
      };
    }

    // Entity.create() simulation
    const createMatch = trimmed.match(/^(\w+)\.create\((.*)\)$/s);
    if (createMatch) {
      const entityName = createMatch[1];
      const entity = this.context.entities.get(entityName);
      if (!entity) {
        return { success: false, error: `Unknown entity: ${entityName}` };
      }

      // Generate a simple instance
      const id = `${entityName.toLowerCase()}_${Date.now()}`;
      const instance: Record<string, unknown> = { id };
      entity.instances.set(id, instance);

      return {
        success: true,
        value: instance,
        type: entityName,
        output: `Created ${entityName} instance: ${id}`,
      };
    }

    // Simple arithmetic
    const arithMatch = trimmed.match(/^(\d+)\s*([+\-*/])\s*(\d+)$/);
    if (arithMatch) {
      const a = parseInt(arithMatch[1]);
      const op = arithMatch[2];
      const b = parseInt(arithMatch[3]);
      let result: number;
      switch (op) {
        case '+': result = a + b; break;
        case '-': result = a - b; break;
        case '*': result = a * b; break;
        case '/': result = Math.floor(a / b); break;
        default: return { success: false, error: `Unknown operator: ${op}` };
      }
      return { success: true, value: result, type: 'Int' };
    }

    return { success: false, error: `Cannot evaluate: ${trimmed}` };
  }
}
