domain Report {
  version: "1.0.0"

  entity StepStatus {
    id: String
  }
  entity StepResult {
    id: String
  }
  entity SampleResult {
    id: String
  }
  entity EvidenceReport {
    id: String
  }
  entity ReportBuilder {
    id: String
  }

  behavior writeReport {
    input {
      request: String
    }

    output {
      success: Boolean
    }

    invariants {
      - writeReport never_throws_unhandled
    }
  }
  behavior printReportSummary {
    input {
      request: String
    }

    output {
      success: Boolean
    }

    invariants {
      - printReportSummary never_throws_unhandled
    }
  }
  behavior generateMarkdownReport {
    input {
      request: String
    }

    output {
      success: Boolean
    }

    invariants {
      - generateMarkdownReport never_throws_unhandled
    }
  }
}
