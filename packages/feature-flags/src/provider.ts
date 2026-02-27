/**
 * Feature Flag Provider
 */
import type {
  FeatureFlag,
  FlagProviderConfig,
  EvaluationContext,
  EvaluationResult,
  FlagAuditEvent,
  BehaviorGate,
  BehaviorModification,
} from './types.js';
import { FlagEvaluator } from './evaluator.js';

export class FeatureFlagProvider {
  private config: FlagProviderConfig;
  private flags: Map<string, FeatureFlag> = new Map();
  private evaluator: FlagEvaluator;
  private refreshTimer?: ReturnType<typeof setInterval>;
  private cache: Map<string, { result: EvaluationResult; expiresAt: number }> = new Map();
  private auditLog: FlagAuditEvent[] = [];
  private behaviorGates: Map<string, BehaviorGate> = new Map();

  constructor(config: FlagProviderConfig) {
    this.config = {
      refreshInterval: 60000,
      cacheEnabled: true,
      cacheTTL: 5000,
      defaultOnError: false,
      ...config,
    };
    this.evaluator = new FlagEvaluator();
  }

  /**
   * Initialize the provider
   */
  async initialize(): Promise<void> {
    // Load local flags
    if (this.config.localFlags) {
      for (const flag of this.config.localFlags) {
        this.flags.set(flag.key, flag);
      }
    }

    // Fetch remote flags
    if (this.config.source !== 'local' && this.config.remoteUrl) {
      await this.fetchRemoteFlags();

      // Set up refresh interval
      if (this.config.refreshInterval && this.config.refreshInterval > 0) {
        this.refreshTimer = setInterval(
          () => this.fetchRemoteFlags(),
          this.config.refreshInterval
        );
      }
    }

    // Build behavior gates
    this.buildBehaviorGates();
  }

  /**
   * Evaluate a flag
   */
  evaluate(flagKey: string, context: EvaluationContext): EvaluationResult {
    // Check cache
    if (this.config.cacheEnabled) {
      const cached = this.getFromCache(flagKey, context);
      if (cached) return cached;
    }

    const flag = this.flags.get(flagKey);
    
    if (!flag) {
      const result: EvaluationResult = {
        flagKey,
        enabled: this.config.defaultOnError ?? false,
        reason: 'ERROR',
        metadata: { error: 'Flag not found' },
      };
      this.logAudit('evaluate', flagKey, context, result);
      return result;
    }

    try {
      const result = this.evaluator.evaluate(flag, context);
      
      // Cache result
      if (this.config.cacheEnabled) {
        this.setCache(flagKey, context, result);
      }

      this.logAudit('evaluate', flagKey, context, result);
      return result;
    } catch (error) {
      const result: EvaluationResult = {
        flagKey,
        enabled: this.config.defaultOnError ?? false,
        reason: 'ERROR',
        metadata: { error: (error as Error).message },
      };
      this.config.onError?.(error as Error);
      this.logAudit('evaluate', flagKey, context, result);
      return result;
    }
  }

  /**
   * Check if a flag is enabled (simple boolean check)
   */
  isEnabled(flagKey: string, context: EvaluationContext): boolean {
    return this.evaluate(flagKey, context).enabled;
  }

  /**
   * Get variant value
   */
  getVariant(flagKey: string, context: EvaluationContext): string | undefined {
    return this.evaluate(flagKey, context).variant;
  }

  /**
   * Get flag value
   */
  getValue<T>(flagKey: string, context: EvaluationContext, defaultValue: T): T {
    const result = this.evaluate(flagKey, context);
    return (result.value as T) ?? defaultValue;
  }

  /**
   * Check if behavior should be gated
   */
  shouldGateBehavior(
    behavior: string,
    domain: string,
    context: EvaluationContext
  ): { gated: boolean; modifications?: BehaviorModification[] } {
    const gateKey = `${domain}:${behavior}`;
    const gate = this.behaviorGates.get(gateKey) ?? this.behaviorGates.get(`:${behavior}`);

    if (!gate) {
      return { gated: false };
    }

    const result = this.evaluate(gate.flagKey, context);

    if (gate.gateType === 'disable' && result.enabled) {
      return { gated: true };
    }

    if (gate.gateType === 'enable' && !result.enabled) {
      return { gated: true };
    }

    if (gate.gateType === 'modify' && result.enabled && result.variant) {
      const modifications = gate.variantModifications?.get(result.variant);
      if (modifications) {
        return { gated: false, modifications };
      }
    }

    return { gated: false };
  }

  /**
   * Get all flags
   */
  getAllFlags(): FeatureFlag[] {
    return Array.from(this.flags.values());
  }

  /**
   * Get a specific flag
   */
  getFlag(key: string): FeatureFlag | undefined {
    return this.flags.get(key);
  }

  /**
   * Update a flag locally
   */
  updateFlag(flag: FeatureFlag): void {
    this.flags.set(flag.key, { ...flag, updatedAt: new Date().toISOString() });
    this.buildBehaviorGates();
    this.clearCache(flag.key);
    
    this.logAudit('update', flag.key, undefined, undefined);
    this.config.onFlagChange?.(this.getAllFlags());
  }

  /**
   * Get audit log
   */
  getAuditLog(limit?: number): FlagAuditEvent[] {
    const log = [...this.auditLog].reverse();
    return limit ? log.slice(0, limit) : log;
  }

  /**
   * Shutdown the provider
   */
  shutdown(): void {
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
    }
    this.cache.clear();
  }

  // Private methods

  private async fetchRemoteFlags(): Promise<void> {
    if (!this.config.remoteUrl) return;

    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };

      if (this.config.apiKey) {
        headers['Authorization'] = `Bearer ${this.config.apiKey}`;
      }

      const response = await fetch(this.config.remoteUrl, { headers });
      
      if (!response.ok) {
        throw new Error(`Failed to fetch flags: ${response.statusText}`);
      }

      const remoteFlags = (await response.json()) as FeatureFlag[];
      
      for (const flag of remoteFlags) {
        // In hybrid mode, remote overrides local
        if (this.config.source === 'remote' || !this.flags.has(flag.key)) {
          this.flags.set(flag.key, flag);
        }
      }

      this.buildBehaviorGates();
      this.config.onFlagChange?.(this.getAllFlags());
    } catch (error) {
      this.config.onError?.(error as Error);
    }
  }

  private buildBehaviorGates(): void {
    this.behaviorGates.clear();

    for (const flag of this.flags.values()) {
      if (flag.behaviors) {
        for (const override of flag.behaviors) {
          const gateKey = `${override.domain ?? ''}:${override.behavior}`;
          
          const variantModifications = new Map<string, BehaviorModification[]>();
          if (flag.variants) {
            for (const variant of flag.variants) {
              variantModifications.set(variant.key, override.modifications);
            }
          }

          this.behaviorGates.set(gateKey, {
            flagKey: flag.key,
            behavior: override.behavior,
            domain: override.domain,
            gateType: override.modifications.some((m) => m.type === 'disable') 
              ? 'disable' 
              : override.modifications.length > 0 
                ? 'modify' 
                : 'enable',
            variantModifications,
          });
        }
      }
    }
  }

  private getCacheKey(flagKey: string, context: EvaluationContext): string {
    return `${flagKey}:${context.userId ?? 'anon'}:${context.environment ?? 'default'}`;
  }

  private getFromCache(flagKey: string, context: EvaluationContext): EvaluationResult | null {
    const key = this.getCacheKey(flagKey, context);
    const cached = this.cache.get(key);

    if (cached && cached.expiresAt > Date.now()) {
      return cached.result;
    }

    return null;
  }

  private setCache(flagKey: string, context: EvaluationContext, result: EvaluationResult): void {
    const key = this.getCacheKey(flagKey, context);
    this.cache.set(key, {
      result,
      expiresAt: Date.now() + (this.config.cacheTTL ?? 5000),
    });
  }

  private clearCache(flagKey?: string): void {
    if (flagKey) {
      for (const key of this.cache.keys()) {
        if (key.startsWith(`${flagKey}:`)) {
          this.cache.delete(key);
        }
      }
    } else {
      this.cache.clear();
    }
  }

  private logAudit(
    action: FlagAuditEvent['action'],
    flagKey: string,
    context?: EvaluationContext,
    result?: EvaluationResult
  ): void {
    this.auditLog.push({
      timestamp: new Date().toISOString(),
      flagKey,
      action,
      context,
      result,
      reasoning: result?.reasoning,
    });

    // Keep only last 1000 events
    if (this.auditLog.length > 1000) {
      this.auditLog = this.auditLog.slice(-1000);
    }
  }
}
