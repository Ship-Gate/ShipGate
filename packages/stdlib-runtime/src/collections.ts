/**
 * ISL Standard Library - Collections Module
 * Provides List and Map operations
 * 
 * DETERMINISM: 100% deterministic - all functions produce same output for same input
 * Sort operations use stable sorting algorithm
 */

// ============================================
// Types
// ============================================

export type SortOrder = 'ASC' | 'DESC';
export type CompareResult = -1 | 0 | 1;
export type CompareFn<T> = (a: T, b: T) => CompareResult;
export type PredicateFn<T> = (item: T) => boolean;
export type MapFn<T, U> = (item: T) => U;
export type ReduceFn<T, U> = (acc: U, item: T) => U;
export type KeyFn<T, K> = (item: T) => K;

export interface KeyValuePair<K, V> {
  key: K;
  value: V;
}

export interface IndexedValue<T> {
  index: number;
  value: T;
}

export interface GroupedResult<K, V> {
  key: K;
  values: V[];
}

// ============================================
// List Basic Operations
// ============================================

export function length<T>(list: T[]): number {
  return list.length;
}

export function isEmpty<T>(list: T[]): boolean {
  return list.length === 0;
}

export function first<T>(list: T[]): T | null {
  return list.length > 0 ? list[0]! : null;
}

export function last<T>(list: T[]): T | null {
  return list.length > 0 ? list[list.length - 1]! : null;
}

export function get<T>(list: T[], index: number): T {
  if (index < 0 || index >= list.length) {
    throw new Error('INDEX_OUT_OF_BOUNDS: Index is outside list bounds');
  }
  return list[index]!;
}

// ============================================
// List Transformation
// ============================================

export function map<T, U>(list: T[], transform: MapFn<T, U>): U[] {
  return list.map(transform);
}

export function filter<T>(list: T[], predicate: PredicateFn<T>): T[] {
  return list.filter(predicate);
}

export function reduce<T, U>(list: T[], reducer: ReduceFn<T, U>, initial: U): U {
  return list.reduce(reducer, initial);
}

export function flatMap<T, U>(list: T[], transform: (item: T) => U[]): U[] {
  return list.flatMap(transform);
}

// ============================================
// List Search
// ============================================

export function find<T>(list: T[], predicate: PredicateFn<T>): T | null {
  const found = list.find(predicate);
  return found !== undefined ? found : null;
}

export function findIndex<T>(list: T[], predicate: PredicateFn<T>): number {
  return list.findIndex(predicate);
}

export function findLast<T>(list: T[], predicate: PredicateFn<T>): T | null {
  for (let i = list.length - 1; i >= 0; i--) {
    const item = list[i]!;
    if (predicate(item)) {
      return item;
    }
  }
  return null;
}

export function findLastIndex<T>(list: T[], predicate: PredicateFn<T>): number {
  for (let i = list.length - 1; i >= 0; i--) {
    if (predicate(list[i]!)) {
      return i;
    }
  }
  return -1;
}

export function indexOf<T>(list: T[], value: T, startIndex = 0): number {
  for (let i = startIndex; i < list.length; i++) {
    if (list[i] === value) {
      return i;
    }
  }
  return -1;
}

export function includes<T>(list: T[], value: T): boolean {
  return list.includes(value);
}

// ============================================
// List Testing
// ============================================

export function every<T>(list: T[], predicate: PredicateFn<T>): boolean {
  return list.every(predicate);
}

export function some<T>(list: T[], predicate: PredicateFn<T>): boolean {
  return list.some(predicate);
}

export function none<T>(list: T[], predicate: PredicateFn<T>): boolean {
  return !some(list, predicate);
}

// ============================================
// List Slicing
// ============================================

export function take<T>(list: T[], count: number): T[] {
  return list.slice(0, Math.max(0, count));
}

export function takeWhile<T>(list: T[], predicate: PredicateFn<T>): T[] {
  const result: T[] = [];
  for (const item of list) {
    if (!predicate(item)) break;
    result.push(item);
  }
  return result;
}

export function drop<T>(list: T[], count: number): T[] {
  return list.slice(Math.max(0, count));
}

export function dropWhile<T>(list: T[], predicate: PredicateFn<T>): T[] {
  let startIndex = 0;
  for (let i = 0; i < list.length; i++) {
    if (!predicate(list[i]!)) {
      startIndex = i;
      break;
    }
    startIndex = list.length;
  }
  return list.slice(startIndex);
}

export function slice<T>(list: T[], start: number, end?: number): T[] {
  return list.slice(start, end);
}

// ============================================
// List Combination
// ============================================

export function concat<T>(first: T[], second: T[]): T[] {
  return [...first, ...second];
}

export function flatten<T>(list: T[][], depth = 1): T[] {
  if (depth < 1) return list as unknown as T[];
  return list.flat(depth) as T[];
}

export function zip<T, U>(first: T[], second: U[]): Array<{ first: T; second: U }> {
  const len = Math.min(first.length, second.length);
  const result: Array<{ first: T; second: U }> = [];
  for (let i = 0; i < len; i++) {
    result.push({ first: first[i]!, second: second[i]! });
  }
  return result;
}

export function unzip<T, U>(pairs: Array<{ first: T; second: U }>): { first: T[]; second: U[] } {
  const firstArr: T[] = [];
  const secondArr: U[] = [];
  for (const pair of pairs) {
    firstArr.push(pair.first);
    secondArr.push(pair.second);
  }
  return { first: firstArr, second: secondArr };
}

// ============================================
// List Modification
// ============================================

export function reverse<T>(list: T[]): T[] {
  return [...list].reverse();
}

// Stable sort implementation
function stableSort<T>(arr: T[], compare: CompareFn<T>): T[] {
  const indexed = arr.map((item, index) => ({ item, index }));
  indexed.sort((a, b) => {
    const result = compare(a.item, b.item);
    if (result !== 0) return result;
    return a.index - b.index; // Stable sort tie-breaker
  });
  return indexed.map(({ item }) => item);
}

export function sort<T>(list: T[], order: SortOrder = 'ASC'): T[] {
  const compare: CompareFn<T> = (a, b) => {
    if (a < b) return order === 'ASC' ? -1 : 1;
    if (a > b) return order === 'ASC' ? 1 : -1;
    return 0;
  };
  return stableSort(list, compare);
}

export function sortBy<T, K>(list: T[], keyFn: KeyFn<T, K>, order: SortOrder = 'ASC'): T[] {
  const compare: CompareFn<T> = (a, b) => {
    const ka = keyFn(a);
    const kb = keyFn(b);
    if (ka < kb) return order === 'ASC' ? -1 : 1;
    if (ka > kb) return order === 'ASC' ? 1 : -1;
    return 0;
  };
  return stableSort(list, compare);
}

export function sortWith<T>(list: T[], compare: CompareFn<T>): T[] {
  return stableSort(list, compare);
}

export function unique<T>(list: T[]): T[] {
  return [...new Set(list)];
}

export function uniqueBy<T, K>(list: T[], keyFn: KeyFn<T, K>): T[] {
  const seen = new Set<K>();
  const result: T[] = [];
  for (const item of list) {
    const key = keyFn(item);
    if (!seen.has(key)) {
      seen.add(key);
      result.push(item);
    }
  }
  return result;
}

// ============================================
// List Grouping
// ============================================

export function chunk<T>(list: T[], size: number): T[][] {
  if (size < 1) {
    throw new Error('Size must be at least 1');
  }
  const result: T[][] = [];
  for (let i = 0; i < list.length; i += size) {
    result.push(list.slice(i, i + size));
  }
  return result;
}

export function groupBy<T, K>(list: T[], keyFn: KeyFn<T, K>): GroupedResult<K, T>[] {
  const groups = new Map<K, T[]>();
  for (const item of list) {
    const key = keyFn(item);
    const group = groups.get(key);
    if (group) {
      group.push(item);
    } else {
      groups.set(key, [item]);
    }
  }
  return Array.from(groups.entries()).map(([key, values]) => ({ key, values }));
}

export function partition<T>(list: T[], predicate: PredicateFn<T>): { matching: T[]; not_matching: T[] } {
  const matching: T[] = [];
  const not_matching: T[] = [];
  for (const item of list) {
    if (predicate(item)) {
      matching.push(item);
    } else {
      not_matching.push(item);
    }
  }
  return { matching, not_matching };
}

// ============================================
// Map Operations
// ============================================

export function mapGet<K, V>(map: Map<K, V>, key: K, defaultValue?: V): V | undefined {
  return map.has(key) ? map.get(key) : defaultValue;
}

export function mapSet<K, V>(map: Map<K, V>, key: K, value: V): Map<K, V> {
  const newMap = new Map(map);
  newMap.set(key, value);
  return newMap;
}

export function mapRemove<K, V>(map: Map<K, V>, key: K): Map<K, V> {
  const newMap = new Map(map);
  newMap.delete(key);
  return newMap;
}

export function mapHas<K, V>(map: Map<K, V>, key: K): boolean {
  return map.has(key);
}

export function mapKeys<K, V>(map: Map<K, V>): K[] {
  return Array.from(map.keys());
}

export function mapValues<K, V>(map: Map<K, V>): V[] {
  return Array.from(map.values());
}

export function mapEntries<K, V>(map: Map<K, V>): KeyValuePair<K, V>[] {
  return Array.from(map.entries()).map(([key, value]) => ({ key, value }));
}

export function mapSize<K, V>(map: Map<K, V>): number {
  return map.size;
}

export function mapMerge<K, V>(first: Map<K, V>, second: Map<K, V>): Map<K, V> {
  return new Map([...first, ...second]);
}

export function mapPick<K, V>(map: Map<K, V>, keys: K[]): Map<K, V> {
  const result = new Map<K, V>();
  for (const key of keys) {
    if (map.has(key)) {
      result.set(key, map.get(key)!);
    }
  }
  return result;
}

export function mapOmit<K, V>(map: Map<K, V>, keys: K[]): Map<K, V> {
  const keysSet = new Set(keys);
  const result = new Map<K, V>();
  for (const [key, value] of map) {
    if (!keysSet.has(key)) {
      result.set(key, value);
    }
  }
  return result;
}

export function mapMapValues<K, V, U>(map: Map<K, V>, transform: MapFn<V, U>): Map<K, U> {
  const result = new Map<K, U>();
  for (const [key, value] of map) {
    result.set(key, transform(value));
  }
  return result;
}

export function mapFilterValues<K, V>(map: Map<K, V>, predicate: PredicateFn<V>): Map<K, V> {
  const result = new Map<K, V>();
  for (const [key, value] of map) {
    if (predicate(value)) {
      result.set(key, value);
    }
  }
  return result;
}

export function fromEntries<K, V>(entries: KeyValuePair<K, V>[]): Map<K, V> {
  return new Map(entries.map(({ key, value }) => [key, value]));
}

// ============================================
// Set Operations
// ============================================

export function union<T>(first: T[], second: T[]): T[] {
  return [...new Set([...first, ...second])];
}

export function intersection<T>(first: T[], second: T[]): T[] {
  const secondSet = new Set(second);
  return unique(first.filter(item => secondSet.has(item)));
}

export function difference<T>(first: T[], second: T[]): T[] {
  const secondSet = new Set(second);
  return first.filter(item => !secondSet.has(item));
}

export function symmetricDifference<T>(first: T[], second: T[]): T[] {
  const firstSet = new Set(first);
  const secondSet = new Set(second);
  const result: T[] = [];
  for (const item of first) {
    if (!secondSet.has(item)) result.push(item);
  }
  for (const item of second) {
    if (!firstSet.has(item)) result.push(item);
  }
  return unique(result);
}

// ============================================
// Utility
// ============================================

export function range(start: number, end: number, step = 1): number[] {
  if (step === 0) {
    throw new Error('INVALID_STEP: Step is zero');
  }
  const result: number[] = [];
  if (step > 0) {
    for (let i = start; i < end; i += step) {
      result.push(i);
    }
  } else {
    for (let i = start; i > end; i += step) {
      result.push(i);
    }
  }
  return result;
}

export function repeat<T>(value: T, count: number): T[] {
  if (count < 0) {
    throw new Error('Count must be non-negative');
  }
  return Array(count).fill(value);
}

export function withIndex<T>(list: T[]): IndexedValue<T>[] {
  return list.map((value, index) => ({ index, value }));
}

export function count<T>(list: T[], predicate: PredicateFn<T>): number {
  return filter(list, predicate).length;
}

// ============================================
// Constants
// ============================================

export const EMPTY_LIST: never[] = [];
export const EMPTY_MAP = new Map();

// ============================================
// Default Export
// ============================================

export const Collections = {
  length,
  isEmpty,
  first,
  last,
  get,
  map,
  filter,
  reduce,
  flatMap,
  find,
  findIndex,
  findLast,
  findLastIndex,
  indexOf,
  includes,
  every,
  some,
  none,
  take,
  takeWhile,
  drop,
  dropWhile,
  slice,
  concat,
  flatten,
  zip,
  unzip,
  reverse,
  sort,
  sortBy,
  sortWith,
  unique,
  uniqueBy,
  chunk,
  groupBy,
  partition,
  mapGet,
  mapSet,
  mapRemove,
  mapHas,
  mapKeys,
  mapValues,
  mapEntries,
  mapSize,
  mapMerge,
  mapPick,
  mapOmit,
  mapMapValues,
  mapFilterValues,
  fromEntries,
  union,
  intersection,
  difference,
  symmetricDifference,
  range,
  repeat,
  withIndex,
  count,
  EMPTY_LIST,
  EMPTY_MAP,
};

export default Collections;
