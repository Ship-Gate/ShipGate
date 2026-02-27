// ============================================================================
// ISL Standard Library - CRDTs (Conflict-free Replicated Data Types)
// @isl-lang/stdlib-distributed/crdt
// ============================================================================

// ============================================================================
// TYPES
// ============================================================================

export type NodeId = string;

export interface HybridLogicalClock {
  physical: number;
  logical: number;
  node: NodeId;
}

export type VectorClock = Map<NodeId, number>;

// ============================================================================
// G-COUNTER (Grow-only Counter)
// ============================================================================

export interface GCounter {
  counts: Map<NodeId, number>;
}

export function createGCounter(): GCounter {
  return { counts: new Map() };
}

export function incrementGCounter(counter: GCounter, node: NodeId, amount = 1): GCounter {
  const counts = new Map(counter.counts);
  counts.set(node, (counts.get(node) ?? 0) + amount);
  return { counts };
}

export function valueGCounter(counter: GCounter): number {
  let sum = 0;
  for (const count of counter.counts.values()) {
    sum += count;
  }
  return sum;
}

export function mergeGCounter(a: GCounter, b: GCounter): GCounter {
  const counts = new Map<NodeId, number>();
  
  for (const [node, count] of a.counts) {
    counts.set(node, Math.max(count, b.counts.get(node) ?? 0));
  }
  for (const [node, count] of b.counts) {
    if (!counts.has(node)) {
      counts.set(node, count);
    }
  }
  
  return { counts };
}

// ============================================================================
// PN-COUNTER (Positive-Negative Counter)
// ============================================================================

export interface PNCounter {
  positive: GCounter;
  negative: GCounter;
}

export function createPNCounter(): PNCounter {
  return {
    positive: createGCounter(),
    negative: createGCounter(),
  };
}

export function incrementPNCounter(counter: PNCounter, node: NodeId, amount = 1): PNCounter {
  return {
    ...counter,
    positive: incrementGCounter(counter.positive, node, amount),
  };
}

export function decrementPNCounter(counter: PNCounter, node: NodeId, amount = 1): PNCounter {
  return {
    ...counter,
    negative: incrementGCounter(counter.negative, node, amount),
  };
}

export function valuePNCounter(counter: PNCounter): number {
  return valueGCounter(counter.positive) - valueGCounter(counter.negative);
}

export function mergePNCounter(a: PNCounter, b: PNCounter): PNCounter {
  return {
    positive: mergeGCounter(a.positive, b.positive),
    negative: mergeGCounter(a.negative, b.negative),
  };
}

// ============================================================================
// G-SET (Grow-only Set)
// ============================================================================

export interface GSet<T> {
  elements: Set<T>;
}

export function createGSet<T>(): GSet<T> {
  return { elements: new Set() };
}

export function addGSet<T>(set: GSet<T>, element: T): GSet<T> {
  const elements = new Set(set.elements);
  elements.add(element);
  return { elements };
}

export function containsGSet<T>(set: GSet<T>, element: T): boolean {
  return set.elements.has(element);
}

export function mergeGSet<T>(a: GSet<T>, b: GSet<T>): GSet<T> {
  return { elements: new Set([...a.elements, ...b.elements]) };
}

// ============================================================================
// OR-SET (Observed-Remove Set)
// ============================================================================

export interface ORSet<_T = unknown> {
  elements: Map<string, Set<string>>; // element (serialized) -> set of add tags
  tombstones: Map<string, Set<string>>; // element (serialized) -> set of removed tags
}

export function createORSet<T>(): ORSet<T> {
  return {
    elements: new Map(),
    tombstones: new Map(),
  };
}

export function addORSet<T>(set: ORSet<T>, element: T): ORSet<T> {
  const key = JSON.stringify(element);
  const tag = crypto.randomUUID();
  
  const elements = new Map(set.elements);
  const tags = new Set(elements.get(key) ?? []);
  tags.add(tag);
  elements.set(key, tags);
  
  return { ...set, elements };
}

export function removeORSet<T>(set: ORSet<T>, element: T): ORSet<T> {
  const key = JSON.stringify(element);
  const currentTags = set.elements.get(key);
  
  if (!currentTags) return set;
  
  const tombstones = new Map(set.tombstones);
  const removed = new Set(tombstones.get(key) ?? []);
  for (const tag of currentTags) {
    removed.add(tag);
  }
  tombstones.set(key, removed);
  
  const elements = new Map(set.elements);
  elements.delete(key);
  
  return { elements, tombstones };
}

export function containsORSet<T>(set: ORSet<T>, element: T): boolean {
  const key = JSON.stringify(element);
  const tags = set.elements.get(key);
  if (!tags || tags.size === 0) return false;
  
  const removed = set.tombstones.get(key) ?? new Set();
  for (const tag of tags) {
    if (!removed.has(tag)) return true;
  }
  return false;
}

export function valuesORSet<T>(set: ORSet<T>): T[] {
  const result: T[] = [];
  
  for (const [key, tags] of set.elements) {
    const removed = set.tombstones.get(key) ?? new Set();
    for (const tag of tags) {
      if (!removed.has(tag)) {
        result.push(JSON.parse(key));
        break;
      }
    }
  }
  
  return result;
}

export function mergeORSet<T>(a: ORSet<T>, b: ORSet<T>): ORSet<T> {
  const elements = new Map<string, Set<string>>();
  const tombstones = new Map<string, Set<string>>();
  
  // Merge elements
  for (const [key, tags] of a.elements) {
    elements.set(key, new Set([...tags, ...(b.elements.get(key) ?? [])]));
  }
  for (const [key, tags] of b.elements) {
    if (!elements.has(key)) {
      elements.set(key, new Set(tags));
    }
  }
  
  // Merge tombstones
  for (const [key, tags] of a.tombstones) {
    tombstones.set(key, new Set([...tags, ...(b.tombstones.get(key) ?? [])]));
  }
  for (const [key, tags] of b.tombstones) {
    if (!tombstones.has(key)) {
      tombstones.set(key, new Set(tags));
    }
  }
  
  // Remove tombstoned tags from elements
  for (const [key, tags] of elements) {
    const removed = tombstones.get(key);
    if (removed) {
      for (const tag of removed) {
        tags.delete(tag);
      }
      if (tags.size === 0) {
        elements.delete(key);
      }
    }
  }
  
  return { elements, tombstones };
}

// ============================================================================
// LWW-REGISTER (Last-Write-Wins Register)
// ============================================================================

export interface LWWRegister<T> {
  value: T;
  timestamp: HybridLogicalClock;
}

export function createLWWRegister<T>(value: T, node: NodeId): LWWRegister<T> {
  return {
    value,
    timestamp: { physical: Date.now(), logical: 0, node },
  };
}

export function setLWWRegister<T>(
  register: LWWRegister<T>,
  value: T,
  node: NodeId
): LWWRegister<T> {
  return {
    value,
    timestamp: {
      physical: Date.now(),
      logical: register.timestamp.logical + 1,
      node,
    },
  };
}

export function mergeLWWRegister<T>(
  a: LWWRegister<T>,
  b: LWWRegister<T>
): LWWRegister<T> {
  const cmp = compareHLC(a.timestamp, b.timestamp);
  return cmp >= 0 ? a : b;
}

function compareHLC(a: HybridLogicalClock, b: HybridLogicalClock): number {
  if (a.physical !== b.physical) {
    return a.physical - b.physical;
  }
  if (a.logical !== b.logical) {
    return a.logical - b.logical;
  }
  return a.node.localeCompare(b.node);
}

// ============================================================================
// MV-REGISTER (Multi-Value Register)
// ============================================================================

export interface MVRegister<T> {
  values: Array<{ value: T; clock: VectorClock }>;
}

export function createMVRegister<T>(value: T, node: NodeId): MVRegister<T> {
  const clock: VectorClock = new Map([[node, 1]]);
  return { values: [{ value, clock }] };
}

export function setMVRegister<T>(
  register: MVRegister<T>,
  value: T,
  node: NodeId
): MVRegister<T> {
  // Create new clock that dominates all current values
  const newClock: VectorClock = new Map();
  
  for (const { clock } of register.values) {
    for (const [n, c] of clock) {
      newClock.set(n, Math.max(newClock.get(n) ?? 0, c));
    }
  }
  
  newClock.set(node, (newClock.get(node) ?? 0) + 1);
  
  return { values: [{ value, clock: newClock }] };
}

export function valuesMVRegister<T>(register: MVRegister<T>): T[] {
  return register.values.map(v => v.value);
}

export function mergeMVRegister<T>(
  a: MVRegister<T>,
  b: MVRegister<T>
): MVRegister<T> {
  const allValues = [...a.values, ...b.values];
  const result: Array<{ value: T; clock: VectorClock }> = [];
  
  for (const v of allValues) {
    // Check if this value is dominated by any other
    let dominated = false;
    
    for (const other of allValues) {
      if (v !== other && dominates(other.clock, v.clock)) {
        dominated = true;
        break;
      }
    }
    
    if (!dominated) {
      // Check if we already have this clock
      const existing = result.find(r => clocksEqual(r.clock, v.clock));
      if (!existing) {
        result.push(v);
      }
    }
  }
  
  return { values: result };
}

function dominates(a: VectorClock, b: VectorClock): boolean {
  let dominated = false;
  
  for (const [node, count] of b) {
    const aCount = a.get(node) ?? 0;
    if (aCount < count) return false;
    if (aCount > count) dominated = true;
  }
  
  for (const [node, count] of a) {
    if (!b.has(node) && count > 0) dominated = true;
  }
  
  return dominated;
}

function clocksEqual(a: VectorClock, b: VectorClock): boolean {
  if (a.size !== b.size) return false;
  for (const [node, count] of a) {
    if (b.get(node) !== count) return false;
  }
  return true;
}

// ============================================================================
// VECTOR CLOCK OPERATIONS
// ============================================================================

export function createVectorClock(): VectorClock {
  return new Map();
}

export function incrementVectorClock(clock: VectorClock, node: NodeId): VectorClock {
  const result = new Map(clock);
  result.set(node, (result.get(node) ?? 0) + 1);
  return result;
}

export function mergeVectorClocks(a: VectorClock, b: VectorClock): VectorClock {
  const result = new Map<NodeId, number>();
  
  for (const [node, count] of a) {
    result.set(node, Math.max(count, b.get(node) ?? 0));
  }
  for (const [node, count] of b) {
    if (!result.has(node)) {
      result.set(node, count);
    }
  }
  
  return result;
}

export function compareVectorClocks(
  a: VectorClock,
  b: VectorClock
): 'before' | 'after' | 'concurrent' | 'equal' {
  let aGreater = false;
  let bGreater = false;
  
  for (const [node, countA] of a) {
    const countB = b.get(node) ?? 0;
    if (countA > countB) aGreater = true;
    if (countA < countB) bGreater = true;
  }
  
  for (const [node, countB] of b) {
    if (!a.has(node) && countB > 0) bGreater = true;
  }
  
  if (aGreater && !bGreater) return 'after';
  if (bGreater && !aGreater) return 'before';
  if (!aGreater && !bGreater) return 'equal';
  return 'concurrent';
}

// ============================================================================
// HYBRID LOGICAL CLOCK OPERATIONS
// ============================================================================

export function createHLC(node: NodeId): HybridLogicalClock {
  return { physical: Date.now(), logical: 0, node };
}

export function tickHLC(clock: HybridLogicalClock): HybridLogicalClock {
  const physical = Date.now();
  if (physical > clock.physical) {
    return { physical, logical: 0, node: clock.node };
  }
  return { physical: clock.physical, logical: clock.logical + 1, node: clock.node };
}

export function receiveHLC(
  local: HybridLogicalClock,
  remote: HybridLogicalClock
): HybridLogicalClock {
  const physical = Date.now();
  
  if (physical > local.physical && physical > remote.physical) {
    return { physical, logical: 0, node: local.node };
  }
  
  if (local.physical === remote.physical) {
    return {
      physical: local.physical,
      logical: Math.max(local.logical, remote.logical) + 1,
      node: local.node,
    };
  }
  
  if (local.physical > remote.physical) {
    return { physical: local.physical, logical: local.logical + 1, node: local.node };
  }
  
  return { physical: remote.physical, logical: remote.logical + 1, node: local.node };
}
