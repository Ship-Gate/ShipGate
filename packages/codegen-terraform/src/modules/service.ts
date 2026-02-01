// ============================================================================
// Service Module Generation
// Generates a complete microservice infrastructure module
// ============================================================================

import type * as AST from '../../../../master_contracts/ast';
import type { CloudProvider, ComputeRequirements, SecurityRequirements, MonitoringRequirements } from '../types';
import { generateAwsSnsAlerts, generateAwsCloudWatchAlarm } from '../providers/aws';

/**
 * Generate a complete service module
 */
export function generateServiceModule(
  behavior: AST.Behavior,
  domainName: string,
  provider: CloudProvider,
  compute: ComputeRequirements,
  security: SecurityRequirements,
  monitoring: MonitoringRequirements
): string {
  const behaviorName = behavior.name.name;
  const sections: string[] = [];

  // Header
  sections.push(`
# ============================================================================
# Service: ${behaviorName}
# Domain: ${domainName}
# Generated from ISL specification
# ============================================================================
`.trim());

  // Compute resources are generated elsewhere
  sections.push(`# Compute resources defined in main.tf`);

  // Monitoring and alarms
  if (monitoring.alarms.length > 0) {
    sections.push('\n# Monitoring and Alarms');
    for (const alarm of monitoring.alarms) {
      sections.push(generateAlarm(alarm, behaviorName, domainName, provider));
    }
  }

  // SNS topic for alerts
  if (provider === 'aws') {
    sections.push('\n' + generateAwsSnsAlerts(domainName));
  }

  return sections.join('\n');
}

/**
 * Generate alarm based on provider
 */
function generateAlarm(
  alarm: MonitoringRequirements['alarms'][0],
  behaviorName: string,
  domainName: string,
  provider: CloudProvider
): string {
  switch (provider) {
    case 'aws':
      return generateAwsCloudWatchAlarm(
        `${domainName}-${behaviorName}-${alarm.name}`,
        alarm.metric,
        'AWS/Lambda',
        alarm.threshold,
        alarm.statistic,
        { FunctionName: `aws_lambda_function.${behaviorName.toLowerCase().replace(/-/g, '_')}.function_name` }
      );

    case 'gcp':
      return generateGcpAlert(alarm, behaviorName, domainName);

    case 'azure':
      return generateAzureAlert(alarm, behaviorName, domainName);

    default:
      return '';
  }
}

/**
 * Generate GCP alerting policy
 */
function generateGcpAlert(
  alarm: MonitoringRequirements['alarms'][0],
  behaviorName: string,
  domainName: string
): string {
  const safeName = `${domainName}_${behaviorName}_${alarm.name}`.toLowerCase().replace(/-/g, '_');

  return `
# Alert Policy: ${alarm.name}
resource "google_monitoring_alert_policy" "${safeName}" {
  display_name = "${domainName}-${behaviorName}-${alarm.name}-\${var.environment}"
  project      = var.project_id
  combiner     = "OR"

  conditions {
    display_name = "${alarm.metric} threshold"

    condition_threshold {
      filter          = "resource.type = \\"cloud_run_revision\\" AND metric.type = \\"run.googleapis.com/${alarm.metric}\\""
      duration        = "60s"
      comparison      = "COMPARISON_GT"
      threshold_value = ${alarm.threshold}

      aggregations {
        alignment_period   = "60s"
        per_series_aligner = "ALIGN_${alarm.statistic.toUpperCase()}"
      }
    }
  }

  notification_channels = [google_monitoring_notification_channel.email.name]

  alert_strategy {
    auto_close = "604800s"
  }
}
`.trim();
}

/**
 * Generate Azure monitor alert
 */
function generateAzureAlert(
  alarm: MonitoringRequirements['alarms'][0],
  behaviorName: string,
  domainName: string
): string {
  const safeName = `${domainName}_${behaviorName}_${alarm.name}`.toLowerCase().replace(/-/g, '_');

  return `
# Monitor Alert: ${alarm.name}
resource "azurerm_monitor_metric_alert" "${safeName}" {
  name                = "${domainName}-${behaviorName}-${alarm.name}-\${var.environment}"
  resource_group_name = azurerm_resource_group.main.name
  scopes              = [azurerm_linux_function_app.${behaviorName.toLowerCase().replace(/-/g, '_')}.id]
  description         = "Alert when ${alarm.metric} exceeds ${alarm.threshold}"
  severity            = 2
  frequency           = "PT1M"
  window_size         = "PT5M"

  criteria {
    metric_namespace = "Microsoft.Web/sites"
    metric_name      = "${mapMetricToAzure(alarm.metric)}"
    aggregation      = "${alarm.statistic}"
    operator         = "GreaterThan"
    threshold        = ${alarm.threshold}
  }

  action {
    action_group_id = azurerm_monitor_action_group.main.id
  }

  tags = local.common_tags
}
`.trim();
}

function mapMetricToAzure(metric: string): string {
  const mapping: Record<string, string> = {
    'Duration': 'FunctionExecutionUnits',
    'Errors': 'Http5xx',
    'Invocations': 'FunctionExecutionCount',
    'Throttles': 'Http429',
  };
  return mapping[metric] || metric;
}

/**
 * Extract monitoring requirements from ISL behavior
 */
export function extractMonitoringRequirements(
  behavior: AST.Behavior
): MonitoringRequirements {
  const alarms: MonitoringRequirements['alarms'] = [];

  // Extract SLO alarms from temporal specs
  for (const temporal of behavior.temporal) {
    if (temporal.operator === 'within' && temporal.duration) {
      const thresholdMs = convertDurationToMs(temporal.duration);
      const percentile = temporal.percentile || 99;

      alarms.push({
        name: `latency-p${percentile}`,
        metric: 'Duration',
        threshold: thresholdMs,
        unit: 'Milliseconds',
        statistic: `p${percentile}`,
      });
    }
  }

  // Add standard error rate alarm
  alarms.push({
    name: 'error-rate',
    metric: 'Errors',
    threshold: 5,
    unit: 'Count',
    statistic: 'Sum',
  });

  return {
    alarms,
    dashboards: true,
    tracing: true,
    logging: true,
  };
}

function convertDurationToMs(duration: AST.DurationLiteral): number {
  switch (duration.unit) {
    case 'ms':
      return duration.value;
    case 'seconds':
      return duration.value * 1000;
    case 'minutes':
      return duration.value * 60 * 1000;
    case 'hours':
      return duration.value * 60 * 60 * 1000;
    case 'days':
      return duration.value * 24 * 60 * 60 * 1000;
  }
}

/**
 * Extract security requirements from ISL behavior
 */
export function extractSecurityRequirements(
  behavior: AST.Behavior
): SecurityRequirements {
  let rateLimiting: SecurityRequirements['rateLimiting'] = null;

  // Extract rate limiting from security specs
  for (const security of behavior.security) {
    if (security.type === 'rate_limit') {
      // Parse rate limit expression (e.g., "1000/minute per api_key")
      const rateLimit = parseRateLimit(security.details);
      if (rateLimit) {
        rateLimiting = rateLimit;
      }
    }
  }

  // Extract compliance requirements
  const compliance = behavior.compliance.map((c) => c.standard.name);

  return {
    waf: compliance.length > 0,
    rateLimiting,
    encryption: true,
    compliance,
  };
}

function parseRateLimit(expr: AST.Expression): SecurityRequirements['rateLimiting'] {
  // Simple parsing - in real implementation would parse the expression tree
  if (expr.kind === 'NumberLiteral') {
    return {
      requestsPerMinute: expr.value,
      burstLimit: expr.value * 2,
    };
  }

  // Default rate limit
  return {
    requestsPerMinute: 1000,
    burstLimit: 2000,
  };
}

/**
 * Generate service module variables
 */
export function generateServiceVariables(behaviorName: string): string {
  const safeName = behaviorName.toLowerCase().replace(/-/g, '_');

  return `
variable "${safeName}_enabled" {
  description = "Enable ${behaviorName} service"
  type        = bool
  default     = true
}

variable "${safeName}_memory" {
  description = "Memory allocation for ${behaviorName}"
  type        = number
  default     = 512
}

variable "${safeName}_timeout" {
  description = "Timeout for ${behaviorName} in seconds"
  type        = number
  default     = 30
}
`.trim();
}
