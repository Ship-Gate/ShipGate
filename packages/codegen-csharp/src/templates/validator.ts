// ============================================================================
// C# Validator Templates
// ============================================================================

import type { CSharpClassInfo, CSharpPropertyInfo, CSharpGeneratorOptions } from '../types';
import { generateUsings, generateXmlDoc, generateAttributes } from './model';

/**
 * FluentValidation rule info
 */
interface ValidationRule {
  property: string;
  rules: string[];
}

/**
 * Generate FluentValidation validator
 */
export function generateFluentValidator(
  model: CSharpClassInfo,
  options: CSharpGeneratorOptions
): string {
  const validatorName = `${model.name}Validator`;
  const parts: string[] = [];

  // Usings
  const usings = [
    'FluentValidation',
    model.namespace,
  ];
  parts.push(generateUsings(usings) + '\n');

  // Namespace
  parts.push(`namespace ${model.namespace}.Validators;\n`);

  // XML documentation
  if (options.generateXmlDocs) {
    parts.push(generateXmlDoc(`Validator for ${model.name}`));
  }

  // Class declaration
  parts.push(`public class ${validatorName} : AbstractValidator<${model.name}>`);
  parts.push('{');
  parts.push(`    public ${validatorName}()`);
  parts.push('    {');

  // Generate rules for each property
  for (const prop of model.properties) {
    const rules = generatePropertyRules(prop);
    if (rules.length > 0) {
      parts.push(`        RuleFor(x => x.${prop.name})`);
      for (let i = 0; i < rules.length; i++) {
        const isLast = i === rules.length - 1;
        parts.push(`            ${rules[i]}${isLast ? ';' : ''}`);
      }
      parts.push('');
    }
  }

  parts.push('    }');
  parts.push('}');

  return parts.join('\n');
}

/**
 * Generate validation rules for a property
 */
function generatePropertyRules(prop: CSharpPropertyInfo): string[] {
  const rules: string[] = [];

  // Required check
  if (prop.isRequired) {
    rules.push('.NotEmpty()');
  }

  // Type-specific rules
  const typeName = prop.type.name.toLowerCase();

  if (typeName === 'string') {
    // Check for email pattern in name
    if (prop.name.toLowerCase().includes('email')) {
      rules.push('.EmailAddress()');
    }
    
    // Check for URL pattern
    if (prop.name.toLowerCase().includes('url') || prop.name.toLowerCase().includes('uri')) {
      rules.push('.Must(BeAValidUri).WithMessage("Must be a valid URI")');
    }

    // Check for phone
    if (prop.name.toLowerCase().includes('phone')) {
      rules.push('.Matches(@"^\\+?[1-9]\\d{1,14}$").WithMessage("Must be a valid phone number")');
    }
  }

  // Numeric ranges
  if (['int', 'long', 'decimal', 'double', 'float'].includes(typeName)) {
    if (prop.name.toLowerCase().includes('age')) {
      rules.push('.InclusiveBetween(0, 150)');
    }
    if (prop.name.toLowerCase().includes('price') || prop.name.toLowerCase().includes('amount')) {
      rules.push('.GreaterThanOrEqualTo(0)');
    }
    if (prop.name.toLowerCase().includes('quantity')) {
      rules.push('.GreaterThan(0)');
    }
  }

  // GUID validation
  if (typeName === 'guid') {
    if (prop.isRequired) {
      rules.push('.NotEqual(Guid.Empty)');
    }
  }

  // Date validation
  if (typeName.includes('date') || typeName.includes('datetime')) {
    if (prop.name.toLowerCase().includes('birth')) {
      rules.push('.LessThanOrEqualTo(DateTimeOffset.UtcNow)');
    }
    if (prop.name.toLowerCase().includes('expir')) {
      rules.push('.GreaterThan(DateTimeOffset.UtcNow)');
    }
  }

  // Collection validation
  if (prop.type.isCollection) {
    if (prop.isRequired) {
      rules.push('.NotEmpty()');
    }
  }

  return rules;
}

/**
 * Generate Data Annotations for a model
 */
export function generateDataAnnotations(prop: CSharpPropertyInfo): string[] {
  const attrs: string[] = [];

  // Required
  if (prop.isRequired) {
    attrs.push('Required');
  }

  const typeName = prop.type.name.toLowerCase();

  // String validations
  if (typeName === 'string') {
    if (prop.name.toLowerCase().includes('email')) {
      attrs.push('EmailAddress');
    }
    if (prop.name.toLowerCase().includes('url')) {
      attrs.push('Url');
    }
    if (prop.name.toLowerCase().includes('phone')) {
      attrs.push('Phone');
    }
    // Default max length for strings
    attrs.push('StringLength(500)');
  }

  // Range validations
  if (['int', 'long'].includes(typeName)) {
    if (prop.name.toLowerCase().includes('age')) {
      attrs.push('Range(0, 150)');
    }
  }
  if (['decimal', 'double'].includes(typeName)) {
    if (prop.name.toLowerCase().includes('price') || prop.name.toLowerCase().includes('amount')) {
      attrs.push('Range(0, double.MaxValue)');
    }
  }

  return attrs;
}

/**
 * Generate validator extension method for DI
 */
export function generateValidatorDIExtension(
  models: CSharpClassInfo[],
  options: CSharpGeneratorOptions
): string {
  const parts: string[] = [];

  // Usings
  const usings = [
    'FluentValidation',
    'Microsoft.Extensions.DependencyInjection',
    `${options.namespace}.Validators`,
  ];
  parts.push(generateUsings(usings) + '\n');

  // Namespace
  parts.push(`namespace ${options.namespace}.Extensions;\n`);

  // Class
  parts.push('public static class ValidatorExtensions');
  parts.push('{');
  parts.push('    public static IServiceCollection AddValidators(this IServiceCollection services)');
  parts.push('    {');

  for (const model of models) {
    parts.push(`        services.AddScoped<IValidator<${model.name}>, ${model.name}Validator>();`);
  }

  parts.push('        return services;');
  parts.push('    }');
  parts.push('}');

  return parts.join('\n');
}

/**
 * Generate validation middleware for ASP.NET
 */
export function generateValidationMiddleware(options: CSharpGeneratorOptions): string {
  const parts: string[] = [];

  // Usings
  const usings = [
    'FluentValidation',
    'Microsoft.AspNetCore.Http',
    'System.Text.Json',
  ];
  parts.push(generateUsings(usings) + '\n');

  // Namespace
  parts.push(`namespace ${options.namespace}.Middleware;\n`);

  // Class
  parts.push(`/// <summary>
/// Middleware that validates request bodies using FluentValidation
/// </summary>
public class ValidationMiddleware
{
    private readonly RequestDelegate _next;

    public ValidationMiddleware(RequestDelegate next)
    {
        _next = next;
    }

    public async Task InvokeAsync(HttpContext context, IServiceProvider serviceProvider)
    {
        await _next(context);
    }
}

/// <summary>
/// Validation error response
/// </summary>
public record ValidationErrorResponse(
    string Type,
    string Title,
    int Status,
    Dictionary<string, string[]> Errors
);

/// <summary>
/// Extension methods for validation middleware
/// </summary>
public static class ValidationMiddlewareExtensions
{
    public static IApplicationBuilder UseValidation(this IApplicationBuilder app)
    {
        return app.UseMiddleware<ValidationMiddleware>();
    }
}`);

  return parts.join('\n');
}
