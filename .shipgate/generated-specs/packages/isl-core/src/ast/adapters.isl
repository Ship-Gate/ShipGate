# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: locationToSpan, spanToLocation, domainToDeclaration, entityToDeclaration, fieldToDeclaration, typeToDeclaration, behaviorToDeclaration, invariantBlockToInvariantsBlock, isParserAST, isLegacyAST, normalizeToDeclaration, ParserDomain, ParserEntity, ParserBehavior, ParserField, ParserTypeDeclaration, ParserInvariantBlock
# dependencies: 

domain Adapters {
  version: "1.0.0"

  type ParserDomain = String
  type ParserEntity = String
  type ParserBehavior = String
  type ParserField = String
  type ParserTypeDeclaration = String
  type ParserInvariantBlock = String

  invariants exports_present {
    - true
  }
}
