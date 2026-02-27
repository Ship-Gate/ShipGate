domain DashboardViews {
  version: "1.0.0"

  entity Metric {
    id: UUID [immutable, unique]
    name: String
    value: Decimal
    timestamp: Timestamp
  }

  view MetricSummary {
    for: Metric
    fields {
      total: Decimal = Metric.value
      count: Int = 1
    }
    consistency { eventual }
  }


  behavior RecordMetric {
    input {
      name: String
      value: Decimal
    }
    output {
      success: Metric
    }
  }
}
