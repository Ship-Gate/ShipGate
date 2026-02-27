# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: lightTheme, darkTheme, RenderOptions, ThemeColors, GroupedClauses, RenderedSection, BadgeType, ReportStats
# dependencies: 

domain ViewerTypes {
  version: "1.0.0"

  type RenderOptions = String
  type ThemeColors = String
  type GroupedClauses = String
  type RenderedSection = String
  type BadgeType = String
  type ReportStats = String

  invariants exports_present {
    - true
  }
}
