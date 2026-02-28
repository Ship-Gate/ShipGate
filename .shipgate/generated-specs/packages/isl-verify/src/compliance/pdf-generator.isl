# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: generatePdfReport, generatePdfFromMarkdown, generateEnhancedPdf, PdfGeneratorOptions, EnhancedPdfOptions
# dependencies: fs, puppeteer, markdown-pdf

domain PdfGenerator {
  version: "1.0.0"

  type PdfGeneratorOptions = String
  type EnhancedPdfOptions = String

  invariants exports_present {
    - true
  }
}
