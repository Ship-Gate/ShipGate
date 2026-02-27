// ============================================================================
// Dashboard Generator
// ============================================================================

import type {
  DatadogDashboard,
  DashboardWidget,
  WidgetDefinition,
  TemplateVariable,
  Domain,
  Behavior,
} from '../types.js';

/**
 * Dashboard generation options
 */
export interface DashboardGeneratorOptions {
  /** Include coverage widgets (default: true) */
  includeCoverage?: boolean;
  /** Include SLO widgets (default: true) */
  includeSLO?: boolean;
  /** Include per-behavior widgets (default: true) */
  includePerBehavior?: boolean;
  /** Include error tracking widgets (default: true) */
  includeErrors?: boolean;
  /** Default time range (default: '1h') */
  defaultTimeRange?: string;
  /** Widget height (default: 3) */
  widgetHeight?: number;
  /** Custom template variables */
  templateVariables?: TemplateVariable[];
}

const DEFAULT_OPTIONS: Required<DashboardGeneratorOptions> = {
  includeCoverage: true,
  includeSLO: true,
  includePerBehavior: true,
  includeErrors: true,
  defaultTimeRange: '1h',
  widgetHeight: 3,
  templateVariables: [],
};

/**
 * Dashboard Generator
 * 
 * Generates Datadog dashboards from ISL domain specifications including:
 * - Overview widgets (score, status, trends)
 * - Coverage visualizations
 * - SLO tracking
 * - Per-behavior details
 * 
 * @example
 * ```typescript
 * const generator = new DashboardGenerator();
 * const dashboard = generator.generateForDomain(authDomain);
 * 
 * // Export as JSON for Datadog API
 * const json = JSON.stringify(dashboard, null, 2);
 * ```
 */
export class DashboardGenerator {
  private options: Required<DashboardGeneratorOptions>;
  private widgetId = 0;

  constructor(options: DashboardGeneratorOptions = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  /**
   * Generate a dashboard for a domain
   */
  generateForDomain(domain: Domain): DatadogDashboard {
    this.widgetId = 0;
    const widgets: DashboardWidget[] = [];

    // Overview section
    widgets.push(...this.createOverviewWidgets(domain));

    // Verification trends
    widgets.push(...this.createTrendWidgets(domain));

    // Coverage section
    if (this.options.includeCoverage) {
      widgets.push(...this.createCoverageWidgets(domain));
    }

    // SLO section
    if (this.options.includeSLO) {
      widgets.push(...this.createSLOWidgets(domain));
    }

    // Error tracking
    if (this.options.includeErrors) {
      widgets.push(...this.createErrorWidgets(domain));
    }

    // Per-behavior widgets
    if (this.options.includePerBehavior) {
      for (const behavior of domain.behaviors) {
        widgets.push(...this.createBehaviorWidgets(domain.name, behavior));
      }
    }

    return {
      title: `ISL: ${domain.name} Verification`,
      description: `Verification dashboard for ${domain.name} domain. Auto-generated from ISL specifications.`,
      widgets,
      layout_type: 'ordered',
      notify_list: [],
      template_variables: [
        { name: 'env', default: '*', prefix: 'env' },
        { name: 'behavior', default: '*', prefix: 'behavior' },
        ...this.options.templateVariables,
      ],
      reflow_type: 'auto',
    };
  }

  /**
   * Generate a dashboard for multiple domains
   */
  generateOverviewDashboard(domains: Domain[]): DatadogDashboard {
    this.widgetId = 0;
    const widgets: DashboardWidget[] = [];

    // Global overview
    widgets.push(this.createWidget({
      title: 'Overall Verification Health',
      type: 'query_value',
      requests: [{
        q: 'avg:isl.verification.score{*}',
        aggregator: 'avg',
      }],
      precision: 0,
      autoscale: true,
    }));

    widgets.push(this.createWidget({
      title: 'Total Verifications (24h)',
      type: 'query_value',
      requests: [{
        q: 'sum:isl.verification.total{*}.as_count()',
        aggregator: 'sum',
      }],
      precision: 0,
    }));

    widgets.push(this.createWidget({
      title: 'Failure Rate',
      type: 'query_value',
      requests: [{
        formulas: [{
          formula: '(a / b) * 100',
          alias: 'Failure Rate %',
        }],
        queries: [
          { name: 'a', query: 'sum:isl.verification.unsafe{*}.as_count()', data_source: 'metrics' },
          { name: 'b', query: 'sum:isl.verification.total{*}.as_count()', data_source: 'metrics' },
        ],
        response_format: 'scalar',
      }],
      precision: 2,
      custom_unit: '%',
    }));

    // Per-domain summaries
    widgets.push(this.createWidget({
      title: 'Verification Score by Domain',
      type: 'toplist',
      requests: [{
        q: 'avg:isl.verification.score{*} by {domain}',
      }],
    }));

    widgets.push(this.createWidget({
      title: 'Failures by Domain',
      type: 'toplist',
      requests: [{
        q: 'sum:isl.verification.unsafe{*} by {domain}.as_count()',
      }],
    }));

    // Domain health grid
    for (const domain of domains) {
      widgets.push(this.createWidget({
        title: `${domain.name} Health`,
        type: 'query_value',
        requests: [{
          q: `avg:isl.verification.score{domain:${domain.name}}`,
          aggregator: 'avg',
        }],
        precision: 0,
      }));
    }

    return {
      title: 'ISL: Verification Overview',
      description: 'Overview dashboard for all ISL domain verifications',
      widgets,
      layout_type: 'ordered',
      notify_list: [],
      template_variables: [
        { name: 'env', default: '*', prefix: 'env' },
        { name: 'domain', default: '*', prefix: 'domain' },
      ],
    };
  }

  /**
   * Export dashboard as JSON
   */
  toJSON(dashboard: DatadogDashboard): string {
    return JSON.stringify(dashboard, null, 2);
  }

  /**
   * Export dashboard as Terraform
   */
  toTerraform(dashboard: DatadogDashboard): string {
    const resourceName = dashboard.title
      .toLowerCase()
      .replace(/[^a-z0-9_]/g, '_')
      .replace(/_+/g, '_');

    return `
resource "datadog_dashboard" "${resourceName}" {
  title       = ${JSON.stringify(dashboard.title)}
  description = ${JSON.stringify(dashboard.description ?? '')}
  layout_type = ${JSON.stringify(dashboard.layout_type)}

  ${dashboard.widgets.map(w => this.widgetToTerraform(w)).join('\n\n')}

  ${dashboard.template_variables?.map(tv => `
  template_variable {
    name    = ${JSON.stringify(tv.name)}
    prefix  = ${JSON.stringify(tv.prefix)}
    default = ${JSON.stringify(tv.default)}
  }`).join('\n') ?? ''}
}
`;
  }

  // ============================================================================
  // Widget Creators
  // ============================================================================

  private createOverviewWidgets(domain: Domain): DashboardWidget[] {
    return [
      // Score gauge
      this.createWidget({
        title: 'Verification Score',
        type: 'query_value',
        requests: [{
          q: `avg:isl.verification.score{domain:${domain.name}}`,
          aggregator: 'avg',
        }],
        precision: 0,
        autoscale: true,
      }),

      // Total verifications
      this.createWidget({
        title: 'Total Verifications',
        type: 'query_value',
        requests: [{
          q: `sum:isl.verification.total{domain:${domain.name}}.as_count()`,
          aggregator: 'sum',
        }],
        precision: 0,
      }),

      // Verdict distribution
      this.createWidget({
        title: 'Verifications by Verdict',
        type: 'toplist',
        requests: [{
          q: `sum:isl.verification.total{domain:${domain.name}} by {verdict}.as_count()`,
        }],
      }),

      // Behavior distribution
      this.createWidget({
        title: 'Verifications by Behavior',
        type: 'toplist',
        requests: [{
          q: `sum:isl.verification.total{domain:${domain.name}} by {behavior}.as_count()`,
        }],
      }),
    ];
  }

  private createTrendWidgets(domain: Domain): DashboardWidget[] {
    return [
      // Score trend
      this.createWidget({
        title: 'Verification Score Trend',
        type: 'timeseries',
        requests: [{
          q: `avg:isl.verification.score{domain:${domain.name}} by {behavior}`,
          display_type: 'line',
          style: { palette: 'dog_classic' },
        }],
      }),

      // Verification volume
      this.createWidget({
        title: 'Verification Volume',
        type: 'timeseries',
        requests: [{
          q: `sum:isl.verification.total{domain:${domain.name}} by {verdict}.as_count()`,
          display_type: 'bars',
          style: { palette: 'semantic' },
        }],
      }),

      // Latency distribution
      this.createWidget({
        title: 'Verification Latency',
        type: 'timeseries',
        requests: [{
          q: `p95:isl.verification.latency{domain:${domain.name}}`,
          display_type: 'line',
        }],
        yaxis: {
          min: '0',
          include_zero: true,
        },
      }),
    ];
  }

  private createCoverageWidgets(domain: Domain): DashboardWidget[] {
    return [
      // Coverage heatmap
      this.createWidget({
        title: 'Coverage by Category',
        type: 'heatmap',
        requests: [{
          q: `avg:isl.coverage.overall{domain:${domain.name}} by {behavior}`,
        }],
      }),

      // Coverage breakdown
      this.createWidget({
        title: 'Coverage Breakdown',
        type: 'timeseries',
        requests: [
          {
            q: `avg:isl.verification.coverage.preconditions{domain:${domain.name}}`,
            display_type: 'line',
            style: { palette: 'warm' },
          },
          {
            q: `avg:isl.verification.coverage.postconditions{domain:${domain.name}}`,
            display_type: 'line',
            style: { palette: 'cool' },
          },
          {
            q: `avg:isl.verification.coverage.invariants{domain:${domain.name}}`,
            display_type: 'line',
            style: { palette: 'purple' },
          },
        ],
      }),
    ];
  }

  private createSLOWidgets(domain: Domain): DashboardWidget[] {
    return [
      // SLO status
      this.createWidget({
        title: 'SLO Status',
        type: 'query_value',
        requests: [{
          q: `avg:isl.slo.current{domain:${domain.name}}`,
          aggregator: 'avg',
        }],
        precision: 2,
        custom_unit: '%',
      }),

      // Error budget remaining
      this.createWidget({
        title: 'Error Budget Remaining',
        type: 'query_value',
        requests: [{
          q: `avg:isl.slo.error_budget_remaining{domain:${domain.name}}`,
          aggregator: 'avg',
        }],
        precision: 2,
        custom_unit: '%',
      }),

      // Burn rate trend
      this.createWidget({
        title: 'SLO Burn Rate',
        type: 'timeseries',
        requests: [{
          q: `avg:isl.slo.burn_rate{domain:${domain.name}} by {slo}`,
          display_type: 'line',
        }],
        yaxis: {
          min: '0',
          include_zero: true,
        },
      }),
    ];
  }

  private createErrorWidgets(domain: Domain): DashboardWidget[] {
    return [
      // Error count
      this.createWidget({
        title: 'Verification Errors',
        type: 'query_value',
        requests: [{
          q: `sum:isl.verification.unsafe{domain:${domain.name}}.as_count()`,
          aggregator: 'sum',
        }],
        precision: 0,
      }),

      // Error trend
      this.createWidget({
        title: 'Error Trend',
        type: 'timeseries',
        requests: [{
          q: `sum:isl.verification.unsafe{domain:${domain.name}} by {behavior}.as_count()`,
          display_type: 'bars',
          style: { palette: 'warm' },
        }],
      }),

      // Error rate
      this.createWidget({
        title: 'Error Rate by Behavior',
        type: 'toplist',
        requests: [{
          formulas: [{
            formula: '(a / b) * 100',
          }],
          queries: [
            { name: 'a', query: `sum:isl.verification.unsafe{domain:${domain.name}} by {behavior}.as_count()`, data_source: 'metrics' },
            { name: 'b', query: `sum:isl.verification.total{domain:${domain.name}} by {behavior}.as_count()`, data_source: 'metrics' },
          ],
          response_format: 'scalar',
        }],
      }),
    ];
  }

  private createBehaviorWidgets(domainName: string, behavior: Behavior): DashboardWidget[] {
    const widgets: DashboardWidget[] = [];

    // Section header (group widget)
    widgets.push(this.createWidget({
      title: `${behavior.name}`,
      type: 'group',
    }));

    // Score for this behavior
    widgets.push(this.createWidget({
      title: `${behavior.name} - Score`,
      type: 'query_value',
      requests: [{
        q: `avg:isl.verification.score{domain:${domainName},behavior:${behavior.name}}`,
        aggregator: 'avg',
      }],
      precision: 0,
    }));

    // Score trend
    widgets.push(this.createWidget({
      title: `${behavior.name} - Score Trend`,
      type: 'timeseries',
      requests: [{
        q: `avg:isl.verification.score{domain:${domainName},behavior:${behavior.name}}`,
        display_type: 'line',
      }],
    }));

    // Latency for this behavior
    widgets.push(this.createWidget({
      title: `${behavior.name} - Latency (p99)`,
      type: 'timeseries',
      requests: [{
        q: `p99:isl.verification.latency{domain:${domainName},behavior:${behavior.name}}`,
        display_type: 'line',
      }],
    }));

    return widgets;
  }

  private createWidget(definition: WidgetDefinition): DashboardWidget {
    const widget: DashboardWidget = {
      id: this.widgetId++,
      definition,
    };

    return widget;
  }

  private widgetToTerraform(widget: DashboardWidget): string {
    const def = widget.definition;
    
    return `
  widget {
    ${def.title ? `title = ${JSON.stringify(def.title)}` : ''}
    
    ${def.type}_definition {
      ${def.requests?.map(r => `
      request {
        ${r.q ? `q = ${JSON.stringify(r.q)}` : ''}
        ${r.display_type ? `display_type = ${JSON.stringify(r.display_type)}` : ''}
      }`).join('\n') ?? ''}
    }
  }`;
  }
}

/**
 * Create a dashboard generator
 */
export function createDashboardGenerator(options?: DashboardGeneratorOptions): DashboardGenerator {
  return new DashboardGenerator(options);
}

/**
 * Generate a dashboard for a domain (convenience function)
 */
export function generateDatadogDashboard(
  domain: Domain,
  options?: DashboardGeneratorOptions
): DatadogDashboard {
  const generator = new DashboardGenerator(options);
  return generator.generateForDomain(domain);
}
