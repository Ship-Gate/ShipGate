# Compliance Report Generator

Generate compliance-ready documentation automatically from ISL Verify proof bundles.

## Overview

The Compliance Report Generator maps ISL Verify's property proofs to specific compliance framework controls, producing auditor-ready reports in multiple formats.

## Supported Frameworks

- **SOC 2 Type II** — Trust Services Criteria (2017)
- **HIPAA** — Security Rule (45 CFR Part 164)
- **PCI-DSS** — Payment Card Industry Data Security Standard v4.0
- **EU AI Act** — High-Risk AI Systems Requirements (2024)

## Property → Control Mappings

### SOC 2

| Control | ISL Verify Properties | Risk Level |
|---------|---------------------|------------|
| CC6.1 (Logical Access) | auth-coverage, auth-enforcement | Critical |
| CC6.6 (System Operations) | error-handling, input-validation | High |
| CC6.8 (Change Management) | import-integrity, type-safety | Medium |
| CC7.1 (System Monitoring) | type-safety, import-integrity, error-handling | Medium |
| CC8.1 (Data Protection) | secret-exposure, data-leakage | Critical |

### HIPAA

| Control | ISL Verify Properties | Risk Level |
|---------|---------------------|------------|
| §164.312(a)(1) Access Control | auth-coverage, auth-enforcement | Critical |
| §164.312(e)(1) Transmission Security | secret-exposure, data-leakage | Critical |
| §164.312(c)(1) Integrity | type-safety, input-validation, sql-injection | High |
| §164.308(a)(1)(ii)(B) Risk Management | error-handling, xss-prevention, sql-injection | High |

### PCI-DSS

| Control | ISL Verify Properties | Risk Level |
|---------|---------------------|------------|
| Req 6.5 Common Vulnerabilities | sql-injection, xss-prevention, input-validation, error-handling | Critical |
| Req 6.6 Public-Facing Apps | auth-coverage, input-validation, sql-injection | Critical |
| Req 8.2 User Authentication | auth-coverage, auth-enforcement, secret-exposure | Critical |
| Req 2.2 Configuration Standards | type-safety, error-handling, import-integrity | Medium |

### EU AI Act

| Control | ISL Verify Properties | Risk Level |
|---------|---------------------|------------|
| Article 9 Risk Management | type-safety, error-handling, input-validation, auth-coverage, import-integrity | High |
| Article 15 Accuracy & Robustness | type-safety, input-validation, error-handling | High |
| Article 12 Record-keeping | import-integrity, type-safety | Medium |
| Article 10 Data Governance | input-validation, sql-injection, data-leakage | High |

## Usage

### CLI Commands

```bash
# Generate SOC 2 report
isl-verify compliance soc2 --bundle ./proof-bundle.json

# Generate HIPAA report with all formats
isl-verify compliance hipaa --bundle ./proof-bundle.json --format all

# Generate PCI-DSS report with enhanced PDF
isl-verify compliance pci-dss \
  --bundle ./proof-bundle.json \
  --format pdf \
  --enhanced \
  --organization "Acme Corp" \
  --logo https://example.com/logo.png

# Generate EU AI Act report with custom output
isl-verify compliance eu-ai-act \
  --bundle ./proof-bundle.json \
  --output ./compliance-reports \
  --project "AI Recommendation System"
```

### Programmatic API

```typescript
import { 
  ComplianceReportGenerator,
  formatMarkdownReport,
  generatePdfReport 
} from '@isl-lang/isl-verify/compliance';

// Load proof bundle
const proofBundle = JSON.parse(fs.readFileSync('./proof-bundle.json', 'utf-8'));

// Generate report
const generator = new ComplianceReportGenerator(proofBundle, 'my-project');
const report = generator.generateReport('soc2');

// Format as markdown
const markdown = formatMarkdownReport(report);
fs.writeFileSync('./soc2-report.md', markdown);

// Generate PDF
await generatePdfReport(report, {
  outputPath: './soc2-report.html',
  format: 'A4'
});
```

## Report Formats

### Markdown

Human-readable markdown with:
- Executive summary table
- Control-by-control evidence
- Remediation recommendations
- Proof bundle references

### HTML

Styled HTML with:
- Professional CSS styling
- Color-coded status badges
- Risk level indicators
- Print-optimized layout

### PDF

Print-ready PDF (via HTML) with:
- Table of contents
- Page numbers
- Custom headers/footers
- Organization logo

### JSON

Machine-readable JSON with:
- Full report structure
- All evidence details
- Proof bundle metadata
- Programmatic access

## Report Structure

Each compliance report includes:

### Executive Summary
- Total controls assessed
- Compliant/Partial/Non-compliant counts
- Overall compliance status
- Critical gaps requiring attention
- High priority remediation items

### Control Evidence (per control)
- Control ID and name
- Compliance status (✅/⚠️/❌)
- Risk level (Critical/High/Medium/Low)
- Control description
- Evidence from property proofs:
  - Property name
  - Verification status
  - Summary
  - Confidence level
  - Verification method
  - Evidence count
  - Proof bundle reference
- Remediation recommendations (if needed)

### Audit Trail
- Proof bundle ID and signature
- Generation timestamp
- ISL Verify version
- Framework version

## Enterprise Use Cases

### Pre-Audit Preparation
Run compliance reports before auditor engagement to:
- Identify gaps early
- Generate evidence documentation
- Track remediation progress
- Build audit readiness

### Continuous Compliance
Integrate into CI/CD to:
- Block deployments with critical gaps
- Track compliance drift over time
- Alert on new violations
- Automate evidence collection

### Multi-Framework Compliance
Generate reports for multiple frameworks:
- SOC 2 + HIPAA for healthtech
- PCI-DSS + SOC 2 for fintech
- EU AI Act + SOC 2 for AI products
- Cross-framework gap analysis

### Auditor Handoff
Provide auditors with:
- Formatted compliance evidence
- Verifiable proof bundles
- Control-to-code mappings
- Automated verification details

## Examples

See `sample-reports.ts` for complete examples:

```typescript
import { 
  generateSampleSoc2Compliant,
  generateSampleHipaaCompliant,
  generateSamplePciDssCompliant,
  generateSampleEuAiActPartial
} from '@isl-lang/isl-verify/compliance';

// Generate sample compliant SOC 2 report
const soc2Report = generateSampleSoc2Compliant();

// Generate sample partial EU AI Act report
const aiActReport = generateSampleEuAiActPartial();
```

## Integration with ISL Verify

The compliance report generator is designed to work seamlessly with ISL Verify's proof bundle output:

```bash
# 1. Run ISL Verify to generate proof bundle
isl-verify . --output ./proof-bundle.json

# 2. Generate compliance reports
isl-verify compliance soc2 --bundle ./proof-bundle.json --format all
isl-verify compliance hipaa --bundle ./proof-bundle.json --format all
isl-verify compliance pci-dss --bundle ./proof-bundle.json --format all

# 3. Share with auditors
# - soc2-compliance-report.md
# - soc2-compliance-report.html
# - soc2-compliance-report.json
```

## Exit Codes

- `0` — Compliant or partial compliance with no critical gaps
- `1` — Non-compliant or critical gaps exist

## Future Enhancements

- FedRAMP compliance mapping
- ISO 27001 compliance mapping
- Custom framework definitions
- Gap analysis across frameworks
- Remediation tracking over time
- Integration with compliance management tools
- Automated auditor email notifications
