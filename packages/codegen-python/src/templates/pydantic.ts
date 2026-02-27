// ============================================================================
// Pydantic Model Templates
// ============================================================================

import type { Entity, PropertyDef, Domain, Behavior } from '../types.js';
import { TYPE_MAPPING } from '../types.js';

/**
 * Generate Pydantic model from entity
 */
export function generatePydanticModel(entity: Entity, options: { strictTyping: boolean }): string {
  const fields = Object.entries(entity.properties)
    .map(([name, prop]) => generateField(name, prop, options))
    .join('\n    ');

  const validators = generateValidators(entity);
  const configClass = generateConfigClass(entity);

  return `
class ${entity.name}(BaseModel):
    """${entity.description ?? entity.name} model."""
    
    ${fields}
    ${validators}
    ${configClass}
`;
}

/**
 * Generate field definition
 */
function generateField(name: string, prop: PropertyDef, options: { strictTyping: boolean }): string {
  const pyType = mapToPythonType(prop.type, prop.format);
  const optional = !prop.required;
  const typeAnnotation = optional ? `${pyType} | None` : pyType;
  
  const fieldArgs: string[] = [];
  
  if (prop.default !== undefined) {
    fieldArgs.push(`default=${formatDefault(prop.default)}`);
  } else if (optional) {
    fieldArgs.push('default=None');
  } else {
    fieldArgs.push('...');
  }
  
  if (prop.description) {
    fieldArgs.push(`description="${prop.description}"`);
  }
  
  // Add constraints
  if (prop.constraints) {
    for (const constraint of prop.constraints) {
      const constraintArg = parseConstraint(constraint);
      if (constraintArg) fieldArgs.push(constraintArg);
    }
  }

  return `${name}: ${typeAnnotation} = Field(${fieldArgs.join(', ')})`;
}

/**
 * Map ISL type to Python type
 */
function mapToPythonType(type: string, format?: string): string {
  if (format) {
    const formatMap: Record<string, string> = {
      email: 'EmailStr',
      url: 'HttpUrl',
      uuid: 'UUID',
      date: 'date',
      datetime: 'datetime',
      time: 'time',
      uri: 'AnyUrl',
      ipv4: 'IPv4Address',
      ipv6: 'IPv6Address',
    };
    if (formatMap[format]) return formatMap[format];
  }

  // Handle array types
  if (type.endsWith('[]')) {
    const innerType = type.slice(0, -2);
    return `list[${mapToPythonType(innerType)}]`;
  }

  // Handle generic types
  if (type.includes('<')) {
    const match = type.match(/^(\w+)<(.+)>$/);
    if (match) {
      const [, outer, inner] = match;
      const mappedOuter = outer === 'Array' ? 'list' : outer === 'Map' ? 'dict' : outer;
      return `${mappedOuter}[${mapToPythonType(inner!)}]`;
    }
  }

  return TYPE_MAPPING[type] ?? type;
}

/**
 * Format default value for Python
 */
function formatDefault(value: unknown): string {
  if (value === null) return 'None';
  if (typeof value === 'string') return `"${value}"`;
  if (typeof value === 'boolean') return value ? 'True' : 'False';
  if (Array.isArray(value)) return `[${value.map(formatDefault).join(', ')}]`;
  if (typeof value === 'object') return `{${Object.entries(value as Record<string, unknown>).map(([k, v]) => `"${k}": ${formatDefault(v)}`).join(', ')}}`;
  return String(value);
}

/**
 * Parse constraint to Pydantic Field argument
 */
function parseConstraint(constraint: string): string | null {
  const patterns: Array<[RegExp, (m: RegExpMatchArray) => string]> = [
    [/min_length\s*[=:]\s*(\d+)/, m => `min_length=${m[1]}`],
    [/max_length\s*[=:]\s*(\d+)/, m => `max_length=${m[1]}`],
    [/minimum\s*[=:]\s*(\d+)/, m => `ge=${m[1]}`],
    [/maximum\s*[=:]\s*(\d+)/, m => `le=${m[1]}`],
    [/pattern\s*[=:]\s*["'](.+)["']/, m => `pattern=r"${m[1]}"`],
    [/gt\s*[=:]\s*(\d+)/, m => `gt=${m[1]}`],
    [/lt\s*[=:]\s*(\d+)/, m => `lt=${m[1]}`],
  ];

  for (const [pattern, formatter] of patterns) {
    const match = constraint.match(pattern);
    if (match) return formatter(match);
  }

  return null;
}

/**
 * Generate validators
 */
function generateValidators(entity: Entity): string {
  if (!entity.constraints?.length) return '';

  const validators: string[] = [];

  for (const constraint of entity.constraints) {
    // Parse custom validators from constraints
    if (constraint.includes('unique')) {
      // Add uniqueness validator placeholder
      validators.push(`
    @field_validator('*', mode='before')
    @classmethod
    def validate_uniqueness(cls, v):
        # Implement uniqueness check
        return v`);
    }
  }

  return validators.join('\n');
}

/**
 * Generate config class
 */
function generateConfigClass(entity: Entity): string {
  return `
    model_config = ConfigDict(
        str_strip_whitespace=True,
        validate_assignment=True,
        extra='forbid',
        json_schema_extra={
            "example": ${generateExample(entity)}
        }
    )`;
}

/**
 * Generate example for schema
 */
function generateExample(entity: Entity): string {
  const example: Record<string, unknown> = {};
  
  for (const [name, prop] of Object.entries(entity.properties)) {
    example[name] = generateExampleValue(prop.type, prop.format);
  }

  return JSON.stringify(example, null, 8).replace(/\n/g, '\n        ');
}

/**
 * Generate example value for type
 */
function generateExampleValue(type: string, format?: string): unknown {
  if (format === 'email') return 'user@example.com';
  if (format === 'url') return 'https://example.com';
  if (format === 'uuid') return '123e4567-e89b-12d3-a456-426614174000';
  if (format === 'date') return '2024-01-01';
  if (format === 'datetime') return '2024-01-01T00:00:00Z';

  switch (type) {
    case 'string': return 'example';
    case 'number': return 0.0;
    case 'integer': return 0;
    case 'boolean': return true;
    case 'array': return [];
    case 'object': return {};
    default: return null;
  }
}

/**
 * Generate request/response models from behavior
 */
export function generateBehaviorModels(behavior: Behavior, domainName: string): string {
  const models: string[] = [];
  const baseName = pascalCase(behavior.name);

  // Request model
  if (behavior.input && Object.keys(behavior.input).length > 0) {
    const inputFields = Object.entries(behavior.input)
      .map(([name, prop]) => generateField(name, prop, { strictTyping: true }))
      .join('\n    ');

    models.push(`
class ${baseName}Request(BaseModel):
    """Request model for ${behavior.name}."""
    
    ${inputFields}
`);
  }

  // Response model
  if (behavior.output && Object.keys(behavior.output).length > 0) {
    const outputFields = Object.entries(behavior.output)
      .map(([name, prop]) => generateField(name, prop, { strictTyping: true }))
      .join('\n    ');

    models.push(`
class ${baseName}Response(BaseModel):
    """Response model for ${behavior.name}."""
    
    ${outputFields}
`);
  }

  // Error models
  if (behavior.errors) {
    for (const error of behavior.errors) {
      models.push(`
class ${baseName}${pascalCase(error.name)}Error(BaseModel):
    """Error model for ${error.name}."""
    
    code: str = Field(default="${error.code ?? error.name}")
    message: str = Field(default="${error.message ?? error.name}")
    details: dict[str, Any] | None = Field(default=None)
`);
    }
  }

  return models.join('\n');
}

/**
 * Convert to PascalCase
 */
function pascalCase(str: string): string {
  return str
    .split(/[_\s-]+/)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join('');
}
