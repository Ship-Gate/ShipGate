// ============================================================================
// C# Controller Templates
// ============================================================================

import type { CSharpClassInfo, CSharpGeneratorOptions } from '../types';
import { generateUsings, generateXmlDoc, generateAttributes } from './model';

/**
 * HTTP method type
 */
type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

/**
 * Endpoint info
 */
interface EndpointInfo {
  name: string;
  httpMethod: HttpMethod;
  route: string;
  requestType?: string;
  responseType: string;
  isAsync: boolean;
  description?: string;
}

/**
 * Generate ASP.NET Core controller
 */
export function generateController(
  model: CSharpClassInfo,
  endpoints: EndpointInfo[],
  options: CSharpGeneratorOptions
): string {
  const controllerName = `${model.name}Controller`;
  const serviceName = `I${model.name}Service`;
  const parts: string[] = [];

  // Usings
  const usings = [
    'Microsoft.AspNetCore.Mvc',
    'Microsoft.AspNetCore.Http',
    model.namespace,
    `${model.namespace}.Services`,
  ];
  
  if (options.generateOpenApiAttributes) {
    usings.push('Swashbuckle.AspNetCore.Annotations');
  }
  
  parts.push(generateUsings(usings) + '\n');

  // Namespace
  parts.push(`namespace ${model.namespace}.Controllers;\n`);

  // XML documentation
  if (options.generateXmlDocs) {
    parts.push(generateXmlDoc(`API controller for ${model.name} operations`));
  }

  // Controller attributes
  const attrs = [
    'ApiController',
    `Route("api/[controller]")`,
    'Produces("application/json")',
  ];
  parts.push(generateAttributes(attrs));

  // Controller class
  parts.push(`public class ${controllerName} : ControllerBase`);
  parts.push('{');

  // Service field
  parts.push(`    private readonly ${serviceName} _service;\n`);

  // Constructor
  parts.push(`    public ${controllerName}(${serviceName} service)`);
  parts.push('    {');
  parts.push('        _service = service;');
  parts.push('    }\n');

  // Generate endpoints
  for (const endpoint of endpoints) {
    parts.push(generateEndpoint(endpoint, model.name, options));
    parts.push('');
  }

  parts.push('}');

  return parts.join('\n');
}

/**
 * Generate endpoint method
 */
function generateEndpoint(
  endpoint: EndpointInfo,
  modelName: string,
  options: CSharpGeneratorOptions
): string {
  const parts: string[] = [];
  const indent = '    ';

  // XML documentation
  if (options.generateXmlDocs && endpoint.description) {
    parts.push(generateXmlDoc(endpoint.description, indent));
  }

  // HTTP method attribute
  const httpAttr = getHttpAttribute(endpoint.httpMethod, endpoint.route);
  parts.push(`${indent}[${httpAttr}]`);

  // OpenAPI attributes
  if (options.generateOpenApiAttributes) {
    parts.push(`${indent}[SwaggerOperation(Summary = "${endpoint.description || endpoint.name}")]`);
    parts.push(`${indent}[ProducesResponseType(typeof(${endpoint.responseType}), StatusCodes.Status200OK)]`);
    parts.push(`${indent}[ProducesResponseType(StatusCodes.Status400BadRequest)]`);
    parts.push(`${indent}[ProducesResponseType(StatusCodes.Status404NotFound)]`);
  }

  // Method signature
  const returnType = endpoint.isAsync 
    ? `async Task<ActionResult<${endpoint.responseType}>>` 
    : `ActionResult<${endpoint.responseType}>`;

  const params = getEndpointParameters(endpoint);
  parts.push(`${indent}public ${returnType} ${endpoint.name}(${params})`);
  parts.push(`${indent}{`);

  // Method body
  parts.push(generateEndpointBody(endpoint, modelName, options, indent + '    '));

  parts.push(`${indent}}`);

  return parts.join('\n');
}

/**
 * Get HTTP attribute
 */
function getHttpAttribute(method: HttpMethod, route: string): string {
  const routePart = route ? `("${route}")` : '';
  return `Http${method.charAt(0) + method.slice(1).toLowerCase()}${routePart}`;
}

/**
 * Get endpoint parameters
 */
function getEndpointParameters(endpoint: EndpointInfo): string {
  const params: string[] = [];

  // Route parameters
  const routeParams = endpoint.route.match(/\{(\w+)\}/g) || [];
  for (const param of routeParams) {
    const paramName = param.replace(/[{}]/g, '');
    if (paramName.toLowerCase().includes('id')) {
      params.push(`[FromRoute] Guid ${paramName}`);
    } else {
      params.push(`[FromRoute] string ${paramName}`);
    }
  }

  // Request body
  if (endpoint.requestType) {
    params.push(`[FromBody] ${endpoint.requestType} request`);
  }

  // Cancellation token
  if (endpoint.isAsync) {
    params.push('CancellationToken cancellationToken = default');
  }

  return params.join(', ');
}

/**
 * Generate endpoint body
 */
function generateEndpointBody(
  endpoint: EndpointInfo,
  _modelName: string,
  _options: CSharpGeneratorOptions,
  indent: string
): string {
  const lines: string[] = [];
  const await_ = endpoint.isAsync ? 'await ' : '';
  const ct = endpoint.isAsync ? ', cancellationToken' : '';

  switch (endpoint.httpMethod) {
    case 'GET':
      if (endpoint.route.includes('{')) {
        // Get by ID
        lines.push(`${indent}var result = ${await_}_service.GetByIdAsync(id${ct});`);
        lines.push(`${indent}if (result == null)`);
        lines.push(`${indent}    return NotFound();`);
        lines.push(`${indent}return Ok(result);`);
      } else {
        // Get all
        lines.push(`${indent}var result = ${await_}_service.GetAllAsync(${ct.slice(2)});`);
        lines.push(`${indent}return Ok(result);`);
      }
      break;

    case 'POST':
      lines.push(`${indent}var result = ${await_}_service.CreateAsync(request${ct});`);
      lines.push(`${indent}return CreatedAtAction(nameof(GetById), new { id = result.Id }, result);`);
      break;

    case 'PUT':
    case 'PATCH':
      lines.push(`${indent}var result = ${await_}_service.UpdateAsync(id, request${ct});`);
      lines.push(`${indent}if (result == null)`);
      lines.push(`${indent}    return NotFound();`);
      lines.push(`${indent}return Ok(result);`);
      break;

    case 'DELETE':
      lines.push(`${indent}var success = ${await_}_service.DeleteAsync(id${ct});`);
      lines.push(`${indent}if (!success)`);
      lines.push(`${indent}    return NotFound();`);
      lines.push(`${indent}return NoContent();`);
      break;
  }

  return lines.join('\n');
}

/**
 * Generate minimal API endpoints
 */
export function generateMinimalApiEndpoints(
  model: CSharpClassInfo,
  endpoints: EndpointInfo[],
  options: CSharpGeneratorOptions
): string {
  const serviceName = `I${model.name}Service`;
  const routePrefix = model.name.toLowerCase() + 's';
  const parts: string[] = [];

  // Usings
  const usings = [
    'Microsoft.AspNetCore.Http.HttpResults',
    model.namespace,
    `${model.namespace}.Services`,
  ];
  parts.push(generateUsings(usings) + '\n');

  // Namespace
  parts.push(`namespace ${model.namespace}.Endpoints;\n`);

  // Static class
  parts.push(`public static class ${model.name}Endpoints`);
  parts.push('{');

  // Map endpoints method
  parts.push(`    public static RouteGroupBuilder Map${model.name}Endpoints(this RouteGroupBuilder group)`);
  parts.push('    {');

  for (const endpoint of endpoints) {
    parts.push(generateMinimalEndpoint(endpoint, model.name, serviceName, routePrefix, options));
  }

  parts.push('        return group;');
  parts.push('    }');
  parts.push('}');

  return parts.join('\n');
}

/**
 * Generate minimal API endpoint
 */
function generateMinimalEndpoint(
  endpoint: EndpointInfo,
  modelName: string,
  serviceName: string,
  _routePrefix: string,
  options: CSharpGeneratorOptions
): string {
  const route = endpoint.route || '';
  const fullRoute = route.startsWith('/') ? route : `/${route}`;
  
  const handler = generateMinimalHandler(endpoint, modelName, serviceName);
  
  let line = `        group.Map${endpoint.httpMethod.charAt(0) + endpoint.httpMethod.slice(1).toLowerCase()}("${fullRoute}", ${handler})`;
  
  if (options.generateOpenApiAttributes) {
    line += `\n            .WithName("${endpoint.name}")`;
    line += `\n            .WithOpenApi()`;
  }
  
  line += ';\n';
  
  return line;
}

/**
 * Generate minimal API handler
 */
function generateMinimalHandler(
  endpoint: EndpointInfo,
  modelName: string,
  serviceName: string
): string {
  switch (endpoint.httpMethod) {
    case 'GET':
      if (endpoint.route.includes('{')) {
        return `async (Guid id, ${serviceName} service, CancellationToken ct) =>
            await service.GetByIdAsync(id, ct) is ${modelName} item
                ? Results.Ok(item)
                : Results.NotFound()`;
      }
      return `async (${serviceName} service, CancellationToken ct) =>
            Results.Ok(await service.GetAllAsync(ct))`;

    case 'POST':
      return `async (${endpoint.requestType} request, ${serviceName} service, CancellationToken ct) =>
        {
            var result = await service.CreateAsync(request, ct);
            return Results.Created($"/${modelName.toLowerCase()}s/{result.Id}", result);
        }`;

    case 'PUT':
    case 'PATCH':
      return `async (Guid id, ${endpoint.requestType} request, ${serviceName} service, CancellationToken ct) =>
            await service.UpdateAsync(id, request, ct) is ${modelName} item
                ? Results.Ok(item)
                : Results.NotFound()`;

    case 'DELETE':
      return `async (Guid id, ${serviceName} service, CancellationToken ct) =>
            await service.DeleteAsync(id, ct)
                ? Results.NoContent()
                : Results.NotFound()`;

    default:
      return '() => Results.Ok()';
  }
}
