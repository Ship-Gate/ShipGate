/**
 * Transformer Code Generator
 * 
 * Generates transformation code from ISL diffs.
 */

import type {
  DomainDiff,
  Change,
  GeneratedTransformers,
  RequestTransformer,
  ResponseTransformer,
} from '../types.js';
import { createRequestTransformer, createResponseTransformer } from './transformer.js';

/**
 * Generate transformer code from domain diff
 */
export function generateTransformers(diff: DomainDiff): GeneratedTransformers {
  const requestCode = generateRequestTransformerCode(diff);
  const responseCode = generateResponseTransformerCode(diff);
  
  // Create actual functions
  const allChanges = [...diff.breaking, ...diff.nonBreaking];
  const requestFn = createRequestTransformer(allChanges);
  const responseFn = createResponseTransformer(allChanges);
  
  return {
    request: requestCode,
    response: responseCode,
    requestFn,
    responseFn,
  };
}

/**
 * Generate request transformer code
 */
function generateRequestTransformerCode(diff: DomainDiff): string {
  const changes = [...diff.breaking, ...diff.nonBreaking];
  const transformations: string[] = [];
  
  for (const change of changes) {
    const code = generateRequestChangeCode(change);
    if (code) transformations.push(code);
  }
  
  if (transformations.length === 0) {
    return `function transformRequest(req) {
  // No transformations needed
  return req;
}`;
  }
  
  return `function transformRequest(req) {
  // Auto-generated based on ISL diff: ${diff.from} -> ${diff.to}
  const transformed = { ...req };
  if (transformed.body) {
    transformed.body = { ...transformed.body };
  }
  
${transformations.map(t => '  ' + t.split('\n').join('\n  ')).join('\n\n')}
  
  return transformed;
}`;
}

/**
 * Generate response transformer code
 */
function generateResponseTransformerCode(diff: DomainDiff): string {
  const changes = [...diff.breaking, ...diff.nonBreaking];
  const transformations: string[] = [];
  
  for (const change of changes) {
    const code = generateResponseChangeCode(change);
    if (code) transformations.push(code);
  }
  
  if (transformations.length === 0) {
    return `function transformResponse(res) {
  // No transformations needed
  return res;
}`;
  }
  
  return `function transformResponse(res) {
  // Auto-generated based on ISL diff: ${diff.from} -> ${diff.to}
  const transformed = { ...res };
  if (transformed.body) {
    transformed.body = { ...transformed.body };
  }
  
${transformations.map(t => '  ' + t.split('\n').join('\n  ')).join('\n\n')}
  
  return transformed;
}`;
}

/**
 * Generate code for a request change
 */
function generateRequestChangeCode(change: Change): string | null {
  const { type, path, from, to } = change;
  const pathParts = path.split('.');
  const fieldPath = pathParts.length > 1 
    ? `transformed.body?.${pathParts.slice(1).join('?.')}`
    : `transformed.body`;
  
  switch (type) {
    case 'field_renamed':
      return `// Field renamed: ${from} -> ${to}
if (transformed.body && '${from}' in transformed.body) {
  transformed.body['${to}'] = transformed.body['${from}'];
  delete transformed.body['${from}'];
}`;

    case 'field_type_changed':
      return generateTypeCoercionCode(pathParts, from as string, to as string, 'request');

    case 'field_removed':
      // For requests, removed fields are just ignored by server
      return null;

    case 'field_added':
      if (to !== undefined) {
        return `// New field added: ${path}
// Provide default value if not present
if (transformed.body && !('${pathParts[pathParts.length - 1]}' in transformed.body)) {
  // TODO: Set appropriate default value
}`;
      }
      return null;

    default:
      return null;
  }
}

/**
 * Generate code for a response change
 */
function generateResponseChangeCode(change: Change): string | null {
  const { type, path, from, to } = change;
  const pathParts = path.split('.');
  const fieldName = pathParts[pathParts.length - 1];
  
  switch (type) {
    case 'field_renamed':
      return `// Field renamed: ${from} -> ${to} (reverse for response)
if (transformed.body && '${to}' in transformed.body) {
  transformed.body['${from}'] = transformed.body['${to}'];
}`;

    case 'field_type_changed':
      return generateTypeCoercionCode(pathParts, to as string, from as string, 'response');

    case 'field_added':
      return `// Field added in new version: remove for old clients
if (transformed.body) {
  delete transformed.body['${fieldName}'];
}`;

    case 'field_removed':
      // Can't restore removed field
      return `// Field removed: ${path}
// Cannot restore removed field for old clients`;

    default:
      return null;
  }
}

/**
 * Generate type coercion code
 */
function generateTypeCoercionCode(
  pathParts: string[],
  fromType: string,
  toType: string,
  direction: 'request' | 'response'
): string | null {
  const fieldName = pathParts[pathParts.length - 1];
  const accessor = `transformed.body?.['${fieldName}']`;
  
  // String -> Number
  if (fromType === 'String' && (toType === 'Int' || toType === 'Number' || toType === 'Decimal')) {
    return `// Type changed: ${fromType} -> ${toType}
if (transformed.body && '${fieldName}' in transformed.body) {
  const val = ${accessor};
  if (typeof val === 'string') {
    transformed.body['${fieldName}'] = Number(val);
  }
}`;
  }
  
  // Number -> String
  if ((fromType === 'Int' || fromType === 'Number') && toType === 'String') {
    return `// Type changed: ${fromType} -> ${toType}
if (transformed.body && '${fieldName}' in transformed.body) {
  const val = ${accessor};
  if (typeof val === 'number') {
    transformed.body['${fieldName}'] = String(val);
  }
}`;
  }
  
  // Boolean -> String
  if (fromType === 'Boolean' && toType === 'String') {
    return `// Type changed: ${fromType} -> ${toType}
if (transformed.body && '${fieldName}' in transformed.body) {
  transformed.body['${fieldName}'] = String(${accessor});
}`;
  }
  
  return `// Type changed: ${fromType} -> ${toType} (${direction})
// Manual transformation may be required for ${pathParts.join('.')}`;
}

/**
 * Generate transformer key from versions
 */
export function transformerKey(fromVersion: string, toVersion: string): string {
  return `${fromVersion}->${toVersion}`;
}
