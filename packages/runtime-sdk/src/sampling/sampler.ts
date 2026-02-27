/**
 * Request Sampling
 * 
 * Utilities for sampling requests for verification.
 */

export interface SamplerOptions {
  /** Base sampling rate (0-1) */
  rate: number;
  /** Sampling strategy */
  strategy?: 'random' | 'deterministic' | 'adaptive';
  /** Seed for deterministic sampling */
  seed?: string;
  /** Minimum samples per time window for adaptive */
  minSamplesPerWindow?: number;
  /** Time window size in ms for adaptive */
  windowSizeMs?: number;
}

/**
 * Request sampler
 * 
 * @example
 * ```typescript
 * const sampler = new Sampler({ rate: 0.1 });
 * 
 * if (sampler.shouldSample()) {
 *   // Verify this request
 * }
 * ```
 */
export class Sampler {
  private options: Required<SamplerOptions>;
  private windowStart: number = Date.now();
  private windowSamples: number = 0;
  private windowTotal: number = 0;

  constructor(options: SamplerOptions) {
    this.options = {
      rate: options.rate,
      strategy: options.strategy ?? 'random',
      seed: options.seed ?? '',
      minSamplesPerWindow: options.minSamplesPerWindow ?? 10,
      windowSizeMs: options.windowSizeMs ?? 60000,
    };
  }

  /**
   * Check if the current request should be sampled
   */
  shouldSample(key?: string): boolean {
    switch (this.options.strategy) {
      case 'deterministic':
        return this.deterministicSample(key);
      case 'adaptive':
        return this.adaptiveSample();
      case 'random':
      default:
        return this.randomSample();
    }
  }

  /**
   * Get current sampling rate (may differ from configured for adaptive)
   */
  getCurrentRate(): number {
    if (this.options.strategy === 'adaptive') {
      return this.getAdaptiveRate();
    }
    return this.options.rate;
  }

  /**
   * Reset sampler state
   */
  reset(): void {
    this.windowStart = Date.now();
    this.windowSamples = 0;
    this.windowTotal = 0;
  }

  /**
   * Random sampling
   */
  private randomSample(): boolean {
    return Math.random() < this.options.rate;
  }

  /**
   * Deterministic sampling based on key hash
   */
  private deterministicSample(key?: string): boolean {
    if (!key) {
      return this.randomSample();
    }

    const hash = this.hashString(this.options.seed + key);
    const threshold = Math.floor(this.options.rate * 0xFFFFFFFF);
    
    return hash < threshold;
  }

  /**
   * Adaptive sampling to maintain minimum samples
   */
  private adaptiveSample(): boolean {
    const now = Date.now();
    
    // Check if we need to start a new window
    if (now - this.windowStart >= this.options.windowSizeMs) {
      this.windowStart = now;
      this.windowSamples = 0;
      this.windowTotal = 0;
    }

    this.windowTotal++;

    // Calculate effective rate
    const effectiveRate = this.getAdaptiveRate();
    const shouldSample = Math.random() < effectiveRate;

    if (shouldSample) {
      this.windowSamples++;
    }

    return shouldSample;
  }

  /**
   * Get adaptive sampling rate
   */
  private getAdaptiveRate(): number {
    const elapsed = Date.now() - this.windowStart;
    const windowProgress = elapsed / this.options.windowSizeMs;
    
    if (windowProgress <= 0) {
      return this.options.rate;
    }

    // If we haven't hit minimum samples, increase rate
    const expectedSamples = this.options.minSamplesPerWindow * windowProgress;
    
    if (this.windowSamples < expectedSamples) {
      // Boost sampling rate to catch up
      const remaining = this.options.windowSizeMs - elapsed;
      const samplesNeeded = this.options.minSamplesPerWindow - this.windowSamples;
      const estimatedRemaining = this.windowTotal * (remaining / elapsed);
      
      if (estimatedRemaining > 0) {
        return Math.min(1, samplesNeeded / estimatedRemaining);
      }
    }

    return this.options.rate;
  }

  /**
   * Simple string hash function
   */
  private hashString(str: string): number {
    let hash = 0;
    
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & 0xFFFFFFFF;
    }
    
    return Math.abs(hash);
  }
}

/**
 * Create a sampler with a specific rate
 */
export function createSampler(rate: number): Sampler {
  return new Sampler({ rate });
}

/**
 * Create a deterministic sampler
 */
export function createDeterministicSampler(rate: number, seed: string): Sampler {
  return new Sampler({ rate, strategy: 'deterministic', seed });
}

/**
 * Create an adaptive sampler
 */
export function createAdaptiveSampler(
  baseRate: number,
  minSamplesPerMinute: number
): Sampler {
  return new Sampler({
    rate: baseRate,
    strategy: 'adaptive',
    minSamplesPerWindow: minSamplesPerMinute,
    windowSizeMs: 60000,
  });
}
