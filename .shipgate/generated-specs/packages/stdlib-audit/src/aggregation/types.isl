# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: AggregationStage, FilterStage, GroupStage, SortStage, LimitStage, PipelineStage, AggregationGroup, AggregationResult, TimeWindow, TimeWindowGroup
# dependencies: 

domain Types {
  version: "1.0.0"

  type AggregationStage = String
  type FilterStage = String
  type GroupStage = String
  type SortStage = String
  type LimitStage = String
  type PipelineStage = String
  type AggregationGroup = String
  type AggregationResult = String
  type TimeWindow = String
  type TimeWindowGroup = String

  invariants exports_present {
    - true
  }
}
