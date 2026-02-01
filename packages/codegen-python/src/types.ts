// ============================================================================
// Python Codegen Types
// ============================================================================

/**
 * Python framework targets
 */
export type PythonFramework = 'fastapi' | 'django' | 'flask' | 'litestar' | 'starlette';

/**
 * ORM/Database options
 */
export type PythonORM = 'sqlalchemy' | 'tortoise' | 'django-orm' | 'peewee' | 'prisma' | 'none';

/**
 * Validation library
 */
export type ValidationLib = 'pydantic' | 'attrs' | 'dataclasses' | 'msgspec';

/**
 * Async runtime
 */
export type AsyncRuntime = 'asyncio' | 'trio' | 'anyio';

/**
 * Generation options
 */
export interface PythonGeneratorOptions {
  /** Target framework */
  framework: PythonFramework;
  
  /** ORM to use */
  orm?: PythonORM;
  
  /** Validation library */
  validation?: ValidationLib;
  
  /** Async runtime */
  asyncRuntime?: AsyncRuntime;
  
  /** Output directory */
  outputDir?: string;
  
  /** Python version (default: 3.11) */
  pythonVersion?: string;
  
  /** Generate type stubs (.pyi) */
  generateStubs?: boolean;
  
  /** Generate tests */
  generateTests?: boolean;
  
  /** Use strict typing */
  strictTyping?: boolean;
  
  /** Include docstrings */
  includeDocstrings?: boolean;
  
  /** Generate OpenAPI integration */
  openApiIntegration?: boolean;
  
  /** Generate Alembic migrations */
  generateMigrations?: boolean;
  
  /** Use dependency injection */
  useDependencyInjection?: boolean;
  
  /** Base class for models */
  modelBaseClass?: string;
  
  /** Import style */
  importStyle?: 'absolute' | 'relative';
}

/**
 * Default options
 */
export const DEFAULT_OPTIONS: Required<PythonGeneratorOptions> = {
  framework: 'fastapi',
  orm: 'sqlalchemy',
  validation: 'pydantic',
  asyncRuntime: 'asyncio',
  outputDir: './generated',
  pythonVersion: '3.11',
  generateStubs: false,
  generateTests: true,
  strictTyping: true,
  includeDocstrings: true,
  openApiIntegration: true,
  generateMigrations: true,
  useDependencyInjection: true,
  modelBaseClass: 'BaseModel',
  importStyle: 'absolute',
};

/**
 * ISL Type to Python type mapping
 */
export const TYPE_MAPPING: Record<string, string> = {
  string: 'str',
  number: 'float',
  integer: 'int',
  boolean: 'bool',
  object: 'dict[str, Any]',
  array: 'list',
  null: 'None',
  any: 'Any',
  void: 'None',
  date: 'date',
  datetime: 'datetime',
  time: 'time',
  uuid: 'UUID',
  email: 'EmailStr',
  url: 'HttpUrl',
  money: 'Decimal',
  binary: 'bytes',
};

/**
 * Generated file info
 */
export interface GeneratedFile {
  path: string;
  content: string;
  type: 'model' | 'router' | 'service' | 'repository' | 'test' | 'config' | 'migration';
}

/**
 * Generation result
 */
export interface GenerationResult {
  files: GeneratedFile[];
  summary: {
    models: number;
    routers: number;
    services: number;
    tests: number;
  };
}

/**
 * Domain definition from ISL
 */
export interface Domain {
  name: string;
  description?: string;
  version?: string;
  behaviors: Behavior[];
  entities?: Entity[];
  invariants?: string[];
}

/**
 * Entity definition
 */
export interface Entity {
  name: string;
  description?: string;
  properties: Record<string, PropertyDef>;
  constraints?: string[];
}

/**
 * Property definition
 */
export interface PropertyDef {
  type: string;
  description?: string;
  required?: boolean;
  default?: unknown;
  constraints?: string[];
  format?: string;
}

/**
 * Behavior definition
 */
export interface Behavior {
  name: string;
  description?: string;
  input?: Record<string, PropertyDef>;
  output?: Record<string, PropertyDef>;
  preconditions?: string[];
  postconditions?: string[];
  invariants?: string[];
  errors?: ErrorDef[];
  temporal?: TemporalSpec[];
}

/**
 * Error definition
 */
export interface ErrorDef {
  name: string;
  code?: string;
  message?: string;
  status?: number;
}

/**
 * Temporal specification
 */
export interface TemporalSpec {
  operator: 'within' | 'eventually' | 'always';
  duration?: string;
  percentile?: number;
}
