// ============================================================================
// Monitor Templates
// ============================================================================

import type { DatadogMonitor, MonitorThresholds } from '../types.js';

/**
 * Template parameters
 */
export interface TemplateParams {
  domain: string;
  behavior: string;
  alertChannel?: string;
  criticalChannel?: string;
  tags?: string[];
}

/**
 * Monitor template function type
 */
export type MonitorTemplate = (params: TemplateParams) => DatadogMonitor;

// ============================================================================
// Verification Monitors
// ============================================================================

/**
 * Verification score monitor
 */
export const verificationScoreMonitor: MonitorTemplate = (params) => ({
  name: `ISL: ${params.domain}.${params.behavior} verification score`,
  type: 'metric alert',
  query: `avg(last_5m):avg:isl.verification.score{domain:${params.domain},behavior:${params.behavior}} < 80`,
  message: `{{#is_alert}}
Verification score for ${params.behavior} dropped below critical threshold.

**Domain:** ${params.domain}
**Behavior:** ${params.behavior}
**Current Score:** {{value}}

Please investigate the verification failures.
${params.criticalChannel ?? '@slack-platform-alerts'}
{{/is_alert}}

{{#is_warning}}
Verification score for ${params.behavior} is below warning threshold.
**Current Score:** {{value}}
${params.alertChannel ?? '@slack-platform-alerts'}
{{/is_warning}}

{{#is_recovery}}
Verification score for ${params.behavior} has recovered.
{{/is_recovery}}`,
  tags: ['isl', `domain:${params.domain}`, `behavior:${params.behavior}`, ...(params.tags ?? [])],
  options: {
    thresholds: {
      critical: 80,
      warning: 90,
    },
    notify_no_data: true,
    no_data_timeframe: 10,
    require_full_window: false,
    evaluation_delay: 60,
  },
});

/**
 * Verification failure rate monitor
 */
export const verificationFailureMonitor: MonitorTemplate = (params) => ({
  name: `ISL: ${params.domain}.${params.behavior} verification failures`,
  type: 'metric alert',
  query: `sum(last_5m):sum:isl.verification.unsafe{domain:${params.domain},behavior:${params.behavior}}.as_count() > 5`,
  message: `{{#is_alert}}
🚨 Multiple unsafe verifications detected for ${params.behavior}

**Domain:** ${params.domain}
**Behavior:** ${params.behavior}
**Failure Count:** {{value}}

Immediate investigation required!
${params.criticalChannel ?? '@pagerduty-platform'}
{{/is_alert}}

{{#is_warning}}
⚠️ Verification failures detected for ${params.behavior}
**Failure Count:** {{value}}
${params.alertChannel ?? '@slack-platform-alerts'}
{{/is_warning}}`,
  tags: ['isl', `domain:${params.domain}`, `behavior:${params.behavior}`, 'severity:critical', ...(params.tags ?? [])],
  options: {
    thresholds: {
      critical: 5,
      warning: 2,
    },
    notify_no_data: false,
    require_full_window: true,
  },
});

/**
 * Verification latency monitor
 */
export const verificationLatencyMonitor = (
  params: TemplateParams,
  thresholdMs: number,
  percentile = 99
): DatadogMonitor => ({
  name: `ISL: ${params.domain}.${params.behavior} p${percentile} latency`,
  type: 'metric alert',
  query: `avg(last_5m):p${percentile}:isl.verification.latency{domain:${params.domain},behavior:${params.behavior}} > ${thresholdMs}`,
  message: `{{#is_alert}}
p${percentile} latency for ${params.behavior} exceeds SLO threshold.

**Domain:** ${params.domain}
**Behavior:** ${params.behavior}
**Current Latency:** {{value}}ms
**Threshold:** ${thresholdMs}ms

${params.alertChannel ?? '@slack-platform-alerts'}
{{/is_alert}}

{{#is_recovery}}
Latency for ${params.behavior} has recovered to normal levels.
{{/is_recovery}}`,
  tags: ['isl', `domain:${params.domain}`, `behavior:${params.behavior}`, 'slo', 'latency', ...(params.tags ?? [])],
  options: {
    thresholds: {
      critical: thresholdMs,
      warning: thresholdMs * 0.8,
    },
    notify_no_data: false,
    require_full_window: true,
    evaluation_delay: 60,
  },
});

// ============================================================================
// Coverage Monitors
// ============================================================================

/**
 * Coverage drop monitor
 */
export const coverageDropMonitor: MonitorTemplate = (params) => ({
  name: `ISL: ${params.domain}.${params.behavior} coverage drop`,
  type: 'metric alert',
  query: `avg(last_15m):avg:isl.coverage.overall{domain:${params.domain},behavior:${params.behavior}} < 80`,
  message: `{{#is_alert}}
Coverage for ${params.behavior} has dropped below threshold.

**Domain:** ${params.domain}
**Behavior:** ${params.behavior}
**Current Coverage:** {{value}}%

Please review recent changes that may have affected coverage.
${params.alertChannel ?? '@slack-platform-alerts'}
{{/is_alert}}`,
  tags: ['isl', `domain:${params.domain}`, `behavior:${params.behavior}`, 'coverage', ...(params.tags ?? [])],
  options: {
    thresholds: {
      critical: 80,
      warning: 90,
    },
    notify_no_data: true,
    no_data_timeframe: 30,
  },
});

// ============================================================================
// SLO Monitors
// ============================================================================

/**
 * SLO burn rate monitor
 */
export const sloBurnRateMonitor = (
  params: TemplateParams,
  sloName: string,
  thresholds: MonitorThresholds = { critical: 2, warning: 1 }
): DatadogMonitor => ({
  name: `ISL: ${params.domain}.${params.behavior} SLO burn rate - ${sloName}`,
  type: 'metric alert',
  query: `avg(last_1h):avg:isl.slo.burn_rate{domain:${params.domain},behavior:${params.behavior},slo:${sloName}} > ${thresholds.critical}`,
  message: `{{#is_alert}}
🔥 SLO burn rate is critically high for ${sloName}

**Domain:** ${params.domain}
**Behavior:** ${params.behavior}
**SLO:** ${sloName}
**Burn Rate:** {{value}}x

Error budget is being consumed faster than expected!
${params.criticalChannel ?? '@pagerduty-platform'}
{{/is_alert}}

{{#is_warning}}
⚠️ SLO burn rate elevated for ${sloName}
**Burn Rate:** {{value}}x
${params.alertChannel ?? '@slack-platform-alerts'}
{{/is_warning}}`,
  tags: ['isl', `domain:${params.domain}`, `behavior:${params.behavior}`, `slo:${sloName}`, 'burn-rate', ...(params.tags ?? [])],
  options: {
    thresholds,
    notify_no_data: false,
    require_full_window: true,
    renotify_interval: 60,
  },
});

/**
 * SLO breach monitor
 */
export const sloBreachMonitor = (
  params: TemplateParams,
  sloName: string,
  target: number
): DatadogMonitor => ({
  name: `ISL: ${params.domain}.${params.behavior} SLO breach - ${sloName}`,
  type: 'metric alert',
  query: `avg(last_5m):avg:isl.slo.current{domain:${params.domain},behavior:${params.behavior},slo:${sloName}} < ${target}`,
  message: `{{#is_alert}}
🚨 SLO BREACH: ${sloName}

**Domain:** ${params.domain}
**Behavior:** ${params.behavior}
**SLO:** ${sloName}
**Target:** ${target}%
**Current:** {{value}}%

The SLO target has been breached!
${params.criticalChannel ?? '@pagerduty-platform'}
{{/is_alert}}

{{#is_recovery}}
✅ SLO ${sloName} has recovered above target.
{{/is_recovery}}`,
  tags: ['isl', `domain:${params.domain}`, `behavior:${params.behavior}`, `slo:${sloName}`, 'breach', ...(params.tags ?? [])],
  options: {
    thresholds: {
      critical: target,
    },
    notify_no_data: true,
    no_data_timeframe: 10,
    renotify_interval: 0, // Don't renotify for breach
  },
});

// ============================================================================
// Error Budget Monitors
// ============================================================================

/**
 * Error budget exhaustion monitor
 */
export const errorBudgetExhaustedMonitor = (
  params: TemplateParams,
  sloName: string
): DatadogMonitor => ({
  name: `ISL: ${params.domain}.${params.behavior} error budget exhausted - ${sloName}`,
  type: 'metric alert',
  query: `avg(last_5m):avg:isl.slo.error_budget_remaining{domain:${params.domain},behavior:${params.behavior},slo:${sloName}} < 0.1`,
  message: `{{#is_alert}}
💸 Error budget nearly exhausted for ${sloName}

**Domain:** ${params.domain}
**Behavior:** ${params.behavior}
**SLO:** ${sloName}
**Remaining Budget:** {{value}}%

Consider freezing deployments and focusing on reliability.
${params.criticalChannel ?? '@pagerduty-platform'}
{{/is_alert}}

{{#is_warning}}
⚠️ Error budget low for ${sloName}
**Remaining Budget:** {{value}}%
${params.alertChannel ?? '@slack-platform-alerts'}
{{/is_warning}}`,
  tags: ['isl', `domain:${params.domain}`, `behavior:${params.behavior}`, `slo:${sloName}`, 'error-budget', ...(params.tags ?? [])],
  options: {
    thresholds: {
      critical: 0.1,
      warning: 0.25,
    },
    notify_no_data: false,
    require_full_window: true,
  },
});

// ============================================================================
// Anomaly Detection Monitors
// ============================================================================

/**
 * Verification score anomaly monitor
 */
export const verificationScoreAnomalyMonitor: MonitorTemplate = (params) => ({
  name: `ISL: ${params.domain}.${params.behavior} verification score anomaly`,
  type: 'query alert',
  query: `avg(last_4h):anomalies(avg:isl.verification.score{domain:${params.domain},behavior:${params.behavior}}, 'basic', 2, direction='below') >= 1`,
  message: `{{#is_alert}}
📉 Anomaly detected in verification score for ${params.behavior}

**Domain:** ${params.domain}
**Behavior:** ${params.behavior}

The verification score is showing unusual behavior compared to historical patterns.
${params.alertChannel ?? '@slack-platform-alerts'}
{{/is_alert}}`,
  tags: ['isl', `domain:${params.domain}`, `behavior:${params.behavior}`, 'anomaly', ...(params.tags ?? [])],
  options: {
    thresholds: {
      critical: 1,
    },
    notify_no_data: false,
    require_full_window: true,
    evaluation_delay: 300,
  },
});

/**
 * Verification rate anomaly monitor
 */
export const verificationRateAnomalyMonitor: MonitorTemplate = (params) => ({
  name: `ISL: ${params.domain}.${params.behavior} verification rate anomaly`,
  type: 'query alert',
  query: `avg(last_4h):anomalies(sum:isl.verification.total{domain:${params.domain},behavior:${params.behavior}}.as_rate(), 'agile', 2) >= 1`,
  message: `{{#is_alert}}
📈 Anomaly detected in verification rate for ${params.behavior}

**Domain:** ${params.domain}
**Behavior:** ${params.behavior}

Verification frequency is outside normal patterns.
${params.alertChannel ?? '@slack-platform-alerts'}
{{/is_alert}}`,
  tags: ['isl', `domain:${params.domain}`, `behavior:${params.behavior}`, 'anomaly', 'rate', ...(params.tags ?? [])],
  options: {
    thresholds: {
      critical: 1,
    },
    notify_no_data: false,
    require_full_window: true,
  },
});

// ============================================================================
// Composite Monitors
// ============================================================================

/**
 * Domain health composite monitor
 */
export const domainHealthMonitor = (
  domain: string,
  childMonitorIds: number[],
  alertChannel?: string
): DatadogMonitor => ({
  name: `ISL: ${domain} domain health`,
  type: 'service check',
  query: `"custom.composite".over("domain:${domain}").last(1).count_by_status()`,
  message: `{{#is_alert}}
🏥 Domain ${domain} health is degraded

Multiple behaviors are experiencing issues.
${alertChannel ?? '@slack-platform-alerts'}
{{/is_alert}}`,
  tags: ['isl', `domain:${domain}`, 'composite', 'health'],
  options: {
    thresholds: {
      critical: 1,
    },
    notify_no_data: false,
  },
});

// ============================================================================
// Template Collection
// ============================================================================

/**
 * All standard templates
 */
export const MONITOR_TEMPLATES = {
  verificationScore: verificationScoreMonitor,
  verificationFailure: verificationFailureMonitor,
  verificationLatency: verificationLatencyMonitor,
  coverageDrop: coverageDropMonitor,
  sloBurnRate: sloBurnRateMonitor,
  sloBreach: sloBreachMonitor,
  errorBudgetExhausted: errorBudgetExhaustedMonitor,
  verificationScoreAnomaly: verificationScoreAnomalyMonitor,
  verificationRateAnomaly: verificationRateAnomalyMonitor,
  domainHealth: domainHealthMonitor,
} as const;

export type MonitorTemplateName = keyof typeof MONITOR_TEMPLATES;
