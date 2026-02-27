// ============================================================================
// Fuzz Tests - Generate and parse random valid ISL programs
// ============================================================================

import { describe, it, expect } from 'vitest';
import { parse } from '../src/index.js';

// Random utilities
function randomChoice<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]!;
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomName(): string {
  const prefixes = ['User', 'Order', 'Product', 'Account', 'Payment', 'Session', 'Item', 'Event', 'Message', 'Task'];
  const suffixes = ['', 'Data', 'Info', 'Status', 'Type', 'Record', 'Entry', 'Value'];
  return randomChoice(prefixes) + randomChoice(suffixes);
}

function randomFieldName(): string {
  const names = ['id', 'name', 'email', 'status', 'amount', 'created_at', 'updated_at', 
                 'count', 'value', 'description', 'title', 'type', 'code', 'data', 'metadata'];
  return randomChoice(names) + (Math.random() > 0.7 ? '_' + randomInt(1, 9) : '');
}

function randomPrimitiveType(): string {
  return randomChoice(['String', 'Int', 'Boolean', 'UUID', 'Timestamp', 'Decimal']);
}

function randomAnnotation(): string {
  const annotations = ['unique', 'immutable', 'indexed', 'secret', 'pii'];
  return randomChoice(annotations);
}

// Generator functions
function generateField(): string {
  const name = randomFieldName();
  const type = randomPrimitiveType();
  const optional = Math.random() > 0.7 ? '?' : '';
  const annotations: string[] = [];
  
  if (Math.random() > 0.6) {
    annotations.push(randomAnnotation());
    if (Math.random() > 0.7) {
      annotations.push(randomAnnotation());
    }
  }
  
  const annotationStr = annotations.length > 0 ? ` [${annotations.join(', ')}]` : '';
  return `    ${name}: ${type}${optional}${annotationStr}`;
}

function generateEntity(): string {
  const name = randomName();
  const fieldCount = randomInt(2, 6);
  const fields: string[] = [];
  
  // Always add an id field
  fields.push('    id: UUID [immutable, unique]');
  
  for (let i = 0; i < fieldCount - 1; i++) {
    fields.push(generateField());
  }
  
  const invariants = Math.random() > 0.7 ? `
    
    invariants {
      id != null
    }` : '';
  
  return `  entity ${name} {
${fields.join('\n')}${invariants}
  }`;
}

function generateBehavior(): string {
  const verbs = ['Create', 'Update', 'Delete', 'Get', 'List', 'Process', 'Validate'];
  const name = randomChoice(verbs) + randomName();
  
  const hasPreConditions = Math.random() > 0.5;
  const hasPostConditions = Math.random() > 0.5;
  
  let preconditions = '';
  if (hasPreConditions) {
    preconditions = `
    
    preconditions {
      input.id != null
    }`;
  }
  
  let postconditions = '';
  if (hasPostConditions) {
    postconditions = `
    
    postconditions {
      success implies {
        result != null
      }
    }`;
  }
  
  return `  behavior ${name} {
    description: "Auto-generated behavior"
    
    input {
      id: UUID
    }
    
    output {
      success: Boolean
      
      errors {
        NOT_FOUND {
          when: "Resource not found"
          retriable: false
        }
      }
    }${preconditions}${postconditions}
  }`;
}

function generateEnumType(): string {
  const name = randomName() + 'Status';
  const variants = ['PENDING', 'ACTIVE', 'INACTIVE', 'COMPLETED', 'CANCELLED', 'FAILED'];
  const selectedVariants = variants.slice(0, randomInt(2, 5));
  
  return `  enum ${name} {
    ${selectedVariants.join('\n    ')}
  }`;
}

function generateConstrainedType(): string {
  const name = randomName() + 'Id';
  const base = randomChoice(['String', 'Int', 'Decimal']);
  const constraints: string[] = [];
  
  if (base === 'String') {
    if (Math.random() > 0.5) constraints.push(`max_length: ${randomInt(50, 255)}`);
    if (Math.random() > 0.5) constraints.push(`min_length: ${randomInt(1, 10)}`);
  } else if (base === 'Int' || base === 'Decimal') {
    if (Math.random() > 0.5) constraints.push(`min: ${randomInt(0, 10)}`);
    if (Math.random() > 0.5) constraints.push(`max: ${randomInt(100, 10000)}`);
  }
  
  if (constraints.length === 0) {
    constraints.push('immutable: true');
  }
  
  return `  type ${name} = ${base} {
    ${constraints.join('\n    ')}
  }`;
}

function generateDomain(): string {
  const name = randomName() + 'Domain';
  const version = `${randomInt(0, 3)}.${randomInt(0, 9)}.${randomInt(0, 9)}`;
  
  const parts: string[] = [];
  
  // Add some types
  if (Math.random() > 0.3) {
    parts.push(generateConstrainedType());
  }
  if (Math.random() > 0.5) {
    parts.push(generateEnumType());
  }
  
  // Add entities
  const entityCount = randomInt(1, 3);
  for (let i = 0; i < entityCount; i++) {
    parts.push(generateEntity());
  }
  
  // Add behaviors
  const behaviorCount = randomInt(1, 3);
  for (let i = 0; i < behaviorCount; i++) {
    parts.push(generateBehavior());
  }
  
  return `domain ${name} {
  version: "${version}"
  
${parts.join('\n\n')}
}`;
}

describe('Fuzz Tests', () => {
  describe('Generate and Parse 100 Random ISL Programs', () => {
    const programs: string[] = [];
    const results: { index: number; success: boolean; errors: string[] }[] = [];
    
    // Generate 100 programs
    for (let i = 0; i < 100; i++) {
      programs.push(generateDomain());
    }
    
    it.each(programs.map((p, i) => [i + 1, p]))(
      'should parse generated program %d',
      (index, source) => {
        const result = parse(source as string);
        
        results.push({
          index: index as number,
          success: result.success,
          errors: result.errors.filter(e => e.severity === 'error').map(e => e.message),
        });
        
        if (!result.success) {
          console.log(`\n=== Failed Program ${index} ===`);
          console.log(source);
          console.log('\nErrors:');
          for (const err of result.errors.filter(e => e.severity === 'error')) {
            console.log(`  ${err.location.line}:${err.location.column}: ${err.message}`);
          }
        }
        
        expect(result.success).toBe(true);
      }
    );
    
    it('should have 100% pass rate', () => {
      const passed = results.filter(r => r.success).length;
      const failed = results.filter(r => !r.success).length;
      
      console.log(`\n=== Fuzz Test Summary ===`);
      console.log(`Passed: ${passed}/100`);
      console.log(`Failed: ${failed}/100`);
      
      expect(failed).toBe(0);
    });
  });
  
  describe('Edge Cases', () => {
    it('should parse empty entity', () => {
      const source = `
domain Test {
  version: "1.0.0"
  entity Empty {
    id: UUID
  }
}
      `;
      const result = parse(source);
      expect(result.success).toBe(true);
    });
    
    it('should parse deeply nested expressions', () => {
      const source = `
domain Test {
  version: "1.0.0"
  entity User {
    id: UUID
    invariants {
      ((a and b) or (c and d)) implies (e or f)
    }
  }
}
      `;
      const result = parse(source);
      expect(result.success).toBe(true);
    });
    
    it('should parse behavior with many errors', () => {
      const source = `
domain Test {
  version: "1.0.0"
  behavior Multi {
    input { id: UUID }
    output {
      success: Boolean
      errors {
        ERR_1 { when: "Error 1" retriable: true }
        ERR_2 { when: "Error 2" retriable: false }
        ERR_3 { when: "Error 3" retriable: true }
      }
    }
  }
}
      `;
      const result = parse(source);
      expect(result.success).toBe(true);
      expect(result.domain?.behaviors[0]?.output.errors).toHaveLength(3);
    });
    
    it('should parse long identifiers', () => {
      const longName = 'VeryLongEntityNameThatMightCauseIssues';
      const source = `
domain ${longName}Domain {
  version: "1.0.0"
  entity ${longName}Entity {
    id: UUID
  }
}
      `;
      const result = parse(source);
      expect(result.success).toBe(true);
      expect(result.domain?.name.name).toBe(longName + 'Domain');
    });
  });
});
