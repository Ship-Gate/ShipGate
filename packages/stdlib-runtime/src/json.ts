/**
 * ISL Standard Library - JSON Module
 * Provides JSON parsing, serialization, and manipulation
 * 
 * DETERMINISM: 100% deterministic - all functions produce same output for same input
 */

// ============================================
// Types
// ============================================

export type JSONValue = string | number | boolean | null | JSONObject | JSONArray;
export type JSONObject = { [key: string]: JSONValue };
export type JSONArray = JSONValue[];
export type JSONFormatOptions = 'COMPACT' | 'PRETTY' | 'SORTED_KEYS';
export type JSONPatchOp = 'ADD' | 'REMOVE' | 'REPLACE' | 'MOVE' | 'COPY' | 'TEST';

export interface JSONParseResult {
  success: boolean;
  value?: JSONValue;
  error_message?: string;
  error_position?: number;
}

export interface JSONPatch {
  op: JSONPatchOp;
  path: string;
  value?: JSONValue;
  from?: string;
}

export interface JSONDiff {
  patches: JSONPatch[];
}

// ============================================
// Parsing
// ============================================

export function parse(json: string, _strict = true): JSONValue {
  try {
    const value = JSON.parse(json);
    return value;
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Invalid JSON';
    throw new Error(`INVALID_JSON: ${message}`);
  }
}

export function tryParse(json: string, strict = true): JSONParseResult {
  try {
    const value = parse(json, strict);
    return { success: true, value };
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Invalid JSON';
    return { success: false, error_message: message };
  }
}

// ============================================
// Serialization
// ============================================

export function stringify(value: JSONValue, format: JSONFormatOptions = 'COMPACT', indent = 2): string {
  if (format === 'SORTED_KEYS') {
    return JSON.stringify(sortObjectKeys(value));
  }
  if (format === 'PRETTY') {
    return JSON.stringify(value, null, indent);
  }
  return JSON.stringify(value);
}

export function stringifyPretty(value: JSONValue, indent = 2): string {
  return JSON.stringify(value, null, indent);
}

export function stringifyCompact(value: JSONValue): string {
  return JSON.stringify(value);
}

function sortObjectKeys(value: JSONValue): JSONValue {
  if (value === null || typeof value !== 'object') {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map(sortObjectKeys);
  }
  const sorted: JSONObject = {};
  const objKeys = Object.keys(value).sort();
  for (const key of objKeys) {
    const objValue = (value as JSONObject)[key];
    if (objValue !== undefined) {
      sorted[key] = sortObjectKeys(objValue);
    }
  }
  return sorted;
}

// ============================================
// Access
// ============================================

function parsePath(path: string): string[] {
  // Handle both JSONPath ($.a.b) and JSONPointer (/a/b)
  if (path.startsWith('$.')) {
    return path.slice(2).split('.').filter(Boolean);
  }
  if (path.startsWith('/')) {
    return path.slice(1).split('/').filter(Boolean);
  }
  return path.split('.').filter(Boolean);
}

export function get(obj: JSONValue, path: string, defaultValue?: JSONValue): JSONValue | undefined {
  const parts = parsePath(path);
  let current: JSONValue | undefined = obj;
  
  for (const part of parts) {
    if (current === null || current === undefined || typeof current !== 'object') {
      return defaultValue;
    }
    if (Array.isArray(current)) {
      const index = parseInt(part, 10);
      if (isNaN(index) || index < 0 || index >= current.length) {
        return defaultValue;
      }
      current = current[index];
    } else {
      if (!(part in current)) {
        return defaultValue;
      }
      current = (current as JSONObject)[part];
    }
  }
  return current ?? defaultValue;
}

export function getString(obj: JSONValue, path: string, defaultValue?: string): string | undefined {
  const value = get(obj, path, defaultValue);
  if (typeof value === 'string') return value;
  if (value === undefined) return defaultValue;
  throw new Error('TYPE_MISMATCH: Value at path is not a string');
}

export function getNumber(obj: JSONValue, path: string, defaultValue?: number): number | undefined {
  const value = get(obj, path, defaultValue);
  if (typeof value === 'number') return value;
  if (value === undefined) return defaultValue;
  throw new Error('TYPE_MISMATCH: Value at path is not a number');
}

export function getBoolean(obj: JSONValue, path: string, defaultValue?: boolean): boolean | undefined {
  const value = get(obj, path, defaultValue);
  if (typeof value === 'boolean') return value;
  if (value === undefined) return defaultValue;
  throw new Error('TYPE_MISMATCH: Value at path is not a boolean');
}

export function getArray(obj: JSONValue, path: string): JSONArray | undefined {
  const value = get(obj, path);
  if (Array.isArray(value)) return value;
  if (value === undefined) return undefined;
  throw new Error('TYPE_MISMATCH: Value at path is not an array');
}

export function getObject(obj: JSONValue, path: string): JSONObject | undefined {
  const value = get(obj, path);
  if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
    return value as JSONObject;
  }
  if (value === undefined) return undefined;
  throw new Error('TYPE_MISMATCH: Value at path is not an object');
}

export function has(obj: JSONValue, path: string): boolean {
  return get(obj, path) !== undefined;
}

// ============================================
// Modification
// ============================================

export function set(obj: JSONValue, path: string, value: JSONValue): JSONValue {
  const parts = parsePath(path);
  if (parts.length === 0) return value;
  
  const result = clone(obj);
  let current: JSONValue | undefined = result;
  
  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i];
    if (part === undefined || current === null || current === undefined || typeof current !== 'object') {
      throw new Error('INVALID_PATH: Path is invalid or parent doesn\'t exist');
    }
    if (Array.isArray(current)) {
      const index = parseInt(part, 10);
      current = current[index];
    } else {
      current = (current as JSONObject)[part];
    }
  }
  
  const lastPart = parts[parts.length - 1];
  if (lastPart !== undefined && current !== null && current !== undefined && typeof current === 'object') {
    if (Array.isArray(current)) {
      const index = parseInt(lastPart, 10);
      current[index] = value;
    } else {
      (current as JSONObject)[lastPart] = value;
    }
  }
  
  return result;
}

export function remove(obj: JSONValue, path: string): JSONValue {
  const parts = parsePath(path);
  if (parts.length === 0) {
    throw new Error('PATH_NOT_FOUND: Path does not exist');
  }
  
  const result = clone(obj);
  let current: JSONValue | undefined = result;
  
  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i];
    if (part === undefined || current === null || current === undefined || typeof current !== 'object') {
      throw new Error('PATH_NOT_FOUND: Path does not exist');
    }
    if (Array.isArray(current)) {
      const index = parseInt(part, 10);
      current = current[index];
    } else {
      current = (current as JSONObject)[part];
    }
  }
  
  const lastPart = parts[parts.length - 1];
  if (lastPart !== undefined && current !== null && current !== undefined && typeof current === 'object') {
    if (Array.isArray(current)) {
      const index = parseInt(lastPart, 10);
      current.splice(index, 1);
    } else {
      delete (current as JSONObject)[lastPart];
    }
  }
  
  return result;
}

export function merge(target: JSONObject, source: JSONObject, deep = true): JSONObject {
  if (!deep) {
    return { ...target, ...source };
  }
  
  const result: JSONObject = { ...target };
  for (const key in source) {
    const sourceValue = source[key];
    const targetValue = result[key];
    
    if (
      sourceValue !== undefined &&
      sourceValue !== null &&
      typeof sourceValue === 'object' &&
      !Array.isArray(sourceValue) &&
      targetValue !== undefined &&
      targetValue !== null &&
      typeof targetValue === 'object' &&
      !Array.isArray(targetValue)
    ) {
      result[key] = merge(targetValue as JSONObject, sourceValue as JSONObject, true);
    } else if (sourceValue !== undefined) {
      result[key] = sourceValue;
    }
  }
  return result;
}

export function clone(value: JSONValue): JSONValue {
  return JSON.parse(JSON.stringify(value));
}

// ============================================
// Querying
// ============================================

export function keys(obj: JSONObject): string[] {
  return Object.keys(obj);
}

export function values(obj: JSONObject): JSONValue[] {
  return Object.values(obj);
}

export function entries(obj: JSONObject): Array<{ key: string; value: JSONValue }> {
  return Object.entries(obj).map(([key, value]) => ({ key, value }));
}

export function query(obj: JSONValue, path: string): JSONValue[] {
  // Simple JSONPath implementation
  const results: JSONValue[] = [];
  const value = get(obj, path);
  if (value !== undefined) {
    results.push(value);
  }
  return results;
}

// ============================================
// Comparison
// ============================================

export function equals(a: JSONValue, b: JSONValue): boolean {
  return stringify(a, 'SORTED_KEYS') === stringify(b, 'SORTED_KEYS');
}

export function diff(source: JSONValue, target: JSONValue): JSONDiff {
  const patches: JSONPatch[] = [];
  diffRecursive(source, target, '', patches);
  return { patches };
}

function diffRecursive(source: JSONValue, target: JSONValue, path: string, patches: JSONPatch[]): void {
  if (source === target) return;
  
  if (source === null || target === null || typeof source !== typeof target) {
    patches.push({ op: 'REPLACE', path: path || '/', value: target });
    return;
  }
  
  if (typeof source !== 'object') {
    if (source !== target) {
      patches.push({ op: 'REPLACE', path: path || '/', value: target });
    }
    return;
  }
  
  if (Array.isArray(source) && Array.isArray(target)) {
    // Simple array diff - replace if different
    if (!equals(source, target)) {
      patches.push({ op: 'REPLACE', path: path || '/', value: target });
    }
    return;
  }
  
  if (Array.isArray(source) !== Array.isArray(target)) {
    patches.push({ op: 'REPLACE', path: path || '/', value: target });
    return;
  }
  
  const sourceObj = source as JSONObject;
  const targetObj = target as JSONObject;
  
  // Check for removed keys
  for (const key in sourceObj) {
    if (!(key in targetObj)) {
      patches.push({ op: 'REMOVE', path: `${path}/${key}` });
    }
  }
  
  // Check for added and modified keys
  for (const key in targetObj) {
    const newPath = `${path}/${key}`;
    const targetVal = targetObj[key];
    const sourceVal = sourceObj[key];
    if (!(key in sourceObj)) {
      if (targetVal !== undefined) {
        patches.push({ op: 'ADD', path: newPath, value: targetVal });
      }
    } else if (sourceVal !== undefined && targetVal !== undefined) {
      diffRecursive(sourceVal, targetVal, newPath, patches);
    }
  }
}

export function applyPatches(value: JSONValue, patches: JSONPatch[]): JSONValue {
  let result = clone(value);
  for (const patch of patches) {
    switch (patch.op) {
      case 'ADD':
      case 'REPLACE':
        if (patch.value !== undefined) {
          result = set(result, patch.path, patch.value);
        }
        break;
      case 'REMOVE':
        result = remove(result, patch.path);
        break;
      case 'MOVE':
        if (patch.from) {
          const val = get(result, patch.from);
          if (val !== undefined) {
            result = remove(result, patch.from);
            result = set(result, patch.path, val);
          }
        }
        break;
      case 'COPY':
        if (patch.from) {
          const val = get(result, patch.from);
          if (val !== undefined) {
            result = set(result, patch.path, clone(val));
          }
        }
        break;
      case 'TEST':
        const current = get(result, patch.path);
        if (!equals(current as JSONValue, patch.value as JSONValue)) {
          throw new Error('TEST_FAILED: Test operation did not pass');
        }
        break;
    }
  }
  return result;
}

// ============================================
// Validation
// ============================================

export function isValid(json: string): boolean {
  return tryParse(json).success;
}

export function isObject(value: JSONValue): value is JSONObject {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export function isArray(value: JSONValue): value is JSONArray {
  return Array.isArray(value);
}

export function isString(value: JSONValue): value is string {
  return typeof value === 'string';
}

export function isNumber(value: JSONValue): value is number {
  return typeof value === 'number';
}

export function isBoolean(value: JSONValue): value is boolean {
  return typeof value === 'boolean';
}

export function isNull(value: JSONValue): value is null {
  return value === null;
}

// ============================================
// Transformation
// ============================================

export function flatten(obj: JSONObject, delimiter = '.'): Record<string, JSONValue> {
  const result: Record<string, JSONValue> = {};
  
  function recurse(current: JSONValue, path: string): void {
    if (current === null || typeof current !== 'object') {
      result[path] = current;
      return;
    }
    
    if (Array.isArray(current)) {
      result[path] = current;
      return;
    }
    
    for (const key in current) {
      const newPath = path ? `${path}${delimiter}${key}` : key;
      const val = (current as JSONObject)[key];
      if (val !== undefined) {
        recurse(val, newPath);
      }
    }
  }
  
  recurse(obj, '');
  return result;
}

export function unflatten(obj: Record<string, JSONValue>, delimiter = '.'): JSONObject {
  const result: JSONObject = {};
  
  for (const path in obj) {
    const parts = path.split(delimiter);
    let current: JSONObject = result;
    
    for (let i = 0; i < parts.length - 1; i++) {
      const part = parts[i];
      if (part !== undefined) {
        if (!(part in current)) {
          current[part] = {};
        }
        const next = current[part];
        if (next && typeof next === 'object' && !Array.isArray(next)) {
          current = next as JSONObject;
        }
      }
    }
    
    const lastPart = parts[parts.length - 1];
    const val = obj[path];
    if (lastPart !== undefined && val !== undefined) {
      current[lastPart] = val;
    }
  }
  
  return result;
}

export function pick(obj: JSONObject, pickKeys: string[]): JSONObject {
  const result: JSONObject = {};
  for (const key of pickKeys) {
    if (key in obj) {
      const val = obj[key];
      if (val !== undefined) {
        result[key] = val;
      }
    }
  }
  return result;
}

export function omit(obj: JSONObject, omitKeys: string[]): JSONObject {
  const keysSet = new Set(omitKeys);
  const result: JSONObject = {};
  for (const key in obj) {
    if (!keysSet.has(key)) {
      const val = obj[key];
      if (val !== undefined) {
        result[key] = val;
      }
    }
  }
  return result;
}

// ============================================
// Constants
// ============================================

export const EMPTY_OBJECT: JSONObject = {};
export const EMPTY_ARRAY: JSONArray = [];
export const NULL_VALUE: null = null;

// ============================================
// Default Export
// ============================================

export const JSON_ = {
  parse,
  tryParse,
  stringify,
  stringifyPretty,
  stringifyCompact,
  get,
  getString,
  getNumber,
  getBoolean,
  getArray,
  getObject,
  has,
  set,
  remove,
  merge,
  clone,
  keys,
  values,
  entries,
  query,
  equals,
  diff,
  applyPatches,
  isValid,
  isObject,
  isArray,
  isString,
  isNumber,
  isBoolean,
  isNull,
  flatten,
  unflatten,
  pick,
  omit,
  EMPTY_OBJECT,
  EMPTY_ARRAY,
  NULL_VALUE,
};

export default JSON_;
