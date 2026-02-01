// Code generators for different output formats
import type { Domain, TypeDefinition, Behavior } from './compiler'

export function generateTypes(domain: Domain): string {
  const lines: string[] = []
  
  lines.push(`// Generated TypeScript types for ${domain.name}`)
  lines.push(`// ${domain.description || 'No description'}`)
  lines.push('')
  
  // Generate type definitions
  for (const type of domain.types) {
    lines.push(`export interface ${type.name} {`)
    for (const field of type.fields) {
      const optional = field.optional ? '?' : ''
      lines.push(`  ${field.name}${optional}: ${mapType(field.type)};`)
    }
    lines.push('}')
    lines.push('')
  }
  
  // Generate behavior interfaces
  lines.push('// Behavior contracts')
  lines.push('')
  
  for (const behavior of domain.behaviors) {
    const params = behavior.parameters.map(p => `${p.name}: ${mapType(p.type)}`).join(', ')
    const returnType = behavior.returns ? mapType(behavior.returns) : 'void'
    
    lines.push(`/**`)
    if (behavior.description) {
      lines.push(` * ${behavior.description}`)
    }
    if (behavior.preconditions.length > 0) {
      lines.push(` * @preconditions`)
      for (const pre of behavior.preconditions) {
        lines.push(` *   - ${pre}`)
      }
    }
    if (behavior.postconditions.length > 0) {
      lines.push(` * @postconditions`)
      for (const post of behavior.postconditions) {
        lines.push(` *   - ${post}`)
      }
    }
    lines.push(` */`)
    lines.push(`export type ${behavior.name} = (${params}) => Promise<${returnType}>;`)
    lines.push('')
  }
  
  // Generate domain interface
  lines.push(`// Domain interface`)
  lines.push(`export interface ${domain.name}Domain {`)
  for (const behavior of domain.behaviors) {
    lines.push(`  ${camelCase(behavior.name)}: ${behavior.name};`)
  }
  lines.push('}')
  
  return lines.join('\n')
}

export function generateTests(domain: Domain): string {
  const lines: string[] = []
  
  lines.push(`// Generated tests for ${domain.name}`)
  lines.push(`import { describe, it, expect, beforeEach } from 'vitest';`)
  lines.push(`import type { ${domain.name}Domain } from './${domain.name.toLowerCase()}.types';`)
  lines.push('')
  
  lines.push(`describe('${domain.name}', () => {`)
  lines.push(`  let domain: ${domain.name}Domain;`)
  lines.push('')
  lines.push(`  beforeEach(() => {`)
  lines.push(`    // Initialize domain implementation`)
  lines.push(`    domain = {} as ${domain.name}Domain; // TODO: Replace with actual implementation`)
  lines.push(`  });`)
  lines.push('')
  
  for (const behavior of domain.behaviors) {
    lines.push(`  describe('${behavior.name}', () => {`)
    
    // Generate test for each precondition
    for (let i = 0; i < behavior.preconditions.length; i++) {
      const pre = behavior.preconditions[i]
      lines.push(`    it('should require: ${escapeString(pre)}', async () => {`)
      lines.push(`      // Precondition: ${pre}`)
      lines.push(`      // TODO: Set up test to verify precondition`)
      lines.push(`      expect(true).toBe(true);`)
      lines.push(`    });`)
      lines.push('')
    }
    
    // Generate test for each postcondition
    for (let i = 0; i < behavior.postconditions.length; i++) {
      const post = behavior.postconditions[i]
      lines.push(`    it('should ensure: ${escapeString(post)}', async () => {`)
      lines.push(`      // Postcondition: ${post}`)
      lines.push(`      // TODO: Set up test to verify postcondition`)
      lines.push(`      expect(true).toBe(true);`)
      lines.push(`    });`)
      lines.push('')
    }
    
    // Generate a happy path test
    lines.push(`    it('should complete successfully with valid inputs', async () => {`)
    if (behavior.parameters.length > 0) {
      lines.push(`      // Arrange`)
      for (const param of behavior.parameters) {
        lines.push(`      const ${param.name} = ${getDefaultValue(param.type)}; // TODO: Replace with valid test data`)
      }
      lines.push('')
      lines.push(`      // Act`)
      const params = behavior.parameters.map(p => p.name).join(', ')
      lines.push(`      const result = await domain.${camelCase(behavior.name)}(${params});`)
    } else {
      lines.push(`      // Act`)
      lines.push(`      const result = await domain.${camelCase(behavior.name)}();`)
    }
    lines.push('')
    lines.push(`      // Assert`)
    lines.push(`      expect(result).toBeDefined();`)
    lines.push(`    });`)
    
    lines.push(`  });`)
    lines.push('')
  }
  
  lines.push(`});`)
  
  return lines.join('\n')
}

export function generateDocs(domain: Domain): string {
  const lines: string[] = []
  
  lines.push(`# ${domain.name}`)
  lines.push('')
  if (domain.description) {
    lines.push(domain.description)
    lines.push('')
  }
  
  // Types section
  if (domain.types.length > 0) {
    lines.push(`## Types`)
    lines.push('')
    
    for (const type of domain.types) {
      lines.push(`### ${type.name}`)
      lines.push('')
      lines.push('| Field | Type | Required |')
      lines.push('|-------|------|----------|')
      for (const field of type.fields) {
        lines.push(`| \`${field.name}\` | \`${field.type}\` | ${field.optional ? 'No' : 'Yes'} |`)
      }
      lines.push('')
    }
  }
  
  // Behaviors section
  if (domain.behaviors.length > 0) {
    lines.push(`## Behaviors`)
    lines.push('')
    
    for (const behavior of domain.behaviors) {
      lines.push(`### ${behavior.name}`)
      lines.push('')
      
      if (behavior.description) {
        lines.push(behavior.description)
        lines.push('')
      }
      
      // Parameters
      if (behavior.parameters.length > 0) {
        lines.push('**Parameters:**')
        lines.push('')
        for (const param of behavior.parameters) {
          lines.push(`- \`${param.name}\`: \`${param.type}\``)
        }
        lines.push('')
      }
      
      // Returns
      if (behavior.returns) {
        lines.push(`**Returns:** \`${behavior.returns}\``)
        lines.push('')
      }
      
      // Preconditions
      if (behavior.preconditions.length > 0) {
        lines.push('**Preconditions:**')
        lines.push('')
        for (const pre of behavior.preconditions) {
          lines.push(`- ${pre}`)
        }
        lines.push('')
      }
      
      // Postconditions
      if (behavior.postconditions.length > 0) {
        lines.push('**Postconditions:**')
        lines.push('')
        for (const post of behavior.postconditions) {
          lines.push(`- ${post}`)
        }
        lines.push('')
      }
    }
  }
  
  return lines.join('\n')
}

export function generatePython(domain: Domain): string {
  const lines: string[] = []
  
  lines.push(`"""`)
  lines.push(`Generated Python types for ${domain.name}`)
  lines.push(`${domain.description || ''}`)
  lines.push(`"""`)
  lines.push('')
  lines.push(`from dataclasses import dataclass`)
  lines.push(`from typing import Optional, List, Protocol`)
  lines.push(`from abc import abstractmethod`)
  lines.push('')
  
  // Generate dataclasses for types
  for (const type of domain.types) {
    lines.push(`@dataclass`)
    lines.push(`class ${type.name}:`)
    if (type.fields.length === 0) {
      lines.push(`    pass`)
    } else {
      for (const field of type.fields) {
        const pyType = mapTypeToPython(field.type)
        if (field.optional) {
          lines.push(`    ${field.name}: Optional[${pyType}] = None`)
        } else {
          lines.push(`    ${field.name}: ${pyType}`)
        }
      }
    }
    lines.push('')
  }
  
  // Generate Protocol for domain
  lines.push(`class ${domain.name}Protocol(Protocol):`)
  lines.push(`    """${domain.description || 'Domain protocol'}"""`)
  lines.push('')
  
  for (const behavior of domain.behaviors) {
    const params = behavior.parameters.map(p => `${p.name}: ${mapTypeToPython(p.type)}`).join(', ')
    const returnType = behavior.returns ? mapTypeToPython(behavior.returns) : 'None'
    
    lines.push(`    @abstractmethod`)
    lines.push(`    async def ${snakeCase(behavior.name)}(self${params ? ', ' + params : ''}) -> ${returnType}:`)
    lines.push(`        """`)
    if (behavior.description) {
      lines.push(`        ${behavior.description}`)
      lines.push(`        `)
    }
    if (behavior.preconditions.length > 0) {
      lines.push(`        Preconditions:`)
      for (const pre of behavior.preconditions) {
        lines.push(`            - ${pre}`)
      }
    }
    if (behavior.postconditions.length > 0) {
      lines.push(`        Postconditions:`)
      for (const post of behavior.postconditions) {
        lines.push(`            - ${post}`)
      }
    }
    lines.push(`        """`)
    lines.push(`        ...`)
    lines.push('')
  }
  
  return lines.join('\n')
}

export function generateOpenAPI(domain: Domain): string {
  const spec = {
    openapi: '3.0.3',
    info: {
      title: `${domain.name} API`,
      description: domain.description || '',
      version: '1.0.0',
    },
    paths: {} as Record<string, unknown>,
    components: {
      schemas: {} as Record<string, unknown>,
    },
  }
  
  // Generate schemas for types
  for (const type of domain.types) {
    spec.components.schemas[type.name] = {
      type: 'object',
      properties: type.fields.reduce((acc, field) => {
        acc[field.name] = { type: mapTypeToOpenAPI(field.type) }
        return acc
      }, {} as Record<string, { type: string }>),
      required: type.fields.filter(f => !f.optional).map(f => f.name),
    }
  }
  
  // Generate paths for behaviors
  for (const behavior of domain.behaviors) {
    const path = `/${domain.name.toLowerCase()}/${behavior.name.toLowerCase().replace(/_/g, '-')}`
    
    spec.paths[path] = {
      post: {
        summary: behavior.name,
        description: [
          behavior.description,
          '',
          behavior.preconditions.length > 0 ? '**Preconditions:**' : '',
          ...behavior.preconditions.map(p => `- ${p}`),
          '',
          behavior.postconditions.length > 0 ? '**Postconditions:**' : '',
          ...behavior.postconditions.map(p => `- ${p}`),
        ].filter(Boolean).join('\n'),
        requestBody: behavior.parameters.length > 0 ? {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: behavior.parameters.reduce((acc, param) => {
                  acc[param.name] = { type: mapTypeToOpenAPI(param.type) }
                  return acc
                }, {} as Record<string, { type: string }>),
              },
            },
          },
        } : undefined,
        responses: {
          '200': {
            description: 'Success',
            content: behavior.returns ? {
              'application/json': {
                schema: { type: mapTypeToOpenAPI(behavior.returns) },
              },
            } : undefined,
          },
          '400': { description: 'Precondition failed' },
          '500': { description: 'Internal error' },
        },
      },
    }
  }
  
  return JSON.stringify(spec, null, 2)
}

// Helper functions
function mapType(islType: string): string {
  const typeMap: Record<string, string> = {
    'string': 'string',
    'String': 'string',
    'number': 'number',
    'Number': 'number',
    'int': 'number',
    'Int': 'number',
    'float': 'number',
    'Float': 'number',
    'boolean': 'boolean',
    'Boolean': 'boolean',
    'bool': 'boolean',
    'Bool': 'boolean',
    'void': 'void',
    'Void': 'void',
    'null': 'null',
    'any': 'unknown',
    'Any': 'unknown',
  }
  
  if (islType.endsWith('[]')) {
    return `${mapType(islType.slice(0, -2))}[]`
  }
  
  return typeMap[islType] || islType
}

function mapTypeToPython(islType: string): string {
  const typeMap: Record<string, string> = {
    'string': 'str',
    'String': 'str',
    'number': 'float',
    'Number': 'float',
    'int': 'int',
    'Int': 'int',
    'float': 'float',
    'Float': 'float',
    'boolean': 'bool',
    'Boolean': 'bool',
    'bool': 'bool',
    'Bool': 'bool',
    'void': 'None',
    'Void': 'None',
  }
  
  if (islType.endsWith('[]')) {
    return `List[${mapTypeToPython(islType.slice(0, -2))}]`
  }
  
  return typeMap[islType] || islType
}

function mapTypeToOpenAPI(islType: string): string {
  const typeMap: Record<string, string> = {
    'string': 'string',
    'String': 'string',
    'number': 'number',
    'Number': 'number',
    'int': 'integer',
    'Int': 'integer',
    'float': 'number',
    'Float': 'number',
    'boolean': 'boolean',
    'Boolean': 'boolean',
    'bool': 'boolean',
    'Bool': 'boolean',
  }
  
  return typeMap[islType] || 'object'
}

function camelCase(str: string): string {
  return str
    .replace(/[-_](.)/g, (_, c) => c.toUpperCase())
    .replace(/^./, c => c.toLowerCase())
}

function snakeCase(str: string): string {
  return str
    .replace(/([A-Z])/g, '_$1')
    .toLowerCase()
    .replace(/^_/, '')
}

function escapeString(str: string): string {
  return str.replace(/'/g, "\\'").replace(/"/g, '\\"')
}

function getDefaultValue(type: string): string {
  const defaults: Record<string, string> = {
    'string': "'test'",
    'String': "'test'",
    'number': '0',
    'Number': '0',
    'int': '0',
    'Int': '0',
    'float': '0.0',
    'Float': '0.0',
    'boolean': 'true',
    'Boolean': 'true',
    'bool': 'true',
    'Bool': 'true',
  }
  
  if (type.endsWith('[]')) {
    return '[]'
  }
  
  return defaults[type] || '{}'
}
