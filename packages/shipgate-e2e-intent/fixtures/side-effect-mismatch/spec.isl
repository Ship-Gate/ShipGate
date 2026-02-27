domain ReportService {
  version: "1.0.0"

  entity Report {
    id: UUID [immutable, unique]
    title: String
    content: String
    generated_at: Timestamp [immutable]
  }

  behavior GenerateReport {
    description: "Generate a report from data — pure computation, no side effects"

    input {
      title: String
      data: String
    }

    output {
      success: Report
      errors {
        EMPTY_DATA {
          when: "No data provided"
          retriable: false
        }
      }
    }

    postconditions {
      success implies {
        - result.title == input.title
        - result.content.length > 0
      }
    }

    invariants {
      - no_side_effects
      - no_file_writes
      - no_network_calls
    }
  }
}
