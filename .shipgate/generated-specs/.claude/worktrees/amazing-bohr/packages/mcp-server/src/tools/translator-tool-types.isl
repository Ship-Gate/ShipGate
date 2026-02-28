# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: TRANSLATOR_TOOL_SCHEMAS, TranslateInput, ValidateASTInput, RepairASTInput, PrintInput, ToolResult, TranslatorError, TranslatorWarning, ResultMetadata, TranslateResult, TranslateData, DomainSummary, ValidateASTResult, ValidationData, ValidationIssue, StructureSummary, RepairASTResult, RepairData, Repair, PrintResult, PrintData, TranslatorToolName
# dependencies: 

domain TranslatorToolTypes {
  version: "1.0.0"

  type TranslateInput = String
  type ValidateASTInput = String
  type RepairASTInput = String
  type PrintInput = String
  type ToolResult = String
  type TranslatorError = String
  type TranslatorWarning = String
  type ResultMetadata = String
  type TranslateResult = String
  type TranslateData = String
  type DomainSummary = String
  type ValidateASTResult = String
  type ValidationData = String
  type ValidationIssue = String
  type StructureSummary = String
  type RepairASTResult = String
  type RepairData = String
  type Repair = String
  type PrintResult = String
  type PrintData = String
  type TranslatorToolName = String

  invariants exports_present {
    - true
  }
}
