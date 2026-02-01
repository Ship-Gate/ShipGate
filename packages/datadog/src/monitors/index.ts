// ============================================================================
// Monitors Module - Public API
// ============================================================================

// Generator
export {
  MonitorGenerator,
  createMonitorGenerator,
  generateDatadogMonitors,
  type MonitorGeneratorOptions,
  type MonitorGeneratorResult,
} from './generator.js';

// Templates
export {
  MONITOR_TEMPLATES,
  verificationScoreMonitor,
  verificationFailureMonitor,
  verificationLatencyMonitor,
  coverageDropMonitor,
  sloBurnRateMonitor,
  sloBreachMonitor,
  errorBudgetExhaustedMonitor,
  verificationScoreAnomalyMonitor,
  verificationRateAnomalyMonitor,
  domainHealthMonitor,
  type MonitorTemplate,
  type TemplateParams,
  type MonitorTemplateName,
} from './templates.js';
