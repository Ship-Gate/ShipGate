// Search: Aggregations and analytics
domain SearchAggregations {
  version: "1.0.0"

  enum AggregationType {
    TERMS
    DATE_HISTOGRAM
    RANGE
    STATS
    CARDINALITY
    PERCENTILES
  }

  type Aggregation = {
    name: String
    type: AggregationType
    field: String
    options: Map<String, String>?
  }

  type TermsBucket = {
    key: String
    doc_count: Int
  }

  type DateBucket = {
    key: Timestamp
    key_as_string: String
    doc_count: Int
  }

  type StatsResult = {
    count: Int
    min: Decimal
    max: Decimal
    avg: Decimal
    sum: Decimal
  }

  behavior Aggregate {
    description: "Run aggregations on search results"

    actors {
      User { must: authenticated }
      Admin { must: authenticated }
    }

    input {
      index: String
      query: String?
      filters: Map<String, String>?
      aggregations: List<Aggregation>
    }

    output {
      success: {
        total_docs: Int
        aggregations: Map<String, {
          buckets: List<TermsBucket>?
          date_buckets: List<DateBucket>?
          stats: StatsResult?
          value: Decimal?
          percentiles: Map<String, Decimal>?
        }>
        query_time_ms: Int
      }

      errors {
        INVALID_INDEX {
          when: "Index not found"
          retriable: false
        }
        INVALID_AGGREGATION {
          when: "Aggregation configuration invalid"
          retriable: true
        }
        TOO_MANY_AGGREGATIONS {
          when: "Too many aggregations"
          retriable: false
        }
      }
    }

    pre {
      input.aggregations.length > 0
      input.aggregations.length <= 20
    }

    temporal {
      - within 500ms (p99): response returned
    }
  }

  behavior GetTermsAggregation {
    description: "Get terms aggregation"

    actors {
      User { must: authenticated }
    }

    input {
      index: String
      field: String
      query: String?
      size: Int?
      min_doc_count: Int?
    }

    output {
      success: {
        buckets: List<TermsBucket>
        sum_other_doc_count: Int
      }
    }

    pre {
      input.size == null or (input.size >= 1 and input.size <= 1000)
    }
  }

  behavior GetDateHistogram {
    description: "Get date histogram"

    actors {
      User { must: authenticated }
    }

    input {
      index: String
      field: String
      interval: String
      query: String?
      from: Timestamp?
      to: Timestamp?
      timezone: String?
    }

    output {
      success: {
        buckets: List<DateBucket>
        interval: String
      }

      errors {
        INVALID_INTERVAL {
          when: "Invalid interval"
          retriable: true
        }
      }
    }

    pre {
      input.interval == "minute" or input.interval == "hour" or input.interval == "day" or input.interval == "week" or input.interval == "month" or input.interval == "year"
    }
  }

  behavior GetStats {
    description: "Get field statistics"

    actors {
      User { must: authenticated }
    }

    input {
      index: String
      field: String
      query: String?
      filters: Map<String, String>?
    }

    output {
      success: StatsResult

      errors {
        FIELD_NOT_NUMERIC {
          when: "Field is not numeric"
          retriable: false
        }
      }
    }
  }

  behavior GetCardinality {
    description: "Get unique value count"

    actors {
      User { must: authenticated }
    }

    input {
      index: String
      field: String
      query: String?
      precision_threshold: Int?
    }

    output {
      success: {
        value: Int
        approximate: Boolean
      }
    }

    pre {
      input.precision_threshold == null or (input.precision_threshold >= 100 and input.precision_threshold <= 40000)
    }
  }

  scenarios Aggregate {
    scenario "sales by category" {
      when {
        result = Aggregate(
          index: "orders",
          aggregations: [
            { name: "by_category", type: TERMS, field: "category" },
            { name: "revenue_stats", type: STATS, field: "total" }
          ]
        )
      }

      then {
        result is success
        "by_category" in result.aggregations
        "revenue_stats" in result.aggregations
      }
    }

    scenario "orders over time" {
      when {
        result = GetDateHistogram(
          index: "orders",
          field: "created_at",
          interval: "day",
          from: "2024-01-01",
          to: "2024-01-31"
        )
      }

      then {
        result is success
        result.buckets.length <= 31
      }
    }
  }
}
