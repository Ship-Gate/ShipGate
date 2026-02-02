// ============================================================================
// Corpus Management
// Manage fuzz input corpus with deduplication and prioritization
// ============================================================================

import { 
  CorpusEntry, 
  CorpusStats, 
  FuzzCategory,
} from './types.js';

/**
 * Corpus manager for fuzzing
 */
export class Corpus {
  private entries: Map<string, CorpusEntry> = new Map();
  private maxSize: number;
  private seed: string;

  constructor(options: { maxSize?: number; seed?: string } = {}) {
    this.maxSize = options.maxSize ?? 10000;
    this.seed = options.seed ?? Date.now().toString();
  }

  /**
   * Add an entry to the corpus
   */
  add(
    input: unknown,
    category: FuzzCategory,
    coverageBits?: Set<string>,
    causedCrash: boolean = false
  ): boolean {
    const id = this.computeId(input);
    
    // Check for duplicate
    if (this.entries.has(id)) {
      // Update existing entry
      const existing = this.entries.get(id)!;
      existing.mutationCount++;
      if (causedCrash) {
        existing.causedCrash = true;
        existing.energy *= 2;
      }
      return false;
    }

    // Check size limit
    if (this.entries.size >= this.maxSize) {
      this.evict();
    }

    // Add new entry
    const entry: CorpusEntry = {
      input,
      category,
      coverageBits,
      causedCrash,
      energy: this.computeInitialEnergy(category, coverageBits, causedCrash),
      mutationCount: 0,
      addedAt: Date.now(),
    };

    this.entries.set(id, entry);
    return true;
  }

  /**
   * Get all entries
   */
  getAll(): CorpusEntry[] {
    return Array.from(this.entries.values());
  }

  /**
   * Get entries by category
   */
  getByCategory(category: FuzzCategory): CorpusEntry[] {
    return this.getAll().filter(e => e.category === category);
  }

  /**
   * Get crash-inducing entries
   */
  getCrashInducing(): CorpusEntry[] {
    return this.getAll().filter(e => e.causedCrash);
  }

  /**
   * Get high-energy entries for mutation
   */
  getHighEnergy(count: number): CorpusEntry[] {
    return this.getAll()
      .sort((a, b) => b.energy - a.energy)
      .slice(0, count);
  }

  /**
   * Get statistics
   */
  getStats(): CorpusStats {
    const all = this.getAll();
    const byCategory: Record<FuzzCategory, number> = {} as Record<FuzzCategory, number>;
    
    for (const entry of all) {
      byCategory[entry.category] = (byCategory[entry.category] ?? 0) + 1;
    }

    return {
      size: all.length,
      coverageIncreasing: all.filter(e => e.coverageBits && e.coverageBits.size > 0).length,
      byCategory,
      crashInducing: all.filter(e => e.causedCrash).length,
    };
  }

  /**
   * Update entry energy
   */
  updateEnergy(input: unknown, newEnergy: number): void {
    const id = this.computeId(input);
    const entry = this.entries.get(id);
    if (entry) {
      entry.energy = newEnergy;
    }
  }

  /**
   * Mark entry as used for mutation
   */
  markMutated(input: unknown): void {
    const id = this.computeId(input);
    const entry = this.entries.get(id);
    if (entry) {
      entry.mutationCount++;
      // Decay energy
      entry.energy *= 0.95;
    }
  }

  /**
   * Clear the corpus
   */
  clear(): void {
    this.entries.clear();
  }

  /**
   * Export corpus for saving
   */
  export(): SerializedCorpus {
    const entries = Array.from(this.entries.entries()).map(([id, entry]) => ({
      id,
      input: this.serializeInput(entry.input),
      category: entry.category,
      causedCrash: entry.causedCrash,
      energy: entry.energy,
      mutationCount: entry.mutationCount,
      addedAt: entry.addedAt,
    }));

    return {
      version: 1,
      seed: this.seed,
      entries,
    };
  }

  /**
   * Import corpus from saved data
   */
  import(data: SerializedCorpus): void {
    for (const entry of data.entries) {
      try {
        const input = this.deserializeInput(entry.input);
        const corpusEntry: CorpusEntry = {
          input,
          category: entry.category,
          causedCrash: entry.causedCrash,
          energy: entry.energy,
          mutationCount: entry.mutationCount,
          addedAt: entry.addedAt,
        };
        this.entries.set(entry.id, corpusEntry);
      } catch {
        // Skip invalid entries
      }
    }
  }

  /**
   * Compute unique ID for input
   */
  private computeId(input: unknown): string {
    try {
      const str = JSON.stringify(input, this.jsonReplacer);
      return this.hash(str);
    } catch {
      // For circular references or non-serializable
      return this.hash(String(input) + Math.random());
    }
  }

  /**
   * JSON replacer for special values
   */
  private jsonReplacer(_key: string, value: unknown): unknown {
    if (value === undefined) return '__undefined__';
    if (typeof value === 'number') {
      if (Number.isNaN(value)) return '__NaN__';
      if (value === Infinity) return '__Infinity__';
      if (value === -Infinity) return '__-Infinity__';
    }
    if (typeof value === 'bigint') return `__bigint__${value}`;
    return value;
  }

  /**
   * Simple hash function
   */
  private hash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return `corpus_${Math.abs(hash).toString(16)}`;
  }

  /**
   * Compute initial energy for entry
   */
  private computeInitialEnergy(
    category: FuzzCategory,
    coverageBits?: Set<string>,
    causedCrash?: boolean
  ): number {
    let energy = 10;

    // Boost based on category
    switch (category) {
      case 'boundary':
        energy += 5;
        break;
      case 'injection':
        energy += 10;
        break;
      case 'security':
        energy += 15;
        break;
      case 'mutation':
        energy += 3;
        break;
    }

    // Boost for coverage
    if (coverageBits && coverageBits.size > 0) {
      energy += coverageBits.size * 2;
    }

    // Boost for crashes
    if (causedCrash) {
      energy *= 3;
    }

    return energy;
  }

  /**
   * Evict low-priority entries when at capacity
   */
  private evict(): void {
    // Sort by energy (lowest first)
    const sorted = Array.from(this.entries.entries())
      .sort((a, b) => a[1].energy - b[1].energy);

    // Remove lowest energy entries (keep 90% capacity)
    const toRemove = Math.floor(this.maxSize * 0.1);
    for (let i = 0; i < toRemove && i < sorted.length; i++) {
      const entry = sorted[i]!;
      // Don't evict crash-inducing entries
      if (!entry[1].causedCrash) {
        this.entries.delete(entry[0]);
      }
    }
  }

  /**
   * Serialize input for storage
   */
  private serializeInput(input: unknown): string {
    try {
      return JSON.stringify(input, this.jsonReplacer);
    } catch {
      return String(input);
    }
  }

  /**
   * Deserialize input from storage
   */
  private deserializeInput(data: string): unknown {
    try {
      return JSON.parse(data, (_key, value) => {
        if (value === '__undefined__') return undefined;
        if (value === '__NaN__') return NaN;
        if (value === '__Infinity__') return Infinity;
        if (value === '__-Infinity__') return -Infinity;
        if (typeof value === 'string' && value.startsWith('__bigint__')) {
          return BigInt(value.slice(10));
        }
        return value;
      });
    } catch {
      return data;
    }
  }
}

/**
 * Serialized corpus format
 */
export interface SerializedCorpus {
  version: number;
  seed: string;
  entries: SerializedEntry[];
}

/**
 * Serialized entry format
 */
export interface SerializedEntry {
  id: string;
  input: string;
  category: FuzzCategory;
  causedCrash: boolean;
  energy: number;
  mutationCount: number;
  addedAt: number;
}

/**
 * Create corpus from seed inputs
 */
export function createCorpusFromSeeds(seeds: unknown[], category: FuzzCategory = 'valid'): Corpus {
  const corpus = new Corpus();
  for (const seed of seeds) {
    corpus.add(seed, category);
  }
  return corpus;
}
