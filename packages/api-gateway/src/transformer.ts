/**
 * Response Transformer
 * 
 * Transform responses according to ISL specifications.
 */

export interface TransformOptions {
  /** Include metadata in response */
  includeMetadata?: boolean;
  /** Wrap response in envelope */
  envelope?: boolean;
  /** Field mapping */
  fieldMapping?: Record<string, string>;
  /** Fields to exclude */
  exclude?: string[];
  /** Default values */
  defaults?: Record<string, unknown>;
}

export interface TransformResult {
  /** Transformed data */
  data: unknown;
  /** Response headers */
  headers?: Record<string, string>;
  /** Transformation applied */
  transformations?: string[];
}

/**
 * Response Transformer
 */
export class ResponseTransformer {
  private transformers = new Map<string, TransformOptions>();

  /**
   * Register transformation options for a behavior
   */
  register(domain: string, behavior: string, options: TransformOptions): void {
    this.transformers.set(`${domain}.${behavior}`, options);
  }

  /**
   * Transform a response
   */
  async transform(
    domain: string,
    behavior: string,
    data: unknown
  ): Promise<TransformResult> {
    const options = this.transformers.get(`${domain}.${behavior}`);
    const transformations: string[] = [];

    let result = data;

    // Apply field exclusions
    if (options?.exclude && typeof result === 'object' && result !== null) {
      result = this.excludeFields(result as Record<string, unknown>, options.exclude);
      transformations.push('exclude');
    }

    // Apply field mapping
    if (options?.fieldMapping && typeof result === 'object' && result !== null) {
      result = this.mapFields(result as Record<string, unknown>, options.fieldMapping);
      transformations.push('fieldMapping');
    }

    // Apply defaults
    if (options?.defaults && typeof result === 'object' && result !== null) {
      result = this.applyDefaults(result as Record<string, unknown>, options.defaults);
      transformations.push('defaults');
    }

    // Wrap in envelope
    if (options?.envelope) {
      result = this.wrapInEnvelope(result, domain, behavior);
      transformations.push('envelope');
    }

    // Add metadata
    if (options?.includeMetadata) {
      result = this.addMetadata(result, domain, behavior);
      transformations.push('metadata');
    }

    return {
      data: result,
      transformations,
    };
  }

  /**
   * Exclude specified fields
   */
  private excludeFields(
    data: Record<string, unknown>,
    exclude: string[]
  ): Record<string, unknown> {
    const result = { ...data };
    
    for (const field of exclude) {
      delete result[field];
    }
    
    return result;
  }

  /**
   * Map field names
   */
  private mapFields(
    data: Record<string, unknown>,
    mapping: Record<string, string>
  ): Record<string, unknown> {
    const result: Record<string, unknown> = {};
    
    for (const [key, value] of Object.entries(data)) {
      const newKey = mapping[key] ?? key;
      result[newKey] = value;
    }
    
    return result;
  }

  /**
   * Apply default values
   */
  private applyDefaults(
    data: Record<string, unknown>,
    defaults: Record<string, unknown>
  ): Record<string, unknown> {
    return { ...defaults, ...data };
  }

  /**
   * Wrap response in envelope
   */
  private wrapInEnvelope(
    data: unknown,
    domain: string,
    behavior: string
  ): Record<string, unknown> {
    return {
      success: true,
      data,
      meta: {
        domain,
        behavior,
        timestamp: new Date().toISOString(),
      },
    };
  }

  /**
   * Add metadata to response
   */
  private addMetadata(
    data: unknown,
    domain: string,
    behavior: string
  ): unknown {
    if (typeof data !== 'object' || data === null) {
      return data;
    }

    return {
      ...(data as Record<string, unknown>),
      _meta: {
        domain,
        behavior,
        version: '1.0',
        generatedAt: new Date().toISOString(),
      },
    };
  }
}

/**
 * Transform a response
 */
export function transformResponse(
  data: unknown,
  options: TransformOptions = {}
): TransformResult {
  const transformer = new ResponseTransformer();
  
  // Apply inline transformation
  let result = data;

  if (options.exclude && typeof result === 'object' && result !== null) {
    const obj = result as Record<string, unknown>;
    result = Object.fromEntries(
      Object.entries(obj).filter(([key]) => !options.exclude!.includes(key))
    );
  }

  if (options.fieldMapping && typeof result === 'object' && result !== null) {
    const obj = result as Record<string, unknown>;
    result = Object.fromEntries(
      Object.entries(obj).map(([key, value]) => [
        options.fieldMapping![key] ?? key,
        value,
      ])
    );
  }

  if (options.defaults && typeof result === 'object' && result !== null) {
    result = { ...options.defaults, ...(result as Record<string, unknown>) };
  }

  if (options.envelope) {
    result = {
      success: true,
      data: result,
      timestamp: new Date().toISOString(),
    };
  }

  return { data: result };
}
