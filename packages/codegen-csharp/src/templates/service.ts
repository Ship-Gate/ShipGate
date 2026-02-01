// ============================================================================
// C# Service Templates
// ============================================================================

import type { CSharpClassInfo, CSharpMethodInfo, CSharpGeneratorOptions } from '../types';
import { generateUsings, generateXmlDoc, generateAttributes } from './model';

/**
 * Generate service interface
 */
export function generateServiceInterface(
  model: CSharpClassInfo,
  options: CSharpGeneratorOptions
): string {
  const interfaceName = `I${model.name}Service`;
  const parts: string[] = [];

  // Usings
  const usings = [
    model.namespace,
  ];
  parts.push(generateUsings(usings) + '\n');

  // Namespace
  parts.push(`namespace ${model.namespace}.Services;\n`);

  // XML documentation
  if (options.generateXmlDocs) {
    parts.push(generateXmlDoc(`Service interface for ${model.name} operations`));
  }

  // Interface declaration
  parts.push(`public interface ${interfaceName}`);
  parts.push('{');

  // CRUD methods
  const methods = generateCrudMethodSignatures(model.name, options);
  for (const method of methods) {
    if (options.generateXmlDocs && method.doc) {
      parts.push(generateXmlDoc(method.doc, '    '));
    }
    parts.push(`    ${method.signature}\n`);
  }

  parts.push('}');

  return parts.join('\n');
}

/**
 * Generate service implementation
 */
export function generateServiceImplementation(
  model: CSharpClassInfo,
  options: CSharpGeneratorOptions
): string {
  const serviceName = `${model.name}Service`;
  const interfaceName = `I${model.name}Service`;
  const repositoryName = `I${model.name}Repository`;
  const parts: string[] = [];

  // Usings
  const usings = [
    'Microsoft.Extensions.Logging',
    model.namespace,
    `${model.namespace}.Repositories`,
  ];
  
  if (options.validation === 'fluent-validation' || options.validation === 'both') {
    usings.push('FluentValidation');
  }
  
  parts.push(generateUsings(usings) + '\n');

  // Namespace
  parts.push(`namespace ${model.namespace}.Services;\n`);

  // XML documentation
  if (options.generateXmlDocs) {
    parts.push(generateXmlDoc(`Service implementation for ${model.name} operations`));
  }

  // Class declaration
  parts.push(`public class ${serviceName} : ${interfaceName}`);
  parts.push('{');

  // Fields
  parts.push(`    private readonly ${repositoryName} _repository;`);
  parts.push(`    private readonly ILogger<${serviceName}> _logger;`);
  
  if (options.validation === 'fluent-validation' || options.validation === 'both') {
    parts.push(`    private readonly IValidator<${model.name}> _validator;`);
  }
  parts.push('');

  // Constructor
  parts.push(generateServiceConstructor(model.name, options));
  parts.push('');

  // CRUD methods
  parts.push(generateGetAllMethod(model.name, options));
  parts.push('');
  parts.push(generateGetByIdMethod(model.name, options));
  parts.push('');
  parts.push(generateCreateMethod(model.name, options));
  parts.push('');
  parts.push(generateUpdateMethod(model.name, options));
  parts.push('');
  parts.push(generateDeleteMethod(model.name, options));

  parts.push('}');

  return parts.join('\n');
}

/**
 * Generate CRUD method signatures
 */
function generateCrudMethodSignatures(
  modelName: string,
  options: CSharpGeneratorOptions
): Array<{ signature: string; doc?: string }> {
  const async_ = options.asyncMethods;
  const ct = async_ ? ', CancellationToken cancellationToken = default' : '';
  
  return [
    {
      signature: `${async_ ? 'Task<IEnumerable<' + modelName + '>>' : 'IEnumerable<' + modelName + '>'} GetAllAsync(${ct.slice(2)});`,
      doc: `Get all ${modelName} entities`,
    },
    {
      signature: `${async_ ? 'Task<' + modelName + '?>' : modelName + '?'} GetByIdAsync(Guid id${ct});`,
      doc: `Get a ${modelName} by ID`,
    },
    {
      signature: `${async_ ? 'Task<' + modelName + '>' : modelName} CreateAsync(${modelName} entity${ct});`,
      doc: `Create a new ${modelName}`,
    },
    {
      signature: `${async_ ? 'Task<' + modelName + '?>' : modelName + '?'} UpdateAsync(Guid id, ${modelName} entity${ct});`,
      doc: `Update an existing ${modelName}`,
    },
    {
      signature: `${async_ ? 'Task<bool>' : 'bool'} DeleteAsync(Guid id${ct});`,
      doc: `Delete a ${modelName} by ID`,
    },
  ];
}

/**
 * Generate service constructor
 */
function generateServiceConstructor(
  modelName: string,
  options: CSharpGeneratorOptions
): string {
  const serviceName = `${modelName}Service`;
  const repositoryName = `I${modelName}Repository`;
  const parts: string[] = [];

  const params: string[] = [
    `${repositoryName} repository`,
    `ILogger<${serviceName}> logger`,
  ];
  
  if (options.validation === 'fluent-validation' || options.validation === 'both') {
    params.push(`IValidator<${modelName}> validator`);
  }

  parts.push(`    public ${serviceName}(`);
  parts.push(`        ${params.join(',\n        ')})`);
  parts.push('    {');
  parts.push('        _repository = repository;');
  parts.push('        _logger = logger;');
  
  if (options.validation === 'fluent-validation' || options.validation === 'both') {
    parts.push('        _validator = validator;');
  }
  
  parts.push('    }');

  return parts.join('\n');
}

/**
 * Generate GetAll method
 */
function generateGetAllMethod(modelName: string, options: CSharpGeneratorOptions): string {
  const async_ = options.asyncMethods;
  const indent = '    ';

  return `${indent}public ${async_ ? 'async Task<IEnumerable<' + modelName + '>>' : 'IEnumerable<' + modelName + '>'} GetAllAsync(${async_ ? 'CancellationToken cancellationToken = default' : ''})
${indent}{
${indent}    _logger.LogDebug("Getting all ${modelName} entities");
${indent}    return ${async_ ? 'await ' : ''}_repository.GetAllAsync(${async_ ? 'cancellationToken' : ''});
${indent}}`;
}

/**
 * Generate GetById method
 */
function generateGetByIdMethod(modelName: string, options: CSharpGeneratorOptions): string {
  const async_ = options.asyncMethods;
  const indent = '    ';
  const ct = async_ ? ', CancellationToken cancellationToken = default' : '';
  const ctArg = async_ ? ', cancellationToken' : '';

  return `${indent}public ${async_ ? 'async Task<' + modelName + '?>' : modelName + '?'} GetByIdAsync(Guid id${ct})
${indent}{
${indent}    _logger.LogDebug("Getting ${modelName} with ID {Id}", id);
${indent}    return ${async_ ? 'await ' : ''}_repository.GetByIdAsync(id${ctArg});
${indent}}`;
}

/**
 * Generate Create method
 */
function generateCreateMethod(modelName: string, options: CSharpGeneratorOptions): string {
  const async_ = options.asyncMethods;
  const hasValidation = options.validation === 'fluent-validation' || options.validation === 'both';
  const indent = '    ';
  const ct = async_ ? ', CancellationToken cancellationToken = default' : '';
  const ctArg = async_ ? ', cancellationToken' : '';

  let body = `${indent}    _logger.LogInformation("Creating new ${modelName}");`;
  
  if (hasValidation) {
    body += `
${indent}    ${async_ ? 'await ' : ''}_validator.ValidateAndThrowAsync(entity${ctArg});`;
  }
  
  body += `
${indent}    var result = ${async_ ? 'await ' : ''}_repository.CreateAsync(entity${ctArg});
${indent}    _logger.LogInformation("Created ${modelName} with ID {Id}", result.Id);
${indent}    return result;`;

  return `${indent}public ${async_ ? 'async Task<' + modelName + '>' : modelName} CreateAsync(${modelName} entity${ct})
${indent}{
${body}
${indent}}`;
}

/**
 * Generate Update method
 */
function generateUpdateMethod(modelName: string, options: CSharpGeneratorOptions): string {
  const async_ = options.asyncMethods;
  const hasValidation = options.validation === 'fluent-validation' || options.validation === 'both';
  const indent = '    ';
  const ct = async_ ? ', CancellationToken cancellationToken = default' : '';
  const ctArg = async_ ? ', cancellationToken' : '';

  let body = `${indent}    _logger.LogInformation("Updating ${modelName} with ID {Id}", id);
${indent}    
${indent}    var existing = ${async_ ? 'await ' : ''}_repository.GetByIdAsync(id${ctArg});
${indent}    if (existing == null)
${indent}    {
${indent}        _logger.LogWarning("${modelName} with ID {Id} not found", id);
${indent}        return null;
${indent}    }`;
  
  if (hasValidation) {
    body += `
${indent}    
${indent}    ${async_ ? 'await ' : ''}_validator.ValidateAndThrowAsync(entity${ctArg});`;
  }
  
  body += `
${indent}    
${indent}    var result = ${async_ ? 'await ' : ''}_repository.UpdateAsync(entity${ctArg});
${indent}    _logger.LogInformation("Updated ${modelName} with ID {Id}", id);
${indent}    return result;`;

  return `${indent}public ${async_ ? 'async Task<' + modelName + '?>' : modelName + '?'} UpdateAsync(Guid id, ${modelName} entity${ct})
${indent}{
${body}
${indent}}`;
}

/**
 * Generate Delete method
 */
function generateDeleteMethod(modelName: string, options: CSharpGeneratorOptions): string {
  const async_ = options.asyncMethods;
  const indent = '    ';
  const ct = async_ ? ', CancellationToken cancellationToken = default' : '';
  const ctArg = async_ ? ', cancellationToken' : '';

  return `${indent}public ${async_ ? 'async Task<bool>' : 'bool'} DeleteAsync(Guid id${ct})
${indent}{
${indent}    _logger.LogInformation("Deleting ${modelName} with ID {Id}", id);
${indent}    
${indent}    var existing = ${async_ ? 'await ' : ''}_repository.GetByIdAsync(id${ctArg});
${indent}    if (existing == null)
${indent}    {
${indent}        _logger.LogWarning("${modelName} with ID {Id} not found for deletion", id);
${indent}        return false;
${indent}    }
${indent}    
${indent}    ${async_ ? 'await ' : ''}_repository.DeleteAsync(id${ctArg});
${indent}    _logger.LogInformation("Deleted ${modelName} with ID {Id}", id);
${indent}    return true;
${indent}}`;
}

/**
 * Generate service DI extension
 */
export function generateServiceDIExtension(
  models: CSharpClassInfo[],
  options: CSharpGeneratorOptions
): string {
  const parts: string[] = [];

  // Usings
  const usings = [
    'Microsoft.Extensions.DependencyInjection',
    `${options.namespace}.Services`,
  ];
  parts.push(generateUsings(usings) + '\n');

  // Namespace
  parts.push(`namespace ${options.namespace}.Extensions;\n`);

  // Class
  parts.push('public static class ServiceExtensions');
  parts.push('{');
  parts.push('    public static IServiceCollection AddServices(this IServiceCollection services)');
  parts.push('    {');

  for (const model of models) {
    parts.push(`        services.AddScoped<I${model.name}Service, ${model.name}Service>();`);
  }

  parts.push('        return services;');
  parts.push('    }');
  parts.push('}');

  return parts.join('\n');
}
