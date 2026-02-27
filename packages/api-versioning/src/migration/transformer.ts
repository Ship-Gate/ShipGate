/**
 * Request/Response Transformer
 * 
 * Transforms requests and responses between API versions.
 */

import type {
  TransformableRequest,
  TransformableResponse,
  RequestTransformer,
  ResponseTransformer,
  VersionTransformer,
  Change,
} from '../types.js';

/**
 * Create a request transformer from changes
 */
export function createRequestTransformer(changes: Change[]): RequestTransformer {
  return (req: TransformableRequest): TransformableRequest => {
    const transformed = deepClone(req);
    
    for (const change of changes) {
      applyRequestChange(transformed, change);
    }
    
    return transformed;
  };
}

/**
 * Create a response transformer from changes
 */
export function createResponseTransformer(changes: Change[]): ResponseTransformer {
  return (res: TransformableResponse): TransformableResponse => {
    const transformed = deepClone(res);
    
    for (const change of changes) {
      applyResponseChange(transformed, change);
    }
    
    return transformed;
  };
}

/**
 * Create bidirectional transformer
 */
export function createTransformer(
  forwardChanges: Change[],
  backwardChanges: Change[]
): VersionTransformer {
  return {
    request: createRequestTransformer(forwardChanges),
    response: createResponseTransformer(backwardChanges),
  };
}

/**
 * Apply a change to transform request (old -> new)
 */
function applyRequestChange(req: TransformableRequest, change: Change): void {
  if (!req.body) return;
  
  const pathParts = change.path.split('.');
  
  switch (change.type) {
    case 'field_renamed':
      renameField(req.body, pathParts, change.from as string, change.to as string);
      break;
      
    case 'field_removed':
      // For request: if field was removed in new version, keep it (server ignores)
      break;
      
    case 'field_added':
      // For request: new required field, might need default
      if (change.to !== undefined) {
        setNestedValue(req.body, pathParts, change.to);
      }
      break;
      
    case 'field_type_changed':
      // Attempt type coercion
      coerceFieldType(req.body, pathParts, change.from as string, change.to as string);
      break;
  }
}

/**
 * Apply a change to transform response (new -> old)
 */
function applyResponseChange(res: TransformableResponse, change: Change): void {
  if (!res.body) return;
  
  const pathParts = change.path.split('.');
  
  switch (change.type) {
    case 'field_renamed':
      // Reverse rename for response
      renameField(res.body, pathParts, change.to as string, change.from as string);
      break;
      
    case 'field_added':
      // Remove new field from response for old clients
      deleteNestedValue(res.body, pathParts);
      break;
      
    case 'field_removed':
      // Field doesn't exist in new response, can't restore
      break;
      
    case 'field_type_changed':
      // Reverse type coercion
      coerceFieldType(res.body, pathParts, change.to as string, change.from as string);
      break;
  }
}

/**
 * Rename a field in an object
 */
function renameField(
  obj: Record<string, unknown>,
  pathParts: string[],
  oldName: string,
  newName: string
): void {
  const target = getNestedObject(obj, pathParts.slice(0, -1));
  if (target && typeof target === 'object' && oldName in target) {
    (target as Record<string, unknown>)[newName] = (target as Record<string, unknown>)[oldName];
    delete (target as Record<string, unknown>)[oldName];
  }
}

/**
 * Coerce field type
 */
function coerceFieldType(
  obj: Record<string, unknown>,
  pathParts: string[],
  fromType: string,
  toType: string
): void {
  const value = getNestedValue(obj, pathParts);
  if (value === undefined) return;
  
  let coerced: unknown = value;
  
  // String -> Number
  if (fromType === 'String' && (toType === 'Int' || toType === 'Number')) {
    const num = Number(value);
    if (!isNaN(num)) coerced = num;
  }
  // Number -> String
  else if ((fromType === 'Int' || fromType === 'Number') && toType === 'String') {
    coerced = String(value);
  }
  // Boolean -> String
  else if (fromType === 'Boolean' && toType === 'String') {
    coerced = String(value);
  }
  // String -> Boolean
  else if (fromType === 'String' && toType === 'Boolean') {
    coerced = value === 'true' || value === '1';
  }
  
  setNestedValue(obj, pathParts, coerced);
}

/**
 * Get nested object
 */
function getNestedObject(obj: Record<string, unknown>, pathParts: string[]): unknown {
  let current: unknown = obj;
  for (const part of pathParts) {
    if (current === null || current === undefined || typeof current !== 'object') {
      return undefined;
    }
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}

/**
 * Get nested value
 */
function getNestedValue(obj: Record<string, unknown>, pathParts: string[]): unknown {
  return getNestedObject(obj, pathParts);
}

/**
 * Set nested value
 */
function setNestedValue(
  obj: Record<string, unknown>,
  pathParts: string[],
  value: unknown
): void {
  let current = obj;
  for (let i = 0; i < pathParts.length - 1; i++) {
    const part = pathParts[i];
    if (!(part in current) || typeof current[part] !== 'object') {
      current[part] = {};
    }
    current = current[part] as Record<string, unknown>;
  }
  current[pathParts[pathParts.length - 1]] = value;
}

/**
 * Delete nested value
 */
function deleteNestedValue(obj: Record<string, unknown>, pathParts: string[]): void {
  const parent = getNestedObject(obj, pathParts.slice(0, -1));
  if (parent && typeof parent === 'object') {
    delete (parent as Record<string, unknown>)[pathParts[pathParts.length - 1]];
  }
}

/**
 * Deep clone an object
 */
function deepClone<T>(obj: T): T {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }
  
  if (Array.isArray(obj)) {
    return obj.map(item => deepClone(item)) as T;
  }
  
  const cloned: Record<string, unknown> = {};
  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      cloned[key] = deepClone((obj as Record<string, unknown>)[key]);
    }
  }
  return cloned as T;
}

export { deepClone, getNestedValue, setNestedValue, deleteNestedValue };
