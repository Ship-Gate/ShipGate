// ============================================================================
// C# Code Generator
// ============================================================================

import type {
  CSharpGeneratorOptions,
  CSharpClassInfo,
  CSharpPropertyInfo,
  CSharpTypeInfo,
  GeneratedFile,
  GenerationResult,
} from './types';
import { DEFAULT_OPTIONS, ISL_TO_CSHARP_TYPES } from './types';
import { generateModel } from './templates/model';
import { generateFluentValidator, generateValidatorDIExtension } from './templates/validator';
import { generateController, generateMinimalApiEndpoints } from './templates/controller';
import { generateServiceInterface, generateServiceImplementation, generateServiceDIExtension } from './templates/service';
import { generateRepositoryInterface, generateEFRepository, generateDbContext, generateRepositoryDIExtension } from './templates/repository';

/**
 * ISL AST types (simplified for this implementation)
 */
interface ISLEntity {
  name: string;
  properties: ISLProperty[];
  behaviors?: ISLBehavior[];
  invariants?: string[];
  description?: string;
}

interface ISLProperty {
  name: string;
  type: string;
  required?: boolean;
  description?: string;
  constraints?: string[];
}

interface ISLBehavior {
  name: string;
  preconditions?: string[];
  postconditions?: string[];
  input?: ISLProperty[];
  output?: string;
}

interface ISLDomain {
  name: string;
  entities: ISLEntity[];
  behaviors?: ISLBehavior[];
}

/**
 * Generate C# code from ISL domain
 */
export function generate(
  domain: ISLDomain,
  options: Partial<CSharpGeneratorOptions> = {}
): GenerationResult {
  const mergedOptions: CSharpGeneratorOptions = {
    ...DEFAULT_OPTIONS,
    ...options,
    namespace: options.namespace || `${domain.name}.Generated`,
  };

  const files: GeneratedFile[] = [];
  const warnings: string[] = [];
  const statistics = {
    models: 0,
    services: 0,
    controllers: 0,
    validators: 0,
    tests: 0,
    totalLines: 0,
  };

  // Convert ISL entities to C# class info
  const models = domain.entities.map((entity) => convertEntityToClass(entity, mergedOptions));

  // Generate models
  for (const model of models) {
    const content = generateModel(model, mergedOptions);
    files.push({
      path: `Models/${model.name}.cs`,
      content,
      type: 'model',
    });
    statistics.models++;
    statistics.totalLines += content.split('\n').length;
  }

  // Generate validators
  if (mergedOptions.validation === 'fluent-validation' || mergedOptions.validation === 'both') {
    for (const model of models) {
      const content = generateFluentValidator(model, mergedOptions);
      files.push({
        path: `Validators/${model.name}Validator.cs`,
        content,
        type: 'validator',
      });
      statistics.validators++;
      statistics.totalLines += content.split('\n').length;
    }

    // Validator DI extension
    const validatorExtension = generateValidatorDIExtension(models, mergedOptions);
    files.push({
      path: 'Extensions/ValidatorExtensions.cs',
      content: validatorExtension,
      type: 'config',
    });
    statistics.totalLines += validatorExtension.split('\n').length;
  }

  // Generate repositories
  if (mergedOptions.orm !== 'none') {
    for (const model of models) {
      // Interface
      const interfaceContent = generateRepositoryInterface(model, mergedOptions);
      files.push({
        path: `Repositories/I${model.name}Repository.cs`,
        content: interfaceContent,
        type: 'repository',
      });

      // Implementation
      if (mergedOptions.orm === 'entity-framework') {
        const implContent = generateEFRepository(model, mergedOptions);
        files.push({
          path: `Repositories/${model.name}Repository.cs`,
          content: implContent,
          type: 'repository',
        });
      }

      statistics.totalLines += interfaceContent.split('\n').length;
    }

    // DbContext
    if (mergedOptions.orm === 'entity-framework') {
      const dbContext = generateDbContext(models, mergedOptions);
      files.push({
        path: 'Data/DbContext.cs',
        content: dbContext,
        type: 'config',
      });
      statistics.totalLines += dbContext.split('\n').length;
    }

    // Repository DI extension
    const repoExtension = generateRepositoryDIExtension(models, mergedOptions);
    files.push({
      path: 'Extensions/RepositoryExtensions.cs',
      content: repoExtension,
      type: 'config',
    });
    statistics.totalLines += repoExtension.split('\n').length;
  }

  // Generate services
  for (const model of models) {
    // Interface
    const interfaceContent = generateServiceInterface(model, mergedOptions);
    files.push({
      path: `Services/I${model.name}Service.cs`,
      content: interfaceContent,
      type: 'service',
    });

    // Implementation
    const implContent = generateServiceImplementation(model, mergedOptions);
    files.push({
      path: `Services/${model.name}Service.cs`,
      content: implContent,
      type: 'service',
    });

    statistics.services += 2;
    statistics.totalLines += interfaceContent.split('\n').length + implContent.split('\n').length;
  }

  // Service DI extension
  const serviceExtension = generateServiceDIExtension(models, mergedOptions);
  files.push({
    path: 'Extensions/ServiceExtensions.cs',
    content: serviceExtension,
    type: 'config',
  });
  statistics.totalLines += serviceExtension.split('\n').length;

  // Generate controllers/endpoints
  if (mergedOptions.webFramework !== 'none') {
    for (const model of models) {
      const endpoints = generateDefaultEndpoints(model.name);

      if (mergedOptions.webFramework === 'aspnet-minimal') {
        const content = generateMinimalApiEndpoints(model, endpoints, mergedOptions);
        files.push({
          path: `Endpoints/${model.name}Endpoints.cs`,
          content,
          type: 'controller',
        });
        statistics.controllers++;
        statistics.totalLines += content.split('\n').length;
      } else if (mergedOptions.webFramework === 'aspnet-core') {
        const content = generateController(model, endpoints, mergedOptions);
        files.push({
          path: `Controllers/${model.name}Controller.cs`,
          content,
          type: 'controller',
        });
        statistics.controllers++;
        statistics.totalLines += content.split('\n').length;
      }
    }
  }

  // Generate project file
  const projectFile = generateProjectFile(mergedOptions);

  return {
    files,
    projectFile,
    warnings,
    statistics,
  };
}

/**
 * Convert ISL entity to C# class info
 */
function convertEntityToClass(
  entity: ISLEntity,
  options: CSharpGeneratorOptions
): CSharpClassInfo {
  const properties: CSharpPropertyInfo[] = [
    // Always add an Id property
    {
      name: 'Id',
      type: {
        name: 'Guid',
        namespace: 'System',
        fullName: 'System.Guid',
        isNullable: false,
        isCollection: false,
        attributes: [],
      },
      isRequired: true,
      isReadOnly: false,
      attributes: ['Key'],
      xmlDoc: 'Unique identifier',
    },
    // Add CreatedAt
    {
      name: 'CreatedAt',
      type: {
        name: 'DateTimeOffset',
        namespace: 'System',
        fullName: 'System.DateTimeOffset',
        isNullable: false,
        isCollection: false,
        attributes: [],
      },
      isRequired: true,
      isReadOnly: false,
      defaultValue: 'DateTimeOffset.UtcNow',
      attributes: [],
      xmlDoc: 'Creation timestamp',
    },
    // Add UpdatedAt
    {
      name: 'UpdatedAt',
      type: {
        name: 'DateTimeOffset',
        namespace: 'System',
        fullName: 'System.DateTimeOffset',
        isNullable: true,
        isCollection: false,
        attributes: [],
      },
      isRequired: false,
      isReadOnly: false,
      attributes: [],
      xmlDoc: 'Last update timestamp',
    },
    // Entity properties
    ...entity.properties.map((prop) => convertPropertyToCSProperty(prop, options)),
  ];

  return {
    name: entity.name,
    namespace: options.namespace,
    isRecord: options.useRecords,
    isAbstract: false,
    isSealed: false,
    isPartial: true,
    interfaces: [],
    properties,
    methods: [],
    attributes: [],
    xmlDoc: entity.description,
    usings: ['System', 'System.ComponentModel.DataAnnotations'],
  };
}

/**
 * Convert ISL property to C# property
 */
function convertPropertyToCSProperty(
  prop: ISLProperty,
  options: CSharpGeneratorOptions
): CSharpPropertyInfo {
  const type = convertType(prop.type, options);
  const attrs: string[] = [];

  // Add JSON property name if different
  const jsonName = camelCase(prop.name);
  if (jsonName !== prop.name) {
    if (options.serialization === 'system-text-json' || options.serialization === 'both') {
      attrs.push(`JsonPropertyName("${jsonName}")`);
    }
    if (options.serialization === 'newtonsoft' || options.serialization === 'both') {
      attrs.push(`JsonProperty("${jsonName}")`);
    }
  }

  return {
    name: pascalCase(prop.name),
    type,
    isRequired: prop.required ?? false,
    isReadOnly: false,
    attributes: attrs,
    xmlDoc: prop.description,
    jsonName,
  };
}

/**
 * Convert ISL type to C# type
 */
function convertType(
  islType: string,
  options: CSharpGeneratorOptions
): CSharpTypeInfo {
  // Check custom mappings
  if (options.typeMappings && options.typeMappings[islType]) {
    return {
      name: options.typeMappings[islType],
      namespace: '',
      fullName: options.typeMappings[islType],
      isNullable: false,
      isCollection: false,
      attributes: [],
    };
  }

  // Check for array/list types
  if (islType.endsWith('[]')) {
    const innerType = islType.slice(0, -2);
    const inner = convertType(innerType, options);
    return {
      name: `List<${inner.name}>`,
      namespace: 'System.Collections.Generic',
      fullName: `System.Collections.Generic.List<${inner.fullName}>`,
      isNullable: false,
      isCollection: true,
      collectionType: 'List',
      genericArgs: [inner],
      attributes: [],
    };
  }

  // Check for optional types
  if (islType.endsWith('?')) {
    const innerType = islType.slice(0, -1);
    const inner = convertType(innerType, options);
    return {
      ...inner,
      isNullable: true,
    };
  }

  // Map ISL type to C#
  const csType = ISL_TO_CSHARP_TYPES[islType] || islType;

  return {
    name: csType,
    namespace: getTypeNamespace(csType),
    fullName: `${getTypeNamespace(csType)}.${csType}`.replace(/^\./, ''),
    isNullable: false,
    isCollection: false,
    attributes: [],
  };
}

/**
 * Get namespace for a C# type
 */
function getTypeNamespace(type: string): string {
  const systemTypes = ['string', 'int', 'long', 'double', 'float', 'decimal', 'bool', 'byte', 'char', 'object', 'void'];
  if (systemTypes.includes(type)) return 'System';
  
  if (['Guid', 'DateTime', 'DateTimeOffset', 'DateOnly', 'TimeOnly', 'TimeSpan'].includes(type)) {
    return 'System';
  }
  
  if (['Uri'].includes(type)) return 'System';
  if (['JsonElement'].includes(type)) return 'System.Text.Json';
  
  return '';
}

/**
 * Generate default CRUD endpoints
 */
function generateDefaultEndpoints(modelName: string): Array<{
  name: string;
  httpMethod: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  route: string;
  requestType?: string;
  responseType: string;
  isAsync: boolean;
  description?: string;
}> {
  return [
    {
      name: 'GetAll',
      httpMethod: 'GET',
      route: '',
      responseType: `IEnumerable<${modelName}>`,
      isAsync: true,
      description: `Get all ${modelName} entities`,
    },
    {
      name: 'GetById',
      httpMethod: 'GET',
      route: '{id}',
      responseType: modelName,
      isAsync: true,
      description: `Get a ${modelName} by ID`,
    },
    {
      name: 'Create',
      httpMethod: 'POST',
      route: '',
      requestType: modelName,
      responseType: modelName,
      isAsync: true,
      description: `Create a new ${modelName}`,
    },
    {
      name: 'Update',
      httpMethod: 'PUT',
      route: '{id}',
      requestType: modelName,
      responseType: modelName,
      isAsync: true,
      description: `Update an existing ${modelName}`,
    },
    {
      name: 'Delete',
      httpMethod: 'DELETE',
      route: '{id}',
      responseType: 'bool',
      isAsync: true,
      description: `Delete a ${modelName}`,
    },
  ];
}

/**
 * Generate .csproj file
 */
function generateProjectFile(options: CSharpGeneratorOptions): string {
  const packages: Array<{ name: string; version: string }> = [];

  // Add packages based on options
  if (options.webFramework !== 'none') {
    packages.push({ name: 'Swashbuckle.AspNetCore', version: '6.5.0' });
  }

  if (options.orm === 'entity-framework') {
    packages.push({ name: 'Microsoft.EntityFrameworkCore', version: '8.0.0' });
    packages.push({ name: 'Microsoft.EntityFrameworkCore.SqlServer', version: '8.0.0' });
    packages.push({ name: 'Microsoft.EntityFrameworkCore.Design', version: '8.0.0' });
  }

  if (options.validation === 'fluent-validation' || options.validation === 'both') {
    packages.push({ name: 'FluentValidation', version: '11.9.0' });
    packages.push({ name: 'FluentValidation.AspNetCore', version: '11.3.0' });
  }

  if (options.serialization === 'newtonsoft' || options.serialization === 'both') {
    packages.push({ name: 'Newtonsoft.Json', version: '13.0.3' });
  }

  const packageRefs = packages
    .map((p) => `    <PackageReference Include="${p.name}" Version="${p.version}" />`)
    .join('\n');

  return `<Project Sdk="Microsoft.NET.Sdk.Web">

  <PropertyGroup>
    <TargetFramework>${options.framework}</TargetFramework>
    <Nullable>${options.nullableReferenceTypes ? 'enable' : 'disable'}</Nullable>
    <ImplicitUsings>enable</ImplicitUsings>
    <RootNamespace>${options.namespace}</RootNamespace>
  </PropertyGroup>

  <ItemGroup>
${packageRefs}
  </ItemGroup>

</Project>`;
}

/**
 * Convert string to PascalCase
 */
function pascalCase(str: string): string {
  return str
    .replace(/[-_](.)/g, (_, c) => c.toUpperCase())
    .replace(/^(.)/, (_, c) => c.toUpperCase());
}

/**
 * Convert string to camelCase
 */
function camelCase(str: string): string {
  const pascal = pascalCase(str);
  return pascal.charAt(0).toLowerCase() + pascal.slice(1);
}

/**
 * Generate all files to the output directory
 */
export async function generateToDirectory(
  domain: ISLDomain,
  options: Partial<CSharpGeneratorOptions> = {}
): Promise<GenerationResult> {
  const result = generate(domain, options);
  
  // In a real implementation, this would write files to disk
  // For now, we just return the result
  
  return result;
}
