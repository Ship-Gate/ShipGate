// ============================================================================
// Advanced Python Code Generation Types
// ============================================================================

/**
 * Target Python framework
 */
export type PythonFramework =
  | 'fastapi'
  | 'django'
  | 'flask'
  | 'litestar'
  | 'none';

/**
 * ORM framework
 */
export type PythonORM =
  | 'sqlalchemy'
  | 'django-orm'
  | 'tortoise'
  | 'prisma'
  | 'none';

/**
 * Validation library
 */
export type PythonValidation =
  | 'pydantic'
  | 'attrs'
  | 'dataclasses'
  | 'marshmallow';

/**
 * Async runtime
 */
export type AsyncRuntime =
  | 'asyncio'
  | 'trio'
  | 'anyio';

/**
 * Generation options
 */
export interface PythonGeneratorOptions {
  /** Target framework */
  framework: PythonFramework;

  /** ORM framework */
  orm: PythonORM;

  /** Validation library */
  validation: PythonValidation;

  /** Async runtime */
  asyncRuntime: AsyncRuntime;

  /** Use async/await */
  useAsync: boolean;

  /** Python version */
  pythonVersion: '3.10' | '3.11' | '3.12';

  /** Output directory */
  outputDir: string;

  /** Package name */
  packageName: string;

  /** Generate type hints */
  typeHints: boolean;

  /** Generate docstrings */
  docstrings: boolean;

  /** Docstring style */
  docstringStyle: 'google' | 'numpy' | 'sphinx';

  /** Generate tests */
  generateTests: boolean;

  /** Test framework */
  testFramework: 'pytest' | 'unittest';

  /** Generate OpenAPI schema */
  generateOpenAPI: boolean;

  /** Generate Alembic migrations */
  generateMigrations: boolean;

  /** Use strict mode for Pydantic */
  strictMode: boolean;

  /** Custom type mappings */
  typeMappings?: Record<string, string>;
}

/**
 * Default options
 */
export const DEFAULT_OPTIONS: PythonGeneratorOptions = {
  framework: 'fastapi',
  orm: 'sqlalchemy',
  validation: 'pydantic',
  asyncRuntime: 'asyncio',
  useAsync: true,
  pythonVersion: '3.12',
  outputDir: './generated',
  packageName: 'generated',
  typeHints: true,
  docstrings: true,
  docstringStyle: 'google',
  generateTests: true,
  testFramework: 'pytest',
  generateOpenAPI: true,
  generateMigrations: true,
  strictMode: true,
};

/**
 * Generated file
 */
export interface GeneratedFile {
  path: string;
  content: string;
  type: 'model' | 'schema' | 'router' | 'service' | 'repository' | 'test' | 'config' | 'migration';
}

/**
 * Generation result
 */
export interface GenerationResult {
  files: GeneratedFile[];
  requirements: string[];
  warnings: string[];
  statistics: {
    models: number;
    schemas: number;
    routers: number;
    services: number;
    tests: number;
    totalLines: number;
  };
}

/**
 * Python type info
 */
export interface PythonTypeInfo {
  name: string;
  module?: string;
  isOptional: boolean;
  isList: boolean;
  isDict: boolean;
  genericArgs?: PythonTypeInfo[];
  defaultValue?: string;
}

/**
 * Python field info
 */
export interface PythonFieldInfo {
  name: string;
  type: PythonTypeInfo;
  required: boolean;
  defaultValue?: string;
  description?: string;
  constraints?: PythonConstraint[];
  alias?: string;
}

/**
 * Python constraint
 */
export interface PythonConstraint {
  type: 'min' | 'max' | 'minLength' | 'maxLength' | 'pattern' | 'email' | 'url' | 'custom';
  value?: string | number;
  message?: string;
}

/**
 * Python class info
 */
export interface PythonClassInfo {
  name: string;
  baseClasses: string[];
  fields: PythonFieldInfo[];
  methods: PythonMethodInfo[];
  decorators: string[];
  docstring?: string;
  imports: PythonImport[];
}

/**
 * Python method info
 */
export interface PythonMethodInfo {
  name: string;
  parameters: PythonParameterInfo[];
  returnType: PythonTypeInfo;
  isAsync: boolean;
  isClassMethod: boolean;
  isStaticMethod: boolean;
  decorators: string[];
  docstring?: string;
  body?: string;
}

/**
 * Python parameter info
 */
export interface PythonParameterInfo {
  name: string;
  type: PythonTypeInfo;
  default?: string;
  isKeywordOnly: boolean;
  isPositionalOnly: boolean;
}

/**
 * Python import
 */
export interface PythonImport {
  module: string;
  names?: string[];
  alias?: string;
  isFrom: boolean;
}

/**
 * ISL to Python type mapping
 */
export const ISL_TO_PYTHON_TYPES: Record<string, string> = {
  'String': 'str',
  'Int': 'int',
  'Float': 'float',
  'Boolean': 'bool',
  'DateTime': 'datetime',
  'Date': 'date',
  'Time': 'time',
  'UUID': 'UUID',
  'Decimal': 'Decimal',
  'Money': 'Decimal',
  'Email': 'EmailStr',
  'URL': 'HttpUrl',
  'Phone': 'str',
  'JSON': 'dict[str, Any]',
  'Binary': 'bytes',
  'Void': 'None',
  'Any': 'Any',
};
