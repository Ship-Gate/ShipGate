/**
 * Fluent builder for funnel definitions.
 */

import type { FunnelStep, FunnelConfig, EventPropertyFilter, FilterOperator } from './types.js';
import { FunnelAnalyzer } from './analyzer.js';

export class FunnelBuilder {
  private steps: FunnelStep[] = [];
  private config: Partial<FunnelConfig> = {};

  /** Add a funnel step. */
  step(name: string, eventName: string, filter?: EventPropertyFilter): this {
    this.steps.push({ name, eventName, filter });
    return this;
  }

  /** Add a step with an inline filter. */
  stepWhere(name: string, eventName: string, property: string, operator: FilterOperator, value: unknown): this {
    return this.step(name, eventName, { property, operator, value });
  }

  /** Set the conversion window in milliseconds. */
  conversionWindow(ms: number): this {
    this.config.conversionWindowMs = ms;
    return this;
  }

  /** Build the FunnelAnalyzer. */
  build(): FunnelAnalyzer {
    return new FunnelAnalyzer([...this.steps], { ...this.config });
  }
}
