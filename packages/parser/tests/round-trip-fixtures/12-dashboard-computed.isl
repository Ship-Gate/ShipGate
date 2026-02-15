domain DashboardComputed {
  version: "1.0.0"

  type Percentage = Decimal { min: 0 max: 100 }

  entity Report {
    id: UUID [immutable, unique]
    total: Decimal
    count: Int
  }

  view ReportStats {
    for: Report
    fields {
      pct: Percentage = (Report.total / 100) * 100
      avg: Decimal = Report.total / Report.count
    }
    consistency { strong }
  }

  invariants report_valid {
    - Report.count >= 0
    - Report.total >= 0
  }
}
