# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: isFiltersEmpty, countActiveFilters, applyFilters, parseFiltersFromUrl, serializeFiltersToUrl, getDateRangeFromPreset, getDateRangeLabel, DEFAULT_FILTERS, DateRangePreset
# dependencies: 

domain Filters {
  version: "1.0.0"

  type DateRangePreset = String

  invariants exports_present {
    - true
  }
}
