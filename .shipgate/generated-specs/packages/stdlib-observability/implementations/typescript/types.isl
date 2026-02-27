# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: success, failure, DEFAULT_LOGGER_CONFIG, UUID, TraceId, SpanId, MetricName, LabelName, LabelValue, Timestamp, Duration, Result, LogSource, LogError, LogEntry, LogInput, LogOutput, LoggerConfig, MetricDefinition, MetricSample, CounterInput, GaugeInput, HistogramInput, TimingInput, TimingOutput, SpanEvent, SpanLink, SpanResource, Span, Trace, SpanContext, StartSpanInput, StartSpanOutput, EndSpanInput, AddSpanEventInput, SetSpanAttributeInput, InjectContextInput, ExtractContextInput, AlertThreshold, AlertNotification, AlertRule, Alert, CreateAlertRuleInput, AcknowledgeAlertInput, SilenceAlertInput, HealthCheck, HealthCheckResult, CheckHealthInput, CheckHealthOutput, SLI, BurnRateAlert, SLO, CalculateSLOInput, CalculateSLOOutput, LogExporter, MetricExporter, SpanExporter
# dependencies: 

domain Types {
  version: "1.0.0"

  type UUID = String
  type TraceId = String
  type SpanId = String
  type MetricName = String
  type LabelName = String
  type LabelValue = String
  type Timestamp = String
  type Duration = String
  type Result = String
  type LogSource = String
  type LogError = String
  type LogEntry = String
  type LogInput = String
  type LogOutput = String
  type LoggerConfig = String
  type MetricDefinition = String
  type MetricSample = String
  type CounterInput = String
  type GaugeInput = String
  type HistogramInput = String
  type TimingInput = String
  type TimingOutput = String
  type SpanEvent = String
  type SpanLink = String
  type SpanResource = String
  type Span = String
  type Trace = String
  type SpanContext = String
  type StartSpanInput = String
  type StartSpanOutput = String
  type EndSpanInput = String
  type AddSpanEventInput = String
  type SetSpanAttributeInput = String
  type InjectContextInput = String
  type ExtractContextInput = String
  type AlertThreshold = String
  type AlertNotification = String
  type AlertRule = String
  type Alert = String
  type CreateAlertRuleInput = String
  type AcknowledgeAlertInput = String
  type SilenceAlertInput = String
  type HealthCheck = String
  type HealthCheckResult = String
  type CheckHealthInput = String
  type CheckHealthOutput = String
  type SLI = String
  type BurnRateAlert = String
  type SLO = String
  type CalculateSLOInput = String
  type CalculateSLOOutput = String
  type LogExporter = String
  type MetricExporter = String
  type SpanExporter = String

  invariants exports_present {
    - true
  }
}
