/**
 * Python Code Generator for ISL
 * 
 * Generates Python classes, Pydantic models, and pytest tests from ISL.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

/** ISL Domain AST (simplified) */
export interface IslDomain {
  name: string;
  version: string;
  entities: IslEntity[];
  behaviors: IslBehavior[];
  enums: IslEnum[];
  types: IslType[];
}

export interface IslEntity {
  name: string;
  fields: IslField[];
  invariants: string[];
  lifecycle?: { from: string; to: string }[];
}

export interface IslBehavior {
  name: string;
  description?: string;
  input: IslField[];
  output: {
    success: string;
    errors: { code: string; message?: string }[];
  };
  preconditions: string[];
  postconditions: string[];
}

export interface IslField {
  name: string;
  type: string;
  optional: boolean;
  modifiers: string[];
  default?: string;
}

export interface IslEnum {
  name: string;
  values: string[];
}

export interface IslType {
  name: string;
  baseType: string;
  constraints?: Record<string, unknown>;
}

/** Generation options */
export interface GenerateOptions {
  /** Output style: pydantic models or dataclasses */
  style?: 'pydantic' | 'dataclass' | 'attrs';
  /** Generate pytest tests */
  generateTests?: boolean;
  /** Generate type stubs */
  generateStubs?: boolean;
  /** Python version target */
  pythonVersion?: '3.9' | '3.10' | '3.11' | '3.12';
  /** Use strict typing */
  strict?: boolean;
  /** Add docstrings */
  docstrings?: boolean;
  /** Module name */
  moduleName?: string;
}

/** Generated output */
export interface GeneratedPython {
  /** Main module code */
  models: string;
  /** Behavior handlers */
  handlers: string;
  /** Pytest tests */
  tests?: string;
  /** Type stubs */
  stubs?: string;
  /** requirements.txt */
  requirements: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Type Mapping
// ─────────────────────────────────────────────────────────────────────────────

const TYPE_MAP: Record<string, string> = {
  'String': 'str',
  'Int': 'int',
  'Float': 'float',
  'Boolean': 'bool',
  'UUID': 'UUID',
  'ID': 'UUID',
  'Timestamp': 'datetime',
  'DateTime': 'datetime',
  'Date': 'date',
  'Time': 'time',
  'Duration': 'timedelta',
  'Email': 'EmailStr',
  'URL': 'HttpUrl',
  'JSON': 'dict[str, Any]',
  'Any': 'Any',
  'Void': 'None',
};

/**
 * Map ISL type to Python type
 */
function mapType(islType: string, options: GenerateOptions): string {
  // Handle optional
  if (islType.endsWith('?')) {
    const inner = islType.slice(0, -1);
    return `Optional[${mapType(inner, options)}]`;
  }

  // Handle List
  const listMatch = islType.match(/^List<(.+)>$/);
  if (listMatch) {
    return `list[${mapType(listMatch[1], options)}]`;
  }

  // Handle Map
  const mapMatch = islType.match(/^Map<(.+),\s*(.+)>$/);
  if (mapMatch) {
    return `dict[${mapType(mapMatch[1], options)}, ${mapType(mapMatch[2], options)}]`;
  }

  // Handle Set
  const setMatch = islType.match(/^Set<(.+)>$/);
  if (setMatch) {
    return `set[${mapType(setMatch[1], options)}]`;
  }

  // Built-in types
  if (TYPE_MAP[islType]) {
    return TYPE_MAP[islType];
  }

  // Custom type (entity, enum, or type alias)
  return islType;
}

/**
 * Convert snake_case to PascalCase
 */
function toPascalCase(str: string): string {
  return str.replace(/(^|_)([a-z])/g, (_, __, c) => c.toUpperCase());
}

/**
 * Convert PascalCase to snake_case
 */
function toSnakeCase(str: string): string {
  return str.replace(/[A-Z]/g, (c, i) => (i > 0 ? '_' : '') + c.toLowerCase());
}

// ─────────────────────────────────────────────────────────────────────────────
// Code Generation
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Generate Python code from ISL domain
 */
export function generate(domain: IslDomain, options: GenerateOptions = {}): GeneratedPython {
  const style = options.style ?? 'pydantic';
  const pythonVersion = options.pythonVersion ?? '3.11';
  const moduleName = options.moduleName ?? toSnakeCase(domain.name);

  const models = generateModels(domain, { ...options, style, pythonVersion, moduleName });
  const handlers = generateHandlers(domain, { ...options, moduleName });
  const requirements = generateRequirements(style);

  const result: GeneratedPython = {
    models,
    handlers,
    requirements,
  };

  if (options.generateTests) {
    result.tests = generateTests(domain, { ...options, moduleName });
  }

  if (options.generateStubs) {
    result.stubs = generateStubs(domain, options);
  }

  return result;
}

/**
 * Generate Pydantic/dataclass models
 */
function generateModels(domain: IslDomain, options: GenerateOptions): string {
  const lines: string[] = [];
  const style = options.style ?? 'pydantic';

  // Imports
  lines.push('"""');
  lines.push(`${domain.name} Domain Models`);
  lines.push('');
  lines.push(`Generated from ISL v${domain.version}`);
  lines.push('"""');
  lines.push('');
  lines.push('from __future__ import annotations');
  lines.push('');
  lines.push('from datetime import datetime, date, time, timedelta');
  lines.push('from enum import Enum');
  lines.push('from typing import Any, Optional, Union');
  lines.push('from uuid import UUID');
  lines.push('');

  if (style === 'pydantic') {
    lines.push('from pydantic import BaseModel, Field, EmailStr, HttpUrl, validator');
    lines.push('');
  } else if (style === 'dataclass') {
    lines.push('from dataclasses import dataclass, field');
    lines.push('');
  } else if (style === 'attrs') {
    lines.push('import attr');
    lines.push('from attr import validators');
    lines.push('');
  }

  lines.push('');

  // Enums
  for (const enumDef of domain.enums) {
    lines.push(...generateEnum(enumDef, options));
    lines.push('');
  }

  // Type aliases
  for (const typeDef of domain.types) {
    lines.push(...generateTypeAlias(typeDef, options));
    lines.push('');
  }

  // Entities
  for (const entity of domain.entities) {
    lines.push(...generateEntity(entity, options));
    lines.push('');
  }

  // Behavior input/output types
  for (const behavior of domain.behaviors) {
    lines.push(...generateBehaviorTypes(behavior, options));
    lines.push('');
  }

  return lines.join('\n');
}

/**
 * Generate enum class
 */
function generateEnum(enumDef: IslEnum, options: GenerateOptions): string[] {
  const lines: string[] = [];
  
  if (options.docstrings) {
    lines.push(`class ${enumDef.name}(str, Enum):`);
    lines.push(`    """${enumDef.name} enumeration."""`);
  } else {
    lines.push(`class ${enumDef.name}(str, Enum):`);
  }

  for (const value of enumDef.values) {
    lines.push(`    ${value} = "${value}"`);
  }

  return lines;
}

/**
 * Generate type alias
 */
function generateTypeAlias(typeDef: IslType, options: GenerateOptions): string[] {
  const pythonType = mapType(typeDef.baseType, options);
  return [`${typeDef.name} = ${pythonType}`];
}

/**
 * Generate entity class
 */
function generateEntity(entity: IslEntity, options: GenerateOptions): string[] {
  const lines: string[] = [];
  const style = options.style ?? 'pydantic';

  if (style === 'pydantic') {
    lines.push(`class ${entity.name}(BaseModel):`);
  } else if (style === 'dataclass') {
    lines.push('@dataclass');
    lines.push(`class ${entity.name}:`);
  } else if (style === 'attrs') {
    lines.push('@attr.s(auto_attribs=True)');
    lines.push(`class ${entity.name}:`);
  }

  if (options.docstrings) {
    lines.push(`    """${entity.name} entity."""`);
    lines.push('');
  }

  // Fields
  for (const field of entity.fields) {
    lines.push(...generateField(field, options, '    '));
  }

  // Validators for Pydantic
  if (style === 'pydantic' && entity.invariants.length > 0) {
    lines.push('');
    for (let i = 0; i < entity.invariants.length; i++) {
      lines.push(`    @validator('*', pre=True, always=True)`);
      lines.push(`    def check_invariant_${i}(cls, v, values):`);
      lines.push(`        # Invariant: ${entity.invariants[i]}`);
      lines.push(`        # TODO: Implement invariant check`);
      lines.push(`        return v`);
      lines.push('');
    }
  }

  // Model config for Pydantic
  if (style === 'pydantic') {
    lines.push('');
    lines.push('    class Config:');
    lines.push('        frozen = True');
    lines.push('        extra = "forbid"');
  }

  return lines;
}

/**
 * Generate field definition
 */
function generateField(field: IslField, options: GenerateOptions, indent: string): string[] {
  const lines: string[] = [];
  const style = options.style ?? 'pydantic';
  const pythonType = mapType(field.type, options);
  const fieldName = toSnakeCase(field.name);

  if (style === 'pydantic') {
    let fieldDef = `${indent}${fieldName}: ${pythonType}`;
    
    const fieldArgs: string[] = [];
    if (field.default !== undefined) {
      fieldArgs.push(`default=${field.default}`);
    } else if (field.optional) {
      fieldArgs.push('default=None');
    }
    if (field.modifiers.includes('immutable')) {
      fieldArgs.push('frozen=True');
    }
    
    if (fieldArgs.length > 0) {
      fieldDef += ` = Field(${fieldArgs.join(', ')})`;
    }
    
    lines.push(fieldDef);
  } else if (style === 'dataclass') {
    let fieldDef = `${indent}${fieldName}: ${pythonType}`;
    
    if (field.default !== undefined) {
      fieldDef += ` = ${field.default}`;
    } else if (field.optional) {
      fieldDef += ' = None';
    }
    
    lines.push(fieldDef);
  } else if (style === 'attrs') {
    let fieldDef = `${indent}${fieldName}: ${pythonType}`;
    
    if (field.default !== undefined) {
      fieldDef += ` = attr.ib(default=${field.default})`;
    } else if (field.optional) {
      fieldDef += ' = attr.ib(default=None)';
    }
    
    lines.push(fieldDef);
  }

  return lines;
}

/**
 * Generate behavior input/output types
 */
function generateBehaviorTypes(behavior: IslBehavior, options: GenerateOptions): string[] {
  const lines: string[] = [];
  const style = options.style ?? 'pydantic';

  // Input type
  if (style === 'pydantic') {
    lines.push(`class ${behavior.name}Input(BaseModel):`);
  } else {
    lines.push('@dataclass');
    lines.push(`class ${behavior.name}Input:`);
  }

  if (options.docstrings && behavior.description) {
    lines.push(`    """${behavior.description}"""`);
    lines.push('');
  }

  if (behavior.input.length === 0) {
    lines.push('    pass');
  } else {
    for (const field of behavior.input) {
      lines.push(...generateField(field, options, '    '));
    }
  }

  lines.push('');

  // Output type
  const outputType = mapType(behavior.output.success, options);
  if (style === 'pydantic') {
    lines.push(`class ${behavior.name}Output(BaseModel):`);
    lines.push(`    success: bool`);
    lines.push(`    value: Optional[${outputType}] = None`);
    lines.push(`    error: Optional[${behavior.name}Error] = None`);
  } else {
    lines.push('@dataclass');
    lines.push(`class ${behavior.name}Output:`);
    lines.push(`    success: bool`);
    lines.push(`    value: Optional[${outputType}] = None`);
    lines.push(`    error: Optional[${behavior.name}Error] = None`);
  }

  lines.push('');

  // Error type
  lines.push(`class ${behavior.name}Error(str, Enum):`);
  for (const error of behavior.output.errors) {
    lines.push(`    ${error.code} = "${error.code}"`);
  }

  return lines;
}

/**
 * Generate behavior handlers
 */
function generateHandlers(domain: IslDomain, options: GenerateOptions): string[] {
  const lines: string[] = [];
  const moduleName = options.moduleName ?? toSnakeCase(domain.name);

  lines.push('"""');
  lines.push(`${domain.name} Behavior Handlers`);
  lines.push('"""');
  lines.push('');
  lines.push('from __future__ import annotations');
  lines.push('');
  lines.push('from abc import ABC, abstractmethod');
  lines.push('from typing import Protocol');
  lines.push('');
  lines.push(`from .models import *`);
  lines.push('');
  lines.push('');

  // Handler protocol/interface
  for (const behavior of domain.behaviors) {
    const handlerName = `${behavior.name}Handler`;
    const inputType = `${behavior.name}Input`;
    const outputType = `${behavior.name}Output`;

    lines.push(`class ${handlerName}(Protocol):`);
    if (options.docstrings && behavior.description) {
      lines.push(`    """${behavior.description}"""`);
      lines.push('');
    }
    lines.push(`    async def execute(self, input: ${inputType}) -> ${outputType}:`);
    lines.push('        ...');
    lines.push('');
    lines.push('');
  }

  // Base handler class
  lines.push('class BehaviorHandler(ABC):');
  lines.push('    """Base class for behavior handlers."""');
  lines.push('');
  lines.push('    @abstractmethod');
  lines.push('    async def execute(self, input: Any) -> Any:');
  lines.push('        """Execute the behavior."""');
  lines.push('        pass');
  lines.push('');
  lines.push('    def validate_preconditions(self, input: Any) -> bool:');
  lines.push('        """Validate preconditions. Override in subclass."""');
  lines.push('        return True');
  lines.push('');
  lines.push('    def validate_postconditions(self, input: Any, output: Any) -> bool:');
  lines.push('        """Validate postconditions. Override in subclass."""');
  lines.push('        return True');

  return lines;
}

/**
 * Generate pytest tests
 */
function generateTests(domain: IslDomain, options: GenerateOptions): string {
  const lines: string[] = [];
  const moduleName = options.moduleName ?? toSnakeCase(domain.name);

  lines.push('"""');
  lines.push(`Tests for ${domain.name} Domain`);
  lines.push('"""');
  lines.push('');
  lines.push('import pytest');
  lines.push('from uuid import uuid4');
  lines.push('');
  lines.push(`from ${moduleName}.models import *`);
  lines.push('');
  lines.push('');

  // Entity tests
  for (const entity of domain.entities) {
    lines.push(`class Test${entity.name}:`);
    lines.push(`    """Tests for ${entity.name} entity."""`);
    lines.push('');
    lines.push(`    def test_create_valid(self):`);
    lines.push(`        """Test creating a valid ${entity.name}."""`);
    lines.push(`        # TODO: Provide valid field values`);
    lines.push(`        entity = ${entity.name}(`);
    for (const field of entity.fields) {
      if (!field.optional && !field.default) {
        lines.push(`            ${toSnakeCase(field.name)}=...,  # TODO: Add value`);
      }
    }
    lines.push(`        )`);
    lines.push(`        assert entity is not None`);
    lines.push('');
    lines.push(`    def test_immutable_fields(self):`);
    lines.push(`        """Test that immutable fields cannot be changed."""`);
    lines.push('        # TODO: Implement test');
    lines.push('        pass');
    lines.push('');
    lines.push('');
  }

  // Behavior tests
  for (const behavior of domain.behaviors) {
    lines.push(`class Test${behavior.name}:`);
    lines.push(`    """Tests for ${behavior.name} behavior."""`);
    lines.push('');
    lines.push('    @pytest.mark.asyncio');
    lines.push(`    async def test_success(self):`);
    lines.push(`        """Test successful execution."""`);
    lines.push('        # TODO: Implement test');
    lines.push('        pass');
    lines.push('');
    
    for (const error of behavior.output.errors) {
      lines.push('    @pytest.mark.asyncio');
      lines.push(`    async def test_error_${toSnakeCase(error.code)}(self):`);
      lines.push(`        """Test ${error.code} error case."""`);
      lines.push('        # TODO: Implement test');
      lines.push('        pass');
      lines.push('');
    }
    
    lines.push('');
  }

  return lines.join('\n');
}

/**
 * Generate type stubs (.pyi)
 */
function generateStubs(domain: IslDomain, options: GenerateOptions): string {
  const lines: string[] = [];

  lines.push('# Type stubs for ' + domain.name);
  lines.push('');
  lines.push('from typing import Any, Optional');
  lines.push('from uuid import UUID');
  lines.push('from datetime import datetime');
  lines.push('');

  for (const entity of domain.entities) {
    lines.push(`class ${entity.name}:`);
    for (const field of entity.fields) {
      const pythonType = mapType(field.type, options);
      lines.push(`    ${toSnakeCase(field.name)}: ${pythonType}`);
    }
    lines.push('');
  }

  return lines.join('\n');
}

/**
 * Generate requirements.txt
 */
function generateRequirements(style: string): string {
  const deps: string[] = [];

  if (style === 'pydantic') {
    deps.push('pydantic>=2.0.0');
    deps.push('email-validator>=2.0.0');
  } else if (style === 'attrs') {
    deps.push('attrs>=23.0.0');
  }

  deps.push('pytest>=7.0.0');
  deps.push('pytest-asyncio>=0.21.0');

  return deps.join('\n');
}

// ─────────────────────────────────────────────────────────────────────────────
// CLI Helper
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Generate Python files from ISL domain
 */
export function generateFiles(
  domain: IslDomain, 
  options: GenerateOptions = {}
): Map<string, string> {
  const generated = generate(domain, options);
  const moduleName = options.moduleName ?? toSnakeCase(domain.name);
  
  const files = new Map<string, string>();
  
  files.set(`${moduleName}/models.py`, generated.models);
  files.set(`${moduleName}/handlers.py`, generated.handlers);
  files.set(`${moduleName}/__init__.py`, `"""${domain.name} Domain Package"""\n\nfrom .models import *\nfrom .handlers import *`);
  files.set('requirements.txt', generated.requirements);
  
  if (generated.tests) {
    files.set(`tests/test_${moduleName}.py`, generated.tests);
  }
  
  if (generated.stubs) {
    files.set(`${moduleName}/models.pyi`, generated.stubs);
  }
  
  return files;
}
