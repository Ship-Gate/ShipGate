/**
 * Bloom filter with enforced maximum false-positive rate.
 * Used for safe "might contain" checks to avoid cross-scan poisoning when
 * combined with per-context instances.
 */

import { createHash } from 'node:crypto';

/** Default maximum false-positive rate (1%) */
const DEFAULT_MAX_FALSE_POSITIVE_RATE = 0.01;

/** Absolute maximum FPR we allow (5%) */
const ABSOLUTE_MAX_FPR = 0.05;

/** Minimum number of bits per element for stability */
const MIN_BITS_PER_ELEMENT = 8;

export interface BloomFilterOptions {
  /** Maximum allowed false-positive rate (e.g. 0.01 = 1%). Enforced by capping capacity. */
  maxFalsePositiveRate?: number;
  /** Expected number of elements. Filter is sized so FPR ≤ max at this capacity. */
  expectedCapacity: number;
  /** Optional seed for hash functions (for reproducibility). */
  seed?: string;
}

/**
 * Compute optimal number of bits (m) for given n and target FPR.
 * m = -n * ln(p) / (ln(2))^2
 */
function optimalBits(n: number, p: number): number {
  if (p <= 0 || p >= 1 || n <= 0) return MIN_BITS_PER_ELEMENT * n;
  const ln2 = Math.LN2;
  const m = (-n * Math.log(p)) / (ln2 * ln2);
  return Math.max(Math.ceil(m), n * MIN_BITS_PER_ELEMENT);
}

/**
 * Compute optimal number of hash functions (k).
 * k = (m/n) * ln(2)
 */
function optimalHashCount(m: number, n: number): number {
  if (n <= 0) return 1;
  const k = (m / n) * Math.LN2;
  return Math.max(1, Math.min(Math.ceil(k), 32));
}

/**
 * Estimate current false-positive rate given m, k, n.
 * p ≈ (1 - e^(-k*n/m))^k
 */
export function estimatedFalsePositiveRate(
  bits: number,
  hashCount: number,
  elementCount: number
): number {
  if (elementCount <= 0) return 0;
  const m = bits;
  const n = elementCount;
  const k = hashCount;
  const exponent = (-k * n) / m;
  return Math.pow(1 - Math.exp(exponent), k);
}

/**
 * Bloom filter with configurable max false-positive rate.
 * Add is rejected when adding would exceed max FPR (capacity enforced).
 */
export class BloomFilter {
  private readonly bits: Uint8Array;
  private readonly bitCount: number;
  private readonly hashCount: number;
  private readonly maxFalsePositiveRate: number;
  private readonly maxCapacity: number;
  private readonly seed: string;
  private size = 0;

  constructor(options: BloomFilterOptions) {
    const maxFpr = Math.min(
      Math.max(options.maxFalsePositiveRate ?? DEFAULT_MAX_FALSE_POSITIVE_RATE, 1e-6),
      ABSOLUTE_MAX_FPR
    );
    const n = Math.max(1, options.expectedCapacity);
    this.maxFalsePositiveRate = maxFpr;
    this.maxCapacity = n;
    this.seed = options.seed ?? 'bloom-v1';
    this.bitCount = optimalBits(n, maxFpr);
    this.hashCount = optimalHashCount(this.bitCount, n);
    const byteCount = Math.ceil(this.bitCount / 8);
    this.bits = new Uint8Array(byteCount);
  }

  /**
   * Hash an item to multiple bit indices using double hashing.
   * Uses SHA-256(seed || item) for stability and good distribution.
   */
  private getIndices(item: string): number[] {
    const indices: number[] = [];
    const h = createHash('sha256')
      .update(this.seed, 'utf8')
      .update(item, 'utf8')
      .digest();
    let h1 = 0;
    let h2 = 0;
    for (let i = 0; i < 4; i++) {
      h1 = (h1 << 8) | h[i];
      h2 = (h2 << 8) | h[i + 4];
    }
    h1 = Math.abs(h1) >>> 0;
    h2 = Math.abs(h2) >>> 0;
    for (let i = 0; i < this.hashCount; i++) {
      const idx = (h1 + i * h2) % this.bitCount;
      indices.push(idx);
    }
    return indices;
  }

  private setBit(index: number): void {
    const byte = Math.floor(index / 8);
    const bit = index % 8;
    this.bits[byte] |= 1 << bit;
  }

  private getBit(index: number): boolean {
    const byte = Math.floor(index / 8);
    const bit = index % 8;
    return (this.bits[byte] & (1 << bit)) !== 0;
  }

  /**
   * Add an item. Returns false if adding would exceed max FPR (capacity full).
   */
  add(item: string): boolean {
    if (this.size >= this.maxCapacity) {
      return false;
    }
    const indices = this.getIndices(item);
    for (const i of indices) {
      this.setBit(i);
    }
    this.size++;
    return true;
  }

  /**
   * Check if item might be present. True = possibly in set, False = definitely not.
   */
  mightContain(item: string): boolean {
    const indices = this.getIndices(item);
    return indices.every((i) => this.getBit(i));
  }

  /**
   * Current number of elements added.
   */
  get elementCount(): number {
    return this.size;
  }

  /**
   * Maximum capacity (adds beyond this are rejected to keep FPR bounded).
   */
  get capacity(): number {
    return this.maxCapacity;
  }

  /**
   * Estimated current false-positive rate.
   */
  get estimatedFpr(): number {
    return estimatedFalsePositiveRate(this.bitCount, this.hashCount, this.size);
  }

  /**
   * Maximum allowed false-positive rate (config).
   */
  get maxFpr(): number {
    return this.maxFalsePositiveRate;
  }

  /**
   * Clear the filter (same capacity and FPR limits).
   */
  clear(): void {
    this.bits.fill(0);
    this.size = 0;
  }

  /**
   * Check whether adding one more element would exceed max FPR.
   */
  isFull(): boolean {
    return this.size >= this.maxCapacity;
  }
}
