// ============================================================================
// C# Code Generation Types
// ============================================================================

/**
 * Target .NET framework
 */
export type DotNetFramework =
  | 'net6.0'
  | 'net7.0'
  | 'net8.0'
  | 'netstandard2.0'
  | 'netstandard2.1';

/**
 * Target web framework
 */
export type WebFramework =
  | 'aspnet-core'
  | 'aspnet-minimal'
  | 'blazor'
  | 'maui'
  | 'none';

/**
 * ORM framework
 */
export type ORMFramework =
  | 'entity-framework'
  | 'dapper'
  | 'linq2db'
  | 'none';

/**
 * Validation library
 */
export type ValidationLibrary =
  | 'fluent-validation'
  | 'data-annotations'
  | 'both'
  | 'none';

/**
 * Serialization format
 */
export type SerializationFormat =
  | 'system-text-json'
  | 'newtonsoft'
  | 'both';

/**
 * Generation options
 */
export interface CSharpGeneratorOptions {
  /** Target .NET framework */
  framework: DotNetFramework;

  /** Web framework */
  webFramework: WebFramework;

  /** ORM framework */
  orm: ORMFramework;

  /** Validation library */
  validation: ValidationLibrary;

  /** Serialization format */
  serialization: SerializationFormat;

  /** Root namespace */
  namespace: string;

  /** Generate nullable reference types */
  nullableReferenceTypes: boolean;

  /** Generate record types instead of classes */
  useRecords: boolean;

  /** Generate init-only properties */
  useInitOnlySetters: boolean;

  /** Generate XML documentation */
  generateXmlDocs: boolean;

  /** Generate unit tests */
  generateTests: boolean;

  /** Test framework */
  testFramework: 'xunit' | 'nunit' | 'mstest';

  /** Output directory */
  outputDir: string;

  /** File naming convention */
  fileNaming: 'pascal-case' | 'kebab-case';

  /** Generate async methods */
  asyncMethods: boolean;

  /** Generate dependency injection extensions */
  generateDI: boolean;

  /** Generate OpenAPI attributes */
  generateOpenApiAttributes: boolean;

  /** Custom type mappings */
  typeMappings?: Record<string, string>;
}

/**
 * Default options
 */
export const DEFAULT_OPTIONS: CSharpGeneratorOptions = {
  framework: 'net8.0',
  webFramework: 'aspnet-minimal',
  orm: 'entity-framework',
  validation: 'fluent-validation',
  serialization: 'system-text-json',
  namespace: 'Generated',
  nullableReferenceTypes: true,
  useRecords: true,
  useInitOnlySetters: true,
  generateXmlDocs: true,
  generateTests: true,
  testFramework: 'xunit',
  outputDir: './generated',
  fileNaming: 'pascal-case',
  asyncMethods: true,
  generateDI: true,
  generateOpenApiAttributes: true,
};

/**
 * Generated file
 */
export interface GeneratedFile {
  path: string;
  content: string;
  type: 'model' | 'service' | 'controller' | 'validator' | 'repository' | 'test' | 'config';
}

/**
 * Generation result
 */
export interface GenerationResult {
  files: GeneratedFile[];
  projectFile: string;
  solutionFile?: string;
  warnings: string[];
  statistics: {
    models: number;
    services: number;
    controllers: number;
    validators: number;
    tests: number;
    totalLines: number;
  };
}

/**
 * C# type info
 */
export interface CSharpTypeInfo {
  name: string;
  namespace: string;
  fullName: string;
  isNullable: boolean;
  isCollection: boolean;
  collectionType?: 'List' | 'IEnumerable' | 'ICollection' | 'Array';
  genericArgs?: CSharpTypeInfo[];
  attributes: string[];
}

/**
 * C# property info
 */
export interface CSharpPropertyInfo {
  name: string;
  type: CSharpTypeInfo;
  isRequired: boolean;
  isReadOnly: boolean;
  defaultValue?: string;
  attributes: string[];
  xmlDoc?: string;
  jsonName?: string;
}

/**
 * C# method info
 */
export interface CSharpMethodInfo {
  name: string;
  returnType: CSharpTypeInfo;
  parameters: CSharpParameterInfo[];
  isAsync: boolean;
  isStatic: boolean;
  accessibility: 'public' | 'private' | 'protected' | 'internal';
  attributes: string[];
  xmlDoc?: string;
  body?: string;
}

/**
 * C# parameter info
 */
export interface CSharpParameterInfo {
  name: string;
  type: CSharpTypeInfo;
  isOptional: boolean;
  defaultValue?: string;
  attributes: string[];
}

/**
 * C# class info
 */
export interface CSharpClassInfo {
  name: string;
  namespace: string;
  isRecord: boolean;
  isAbstract: boolean;
  isSealed: boolean;
  isPartial: boolean;
  baseClass?: string;
  interfaces: string[];
  properties: CSharpPropertyInfo[];
  methods: CSharpMethodInfo[];
  attributes: string[];
  xmlDoc?: string;
  usings: string[];
}

/**
 * ISL to C# type mapping
 */
export const ISL_TO_CSHARP_TYPES: Record<string, string> = {
  'String': 'string',
  'Int': 'int',
  'Float': 'double',
  'Boolean': 'bool',
  'DateTime': 'DateTimeOffset',
  'Date': 'DateOnly',
  'Time': 'TimeOnly',
  'UUID': 'Guid',
  'Decimal': 'decimal',
  'Money': 'decimal',
  'Email': 'string',
  'URL': 'Uri',
  'Phone': 'string',
  'JSON': 'JsonElement',
  'Binary': 'byte[]',
  'Void': 'void',
  'Any': 'object',
};
