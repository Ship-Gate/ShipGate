// ============================================================================
// ISL Runtime Interpreter - Built-in Functions
// @isl-lang/runtime-interpreter/builtins
// ============================================================================

import type { Value, Environment, NativeFunction, EffectHandler } from './types.js';
import { InterpreterError, TypeMismatchError } from './types.js';

// Helper to safely get an argument from the args array
function getArg(args: Value[], index: number, name?: string): Value {
  const value = args[index];
  if (value === undefined) {
    throw new InterpreterError(`Missing argument${name ? ` '${name}'` : ''} at index ${index}`);
  }
  return value;
}

// ============================================================================
// BUILT-IN FUNCTIONS
// ============================================================================

export const builtinFunctions: Map<string, NativeFunction> = new Map([
  // Type checking
  ['typeof', typeOf],
  ['is_some', isSome],
  ['is_none', isNone],
  ['unwrap', unwrap],
  ['unwrap_or', unwrapOr],
  
  // String functions
  ['len', len],
  ['concat', concat],
  ['trim', trim],
  ['split', split],
  ['join', join],
  ['upper', upper],
  ['lower', lower],
  ['contains_str', containsStr],
  ['starts_with', startsWith],
  ['ends_with', endsWith],
  ['replace', replace],
  ['substring', substring],
  
  // Math functions
  ['abs', abs],
  ['min', min],
  ['max', max],
  ['floor', floor],
  ['ceil', ceil],
  ['round', round],
  ['sqrt', sqrt],
  ['pow', pow],
  
  // List functions
  ['head', head],
  ['tail', tail],
  ['last', last],
  ['init', init],
  ['take', take],
  ['drop', drop],
  ['reverse', reverse],
  ['sort', sort],
  ['filter', filterFn],
  ['map', mapFn],
  ['fold', fold],
  ['find', find],
  ['any', any],
  ['all', all],
  ['zip', zip],
  ['flatten', flatten],
  ['distinct', distinct],
  ['group_by', groupBy],
  
  // Map functions
  ['keys', keys],
  ['values', values],
  ['entries', entries],
  ['has_key', hasKey],
  ['get', get],
  ['merge', merge],
  
  // Conversion functions
  ['to_string', toString],
  ['to_int', toInt],
  ['to_float', toFloat],
  ['parse_json', parseJson],
  ['to_json', toJson],
  
  // Time functions
  ['now', nowFn],
  ['today', todayFn],
  ['parse_timestamp', parseTimestamp],
  ['format_timestamp', formatTimestamp],
  ['add_duration', addDuration],
  ['diff_duration', diffDuration],
  
  // UUID functions
  ['uuid', uuidFn],
  ['uuid_v7', uuidV7],
  
  // Debug functions
  ['print', printFn],
  ['debug', debugFn],
  ['assert', assertFn],
]);

// ============================================================================
// TYPE CHECKING FUNCTIONS
// ============================================================================

function typeOf(args: Value[]): Value {
  const value = getArg(args, 0, 'value');
  return { tag: 'string', value: value.tag };
}

function isSome(args: Value[]): Value {
  const value = getArg(args, 0, 'value');
  if (value.tag !== 'option') throw new TypeMismatchError('option', value.tag);
  return { tag: 'boolean', value: value.value !== null };
}

function isNone(args: Value[]): Value {
  const value = getArg(args, 0, 'value');
  if (value.tag !== 'option') throw new TypeMismatchError('option', value.tag);
  return { tag: 'boolean', value: value.value === null };
}

function unwrap(args: Value[]): Value {
  const value = getArg(args, 0, 'value');
  if (value.tag !== 'option') throw new TypeMismatchError('option', value.tag);
  if (value.value === null) throw new InterpreterError('Unwrap called on None');
  return value.value;
}

function unwrapOr(args: Value[]): Value {
  const value = getArg(args, 0, 'value');
  const defaultVal = getArg(args, 1, 'default');
  if (value.tag !== 'option') throw new TypeMismatchError('option', value.tag);
  return value.value ?? defaultVal;
}

// ============================================================================
// STRING FUNCTIONS
// ============================================================================

function len(args: Value[]): Value {
  const value = getArg(args, 0, 'value');
  if (value.tag === 'string') {
    return { tag: 'int', value: BigInt(value.value.length) };
  }
  if (value.tag === 'list') {
    return { tag: 'int', value: BigInt(value.elements.length) };
  }
  if (value.tag === 'map') {
    return { tag: 'int', value: BigInt(value.entries.size) };
  }
  throw new TypeMismatchError('string, list, or map', value.tag);
}

function concat(values: Value[]): Value {
  const strings = values.map(v => {
    if (v.tag !== 'string') throw new TypeMismatchError('string', v.tag);
    return v.value;
  });
  return { tag: 'string', value: strings.join('') };
}

function trim(args: Value[]): Value {
  const value = getArg(args, 0, 'value');
  if (value.tag !== 'string') throw new TypeMismatchError('string', value.tag);
  return { tag: 'string', value: value.value.trim() };
}

function split(args: Value[]): Value {
  const str = getArg(args, 0, 'str');
  const delimiter = getArg(args, 1, 'delimiter');
  if (str.tag !== 'string') throw new TypeMismatchError('string', str.tag);
  if (delimiter.tag !== 'string') throw new TypeMismatchError('string', delimiter.tag);
  return {
    tag: 'list',
    elements: str.value.split(delimiter.value).map(s => ({ tag: 'string', value: s } as Value)),
  };
}

function join(args: Value[]): Value {
  const list = getArg(args, 0, 'list');
  const separator = getArg(args, 1, 'separator');
  if (list.tag !== 'list') throw new TypeMismatchError('list', list.tag);
  if (separator.tag !== 'string') throw new TypeMismatchError('string', separator.tag);
  const strings = list.elements.map(e => {
    if (e.tag !== 'string') throw new TypeMismatchError('string', e.tag);
    return e.value;
  });
  return { tag: 'string', value: strings.join(separator.value) };
}

function upper(args: Value[]): Value {
  const value = getArg(args, 0, 'value');
  if (value.tag !== 'string') throw new TypeMismatchError('string', value.tag);
  return { tag: 'string', value: value.value.toUpperCase() };
}

function lower(args: Value[]): Value {
  const value = getArg(args, 0, 'value');
  if (value.tag !== 'string') throw new TypeMismatchError('string', value.tag);
  return { tag: 'string', value: value.value.toLowerCase() };
}

function containsStr(args: Value[]): Value {
  const str = getArg(args, 0, 'str');
  const substr = getArg(args, 1, 'substr');
  if (str.tag !== 'string') throw new TypeMismatchError('string', str.tag);
  if (substr.tag !== 'string') throw new TypeMismatchError('string', substr.tag);
  return { tag: 'boolean', value: str.value.includes(substr.value) };
}

function startsWith(args: Value[]): Value {
  const str = getArg(args, 0, 'str');
  const prefix = getArg(args, 1, 'prefix');
  if (str.tag !== 'string') throw new TypeMismatchError('string', str.tag);
  if (prefix.tag !== 'string') throw new TypeMismatchError('string', prefix.tag);
  return { tag: 'boolean', value: str.value.startsWith(prefix.value) };
}

function endsWith(args: Value[]): Value {
  const str = getArg(args, 0, 'str');
  const suffix = getArg(args, 1, 'suffix');
  if (str.tag !== 'string') throw new TypeMismatchError('string', str.tag);
  if (suffix.tag !== 'string') throw new TypeMismatchError('string', suffix.tag);
  return { tag: 'boolean', value: str.value.endsWith(suffix.value) };
}

function replace(args: Value[]): Value {
  const str = getArg(args, 0, 'str');
  const from = getArg(args, 1, 'from');
  const to = getArg(args, 2, 'to');
  if (str.tag !== 'string') throw new TypeMismatchError('string', str.tag);
  if (from.tag !== 'string') throw new TypeMismatchError('string', from.tag);
  if (to.tag !== 'string') throw new TypeMismatchError('string', to.tag);
  return { tag: 'string', value: str.value.replaceAll(from.value, to.value) };
}

function substring(args: Value[]): Value {
  const str = getArg(args, 0, 'str');
  const start = getArg(args, 1, 'start');
  if (str.tag !== 'string') throw new TypeMismatchError('string', str.tag);
  if (start.tag !== 'int') throw new TypeMismatchError('int', start.tag);
  const s = Number(start.value);
  const end = args[2];
  const e = end?.tag === 'int' ? Number(end.value) : undefined;
  return { tag: 'string', value: str.value.substring(s, e) };
}

// ============================================================================
// MATH FUNCTIONS
// ============================================================================

function abs(args: Value[]): Value {
  const value = getArg(args, 0, 'value');
  if (value.tag === 'int') {
    return { tag: 'int', value: value.value < 0n ? -value.value : value.value };
  }
  if (value.tag === 'float') {
    return { tag: 'float', value: Math.abs(value.value) };
  }
  throw new TypeMismatchError('numeric', value.tag);
}

function min(values: Value[]): Value {
  if (values.length === 0) throw new InterpreterError('min requires at least one argument');
  let minVal = getArg(values, 0);
  for (const v of values.slice(1)) {
    if (compareValues(v, minVal) < 0) minVal = v;
  }
  return minVal;
}

function max(values: Value[]): Value {
  if (values.length === 0) throw new InterpreterError('max requires at least one argument');
  let maxVal = getArg(values, 0);
  for (const v of values.slice(1)) {
    if (compareValues(v, maxVal) > 0) maxVal = v;
  }
  return maxVal;
}

function floor(args: Value[]): Value {
  const value = getArg(args, 0, 'value');
  if (value.tag !== 'float') throw new TypeMismatchError('float', value.tag);
  return { tag: 'int', value: BigInt(Math.floor(value.value)) };
}

function ceil(args: Value[]): Value {
  const value = getArg(args, 0, 'value');
  if (value.tag !== 'float') throw new TypeMismatchError('float', value.tag);
  return { tag: 'int', value: BigInt(Math.ceil(value.value)) };
}

function round(args: Value[]): Value {
  const value = getArg(args, 0, 'value');
  if (value.tag !== 'float') throw new TypeMismatchError('float', value.tag);
  return { tag: 'int', value: BigInt(Math.round(value.value)) };
}

function sqrt(args: Value[]): Value {
  const value = getArg(args, 0, 'value');
  if (value.tag !== 'float') throw new TypeMismatchError('float', value.tag);
  return { tag: 'float', value: Math.sqrt(value.value) };
}

function pow(args: Value[]): Value {
  const base = getArg(args, 0, 'base');
  const exp = getArg(args, 1, 'exp');
  if (base.tag === 'int' && exp.tag === 'int') {
    return { tag: 'int', value: base.value ** exp.value };
  }
  if (base.tag === 'float' && (exp.tag === 'float' || exp.tag === 'int')) {
    const e = exp.tag === 'int' ? Number(exp.value) : exp.value;
    return { tag: 'float', value: Math.pow(base.value, e) };
  }
  throw new TypeMismatchError('numeric', `${base.tag} and ${exp.tag}`);
}

// ============================================================================
// LIST FUNCTIONS
// ============================================================================

function head(args: Value[]): Value {
  const list = getArg(args, 0, 'list');
  if (list.tag !== 'list') throw new TypeMismatchError('list', list.tag);
  if (list.elements.length === 0) throw new InterpreterError('head of empty list');
  const first = list.elements[0];
  if (first === undefined) throw new InterpreterError('head of empty list');
  return first;
}

function tail(args: Value[]): Value {
  const list = getArg(args, 0, 'list');
  if (list.tag !== 'list') throw new TypeMismatchError('list', list.tag);
  return { tag: 'list', elements: list.elements.slice(1) };
}

function last(args: Value[]): Value {
  const list = getArg(args, 0, 'list');
  if (list.tag !== 'list') throw new TypeMismatchError('list', list.tag);
  if (list.elements.length === 0) throw new InterpreterError('last of empty list');
  const lastElem = list.elements[list.elements.length - 1];
  if (lastElem === undefined) throw new InterpreterError('last of empty list');
  return lastElem;
}

function init(args: Value[]): Value {
  const list = getArg(args, 0, 'list');
  if (list.tag !== 'list') throw new TypeMismatchError('list', list.tag);
  return { tag: 'list', elements: list.elements.slice(0, -1) };
}

function take(args: Value[]): Value {
  const list = getArg(args, 0, 'list');
  const n = getArg(args, 1, 'n');
  if (list.tag !== 'list') throw new TypeMismatchError('list', list.tag);
  if (n.tag !== 'int') throw new TypeMismatchError('int', n.tag);
  return { tag: 'list', elements: list.elements.slice(0, Number(n.value)) };
}

function drop(args: Value[]): Value {
  const list = getArg(args, 0, 'list');
  const n = getArg(args, 1, 'n');
  if (list.tag !== 'list') throw new TypeMismatchError('list', list.tag);
  if (n.tag !== 'int') throw new TypeMismatchError('int', n.tag);
  return { tag: 'list', elements: list.elements.slice(Number(n.value)) };
}

function reverse(args: Value[]): Value {
  const list = getArg(args, 0, 'list');
  if (list.tag !== 'list') throw new TypeMismatchError('list', list.tag);
  return { tag: 'list', elements: [...list.elements].reverse() };
}

function sort(args: Value[]): Value {
  const list = getArg(args, 0, 'list');
  if (list.tag !== 'list') throw new TypeMismatchError('list', list.tag);
  return { tag: 'list', elements: [...list.elements].sort(compareValues) };
}

function filterFn(args: Value[], _env: Environment): Value {
  const list = getArg(args, 0, 'list');
  const predicate = getArg(args, 1, 'predicate');
  if (list.tag !== 'list') throw new TypeMismatchError('list', list.tag);
  if (predicate.tag !== 'function' && predicate.tag !== 'native') {
    throw new TypeMismatchError('function', predicate.tag);
  }
  // Simplified - would need async evaluation in real implementation
  return { tag: 'list', elements: list.elements };
}

function mapFn(args: Value[], _env: Environment): Value {
  const list = getArg(args, 0, 'list');
  const fn = getArg(args, 1, 'fn');
  if (list.tag !== 'list') throw new TypeMismatchError('list', list.tag);
  if (fn.tag !== 'function' && fn.tag !== 'native') {
    throw new TypeMismatchError('function', fn.tag);
  }
  // Simplified - would need async evaluation in real implementation
  return { tag: 'list', elements: list.elements };
}

function fold(args: Value[], _env: Environment): Value {
  const list = getArg(args, 0, 'list');
  const initial = getArg(args, 1, 'initial');
  if (list.tag !== 'list') throw new TypeMismatchError('list', list.tag);
  // Simplified
  return initial;
}

function find(args: Value[]): Value {
  const list = getArg(args, 0, 'list');
  if (list.tag !== 'list') throw new TypeMismatchError('list', list.tag);
  // Simplified
  return { tag: 'option', value: null };
}

function any(args: Value[]): Value {
  const list = getArg(args, 0, 'list');
  if (list.tag !== 'list') throw new TypeMismatchError('list', list.tag);
  // Simplified
  return { tag: 'boolean', value: false };
}

function all(args: Value[]): Value {
  const list = getArg(args, 0, 'list');
  if (list.tag !== 'list') throw new TypeMismatchError('list', list.tag);
  // Simplified
  return { tag: 'boolean', value: true };
}

function zip(args: Value[]): Value {
  const list1 = getArg(args, 0, 'list1');
  const list2 = getArg(args, 1, 'list2');
  if (list1.tag !== 'list') throw new TypeMismatchError('list', list1.tag);
  if (list2.tag !== 'list') throw new TypeMismatchError('list', list2.tag);
  const length = Math.min(list1.elements.length, list2.elements.length);
  const elements: Value[] = [];
  for (let i = 0; i < length; i++) {
    const e1 = list1.elements[i];
    const e2 = list2.elements[i];
    if (e1 !== undefined && e2 !== undefined) {
      elements.push({ tag: 'list', elements: [e1, e2] });
    }
  }
  return { tag: 'list', elements };
}

function flatten(args: Value[]): Value {
  const list = getArg(args, 0, 'list');
  if (list.tag !== 'list') throw new TypeMismatchError('list', list.tag);
  const elements: Value[] = [];
  for (const e of list.elements) {
    if (e.tag === 'list') {
      elements.push(...e.elements);
    } else {
      elements.push(e);
    }
  }
  return { tag: 'list', elements };
}

function distinct(args: Value[]): Value {
  const list = getArg(args, 0, 'list');
  if (list.tag !== 'list') throw new TypeMismatchError('list', list.tag);
  const seen = new Set<string>();
  const elements: Value[] = [];
  for (const e of list.elements) {
    const key = JSON.stringify(e);
    if (!seen.has(key)) {
      seen.add(key);
      elements.push(e);
    }
  }
  return { tag: 'list', elements };
}

function groupBy(args: Value[]): Value {
  const list = getArg(args, 0, 'list');
  if (list.tag !== 'list') throw new TypeMismatchError('list', list.tag);
  // Simplified
  return { tag: 'map', entries: new Map() };
}

// ============================================================================
// MAP FUNCTIONS
// ============================================================================

function keys(args: Value[]): Value {
  const map = getArg(args, 0, 'map');
  if (map.tag !== 'map') throw new TypeMismatchError('map', map.tag);
  return {
    tag: 'list',
    elements: Array.from(map.entries.keys()).map(k => ({ tag: 'string', value: k } as Value)),
  };
}

function values(args: Value[]): Value {
  const map = getArg(args, 0, 'map');
  if (map.tag !== 'map') throw new TypeMismatchError('map', map.tag);
  return { tag: 'list', elements: Array.from(map.entries.values()) };
}

function entries(args: Value[]): Value {
  const map = getArg(args, 0, 'map');
  if (map.tag !== 'map') throw new TypeMismatchError('map', map.tag);
  return {
    tag: 'list',
    elements: Array.from(map.entries.entries()).map(([k, v]) => ({
      tag: 'list',
      elements: [{ tag: 'string', value: k } as Value, v],
    } as Value)),
  };
}

function hasKey(args: Value[]): Value {
  const map = getArg(args, 0, 'map');
  const key = getArg(args, 1, 'key');
  if (map.tag !== 'map') throw new TypeMismatchError('map', map.tag);
  if (key.tag !== 'string') throw new TypeMismatchError('string', key.tag);
  return { tag: 'boolean', value: map.entries.has(key.value) };
}

function get(args: Value[]): Value {
  const map = getArg(args, 0, 'map');
  const key = getArg(args, 1, 'key');
  if (map.tag !== 'map') throw new TypeMismatchError('map', map.tag);
  if (key.tag !== 'string') throw new TypeMismatchError('string', key.tag);
  return { tag: 'option', value: map.entries.get(key.value) ?? null };
}

function merge(args: Value[]): Value {
  const map1 = getArg(args, 0, 'map1');
  const map2 = getArg(args, 1, 'map2');
  if (map1.tag !== 'map') throw new TypeMismatchError('map', map1.tag);
  if (map2.tag !== 'map') throw new TypeMismatchError('map', map2.tag);
  return { tag: 'map', entries: new Map([...map1.entries, ...map2.entries]) };
}

// ============================================================================
// CONVERSION FUNCTIONS
// ============================================================================

function toString(args: Value[]): Value {
  const value = getArg(args, 0, 'value');
  return { tag: 'string', value: valueToString(value) };
}

function toInt(args: Value[]): Value {
  const value = getArg(args, 0, 'value');
  if (value.tag === 'string') {
    return { tag: 'int', value: BigInt(value.value) };
  }
  if (value.tag === 'float') {
    return { tag: 'int', value: BigInt(Math.floor(value.value)) };
  }
  throw new TypeMismatchError('string or float', value.tag);
}

function toFloat(args: Value[]): Value {
  const value = getArg(args, 0, 'value');
  if (value.tag === 'string') {
    return { tag: 'float', value: parseFloat(value.value) };
  }
  if (value.tag === 'int') {
    return { tag: 'float', value: Number(value.value) };
  }
  throw new TypeMismatchError('string or int', value.tag);
}

function parseJson(args: Value[]): Value {
  const str = getArg(args, 0, 'str');
  if (str.tag !== 'string') throw new TypeMismatchError('string', str.tag);
  try {
    const parsed = JSON.parse(str.value);
    return jsonToValue(parsed);
  } catch {
    throw new InterpreterError('Invalid JSON');
  }
}

function toJson(args: Value[]): Value {
  const value = getArg(args, 0, 'value');
  return { tag: 'string', value: JSON.stringify(valueToJson(value)) };
}

// ============================================================================
// TIME FUNCTIONS
// ============================================================================

function nowFn(): Value {
  return { tag: 'timestamp', value: new Date() };
}

function todayFn(): Value {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return { tag: 'timestamp', value: today };
}

function parseTimestamp(args: Value[]): Value {
  const str = getArg(args, 0, 'str');
  if (str.tag !== 'string') throw new TypeMismatchError('string', str.tag);
  return { tag: 'timestamp', value: new Date(str.value) };
}

function formatTimestamp(args: Value[]): Value {
  const ts = getArg(args, 0, 'ts');
  // format argument is available but not used in simplified implementation
  if (ts.tag !== 'timestamp') throw new TypeMismatchError('timestamp', ts.tag);
  // Simplified - would use proper date formatting
  return { tag: 'string', value: ts.value.toISOString() };
}

function addDuration(args: Value[]): Value {
  const ts = getArg(args, 0, 'ts');
  const duration = getArg(args, 1, 'duration');
  if (ts.tag !== 'timestamp') throw new TypeMismatchError('timestamp', ts.tag);
  if (duration.tag !== 'duration') throw new TypeMismatchError('duration', duration.tag);
  const ms = durationToMs(duration);
  return { tag: 'timestamp', value: new Date(ts.value.getTime() + ms) };
}

function diffDuration(args: Value[]): Value {
  const ts1 = getArg(args, 0, 'ts1');
  const ts2 = getArg(args, 1, 'ts2');
  if (ts1.tag !== 'timestamp') throw new TypeMismatchError('timestamp', ts1.tag);
  if (ts2.tag !== 'timestamp') throw new TypeMismatchError('timestamp', ts2.tag);
  const ms = Math.abs(ts1.value.getTime() - ts2.value.getTime());
  return { tag: 'duration', value: ms, unit: 'ms' };
}

// ============================================================================
// UUID FUNCTIONS
// ============================================================================

function uuidFn(): Value {
  return { tag: 'uuid', value: crypto.randomUUID() };
}

function uuidV7(): Value {
  // Generate UUIDv7 (time-ordered)
  const timestamp = Date.now();
  const hex = timestamp.toString(16).padStart(12, '0');
  const random = Array.from({ length: 4 }, () =>
    Math.floor(Math.random() * 65536).toString(16).padStart(4, '0')
  ).join('');
  const uuid = `${hex.slice(0, 8)}-${hex.slice(8)}-7${random.slice(0, 3)}-${(8 + Math.floor(Math.random() * 4)).toString(16)}${random.slice(3, 6)}-${random.slice(6)}`;
  return { tag: 'uuid', value: uuid };
}

// ============================================================================
// DEBUG FUNCTIONS
// ============================================================================

function printFn(args: Value[]): Value {
  const value = getArg(args, 0, 'value');
  // Using console.log only for debug purposes
  // eslint-disable-next-line no-console
  console.log(valueToString(value));
  return { tag: 'unit' };
}

function debugFn(args: Value[]): Value {
  const value = getArg(args, 0, 'value');
  console.log(JSON.stringify(value, null, 2));
  return { tag: 'unit' };
}

function assertFn(args: Value[]): Value {
  const condition = getArg(args, 0, 'condition');
  if (condition.tag !== 'boolean') throw new TypeMismatchError('boolean', condition.tag);
  if (!condition.value) {
    const message = args[1];
    const msg = message?.tag === 'string' ? message.value : 'Assertion failed';
    throw new InterpreterError(msg);
  }
  return { tag: 'unit' };
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function compareValues(a: Value, b: Value): number {
  if (a.tag === 'int' && b.tag === 'int') {
    return a.value < b.value ? -1 : a.value > b.value ? 1 : 0;
  }
  if (a.tag === 'float' && b.tag === 'float') {
    return a.value < b.value ? -1 : a.value > b.value ? 1 : 0;
  }
  if (a.tag === 'string' && b.tag === 'string') {
    return a.value.localeCompare(b.value);
  }
  return 0;
}

function valueToString(value: Value): string {
  switch (value.tag) {
    case 'unit': return 'unit';
    case 'boolean': return String(value.value);
    case 'int': return value.value.toString();
    case 'float': return String(value.value);
    case 'string': return value.value;
    case 'uuid': return value.value;
    case 'timestamp': return value.value.toISOString();
    case 'list': return `[${value.elements.map(valueToString).join(', ')}]`;
    case 'map': return `{${Array.from(value.entries.entries()).map(([k, v]) => `${k}: ${valueToString(v)}`).join(', ')}}`;
    case 'record':
    case 'entity':
      return `${value.type}{${Array.from(value.fields.entries()).map(([k, v]) => `${k}: ${valueToString(v)}`).join(', ')}}`;
    default: return `<${value.tag}>`;
  }
}

function valueToJson(value: Value): unknown {
  switch (value.tag) {
    case 'unit': return null;
    case 'boolean': return value.value;
    case 'int': return Number(value.value);
    case 'float': return value.value;
    case 'string': return value.value;
    case 'uuid': return value.value;
    case 'timestamp': return value.value.toISOString();
    case 'list': return value.elements.map(valueToJson);
    case 'map': return Object.fromEntries(Array.from(value.entries.entries()).map(([k, v]) => [k, valueToJson(v)]));
    case 'record':
    case 'entity':
      return Object.fromEntries(Array.from(value.fields.entries()).map(([k, v]) => [k, valueToJson(v)]));
    default: return null;
  }
}

function jsonToValue(json: unknown): Value {
  if (json === null) return { tag: 'option', value: null };
  if (typeof json === 'boolean') return { tag: 'boolean', value: json };
  if (typeof json === 'number') {
    return Number.isInteger(json) ? { tag: 'int', value: BigInt(json) } : { tag: 'float', value: json };
  }
  if (typeof json === 'string') return { tag: 'string', value: json };
  if (Array.isArray(json)) return { tag: 'list', elements: json.map(jsonToValue) };
  if (typeof json === 'object') {
    return { tag: 'map', entries: new Map(Object.entries(json).map(([k, v]) => [k, jsonToValue(v)])) };
  }
  return { tag: 'unit' };
}

function durationToMs(duration: Value): number {
  if (duration.tag !== 'duration') throw new TypeMismatchError('duration', duration.tag);
  const { value, unit } = duration;
  switch (unit) {
    case 'ms': return value;
    case 's': return value * 1000;
    case 'm': return value * 60 * 1000;
    case 'h': return value * 60 * 60 * 1000;
    case 'd': return value * 24 * 60 * 60 * 1000;
    default: return value;
  }
}

// ============================================================================
// BUILT-IN EFFECT HANDLERS
// ============================================================================

export function createBuiltinEffectHandlers(): EffectHandler[] {
  return [
    {
      effect: 'Console',
      operations: new Map<string, NativeFunction>([
        ['print', (args: Value[]) => {
          const msg = getArg(args, 0, 'msg');
          if (msg.tag !== 'string') throw new TypeMismatchError('string', msg.tag);
          // eslint-disable-next-line no-console
          console.log(msg.value);
          return { tag: 'unit' };
        }],
        ['error', (args: Value[]) => {
          const msg = getArg(args, 0, 'msg');
          if (msg.tag !== 'string') throw new TypeMismatchError('string', msg.tag);
          // eslint-disable-next-line no-console
          console.error(msg.value);
          return { tag: 'unit' };
        }],
      ]),
    },
    {
      effect: 'Time',
      operations: new Map<string, NativeFunction>([
        ['now', () => ({ tag: 'timestamp', value: new Date() })],
        ['today', () => {
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          return { tag: 'timestamp', value: today };
        }],
      ]),
    },
    {
      effect: 'Random',
      operations: new Map<string, NativeFunction>([
        ['uuid', () => ({ tag: 'uuid', value: crypto.randomUUID() })],
        ['int', (args: Value[]) => {
          const min = getArg(args, 0, 'min');
          const max = getArg(args, 1, 'max');
          const minVal = min.tag === 'int' ? Number(min.value) : 0;
          const maxVal = max.tag === 'int' ? Number(max.value) : 100;
          return { tag: 'int', value: BigInt(Math.floor(Math.random() * (maxVal - minVal + 1)) + minVal) };
        }],
      ]),
    },
  ];
}
