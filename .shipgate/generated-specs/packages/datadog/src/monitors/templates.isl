# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: verificationScoreMonitor, verificationFailureMonitor, verificationLatencyMonitor, coverageDropMonitor, sloBurnRateMonitor, sloBreachMonitor, errorBudgetExhaustedMonitor, verificationScoreAnomalyMonitor, verificationRateAnomalyMonitor, domainHealthMonitor, MONITOR_TEMPLATES, TemplateParams, MonitorTemplate, MonitorTemplateName
# dependencies: 

domain Templates {
  version: "1.0.0"

  type TemplateParams = String
  type MonitorTemplate = String
  type MonitorTemplateName = String

  invariants exports_present {
    - true
  }
}
