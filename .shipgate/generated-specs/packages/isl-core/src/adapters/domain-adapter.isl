# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: spanToLocation, locationToSpan, defaultLocation, adaptIdentifier, adaptStringLiteral, adaptUseToImport, adaptField, adaptEntity, adaptBehavior, adaptInvariantsBlock, domainDeclarationToDomain, validateForConversion, domainToDomainDeclaration, SourceLocation, ParserASTNode, ParserDomain, ParserIdentifier, ParserStringLiteral, ParserImport, ParserImportItem, ParserTypeDeclaration, ParserEntity, ParserField, ParserBehavior, ParserActorSpec, ParserInputSpec, ParserOutputSpec, ParserErrorSpec, ParserPostconditionBlock, ParserTemporalSpec, ParserSecuritySpec, ParserComplianceSpec, ParserInvariantBlock, ParserPolicy, ParserView, ParserScenarioBlock, ParserChaosBlock, ValidationResult
# dependencies: 

domain DomainAdapter {
  version: "1.0.0"

  type SourceLocation = String
  type ParserASTNode = String
  type ParserDomain = String
  type ParserIdentifier = String
  type ParserStringLiteral = String
  type ParserImport = String
  type ParserImportItem = String
  type ParserTypeDeclaration = String
  type ParserEntity = String
  type ParserField = String
  type ParserBehavior = String
  type ParserActorSpec = String
  type ParserInputSpec = String
  type ParserOutputSpec = String
  type ParserErrorSpec = String
  type ParserPostconditionBlock = String
  type ParserTemporalSpec = String
  type ParserSecuritySpec = String
  type ParserComplianceSpec = String
  type ParserInvariantBlock = String
  type ParserPolicy = String
  type ParserView = String
  type ParserScenarioBlock = String
  type ParserChaosBlock = String
  type ValidationResult = String

  invariants exports_present {
    - true
  }
}
