import { Random } from '../types';
import { BloomFilterOptions } from './types';
import { createHash } from 'crypto';

/**
 * Simple Bloom filter implementation
 */
export class BloomFilter {
  private bitArray: Uint8Array;
  private hashCount: number;
  private bitCount: number;
  private size: number;

  constructor(
    private options: BloomFilterOptions,
    private random: Random
  ) {
    // Calculate optimal size and hash count
    this.size = this.calculateSize(options.expectedItems, options.falsePositiveRate);
    this.hashCount = this.calculateHashCount(this.size, options.expectedItems);
    this.bitCount = this.size * 8;
    
    // Initialize bit array
    this.bitArray = new Uint8Array(this.size);
  }

  /**
   * Add an item to the filter
   */
  add(item: string): void {
    const hashes = this.getHashes(item);
    
    for (const hash of hashes) {
      const index = hash % this.bitCount;
      const byteIndex = Math.floor(index / 8);
      const bitIndex = index % 8;
      
      this.bitArray[byteIndex] |= (1 << bitIndex);
    }
  }

  /**
   * Check if item might exist in filter
   */
  mightContain(item: string): boolean {
    const hashes = this.getHashes(item);
    
    for (const hash of hashes) {
      const index = hash % this.bitCount;
      const byteIndex = Math.floor(index / 8);
      const bitIndex = index % 8;
      
      if ((this.bitArray[byteIndex] & (1 << bitIndex)) === 0) {
        return false;
      }
    }
    
    return true;
  }

  /**
   * Get current false positive rate
   */
  getCurrentFalsePositiveRate(): number {
    let setBits = 0;
    
    for (const byte of this.bitArray) {
      setBits += this.countSetBits(byte);
    }
    
    const ratio = setBits / this.bitCount;
    return Math.pow(ratio, this.hashCount);
  }

  /**
   * Clear the filter
   */
  clear(): void {
    this.bitArray.fill(0);
  }

  /**
   * Get filter statistics
   */
  stats() {
    return {
      size: this.size,
      bitCount: this.bitCount,
      hashCount: this.hashCount,
      currentFalsePositiveRate: this.getCurrentFalsePositiveRate(),
      expectedFalsePositiveRate: this.options.falsePositiveRate
    };
  }

  /**
   * Calculate optimal filter size
   */
  private calculateSize(expectedItems: number, falsePositiveRate: number): number {
    const size = -((expectedItems * Math.log(falsePositiveRate)) / (Math.log(2) * Math.log(2)));
    return Math.ceil(size / 8);
  }

  /**
   * Calculate optimal hash count
   */
  private calculateHashCount(size: number, expectedItems: number): number {
    const bitCount = size * 8;
    return Math.max(1, Math.ceil((bitCount / expectedItems) * Math.log(2)));
  }

  /**
   * Generate hash values for item
   */
  private getHashes(item: string): number[] {
    const hashes: number[] = [];
    const seed = this.options.seed || 0;
    
    // Use double hashing technique
    const hash1 = this.hash(item, seed);
    const hash2 = this.hash(item, seed + 1);
    
    for (let i = 0; i < this.hashCount; i++) {
      hashes.push(Math.abs(hash1 + i * hash2));
    }
    
    return hashes;
  }

  /**
   * Simple hash function
   */
  private hash(item: string, seed: number): number {
    const data = `${seed}:${item}`;
    const hash = createHash('sha256').update(data).digest('hex');
    
    // Use first 8 characters as number
    return parseInt(hash.substring(0, 8), 16);
  }

  /**
   * Count set bits in a byte
   */
  private countSetBits(byte: number): number {
    let count = 0;
    while (byte) {
      count += byte & 1;
      byte >>= 1;
    }
    return count;
  }
}
