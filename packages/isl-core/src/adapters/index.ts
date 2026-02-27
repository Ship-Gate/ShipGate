/**
 * Adapters
 * 
 * Type adapters for interoperability between different AST representations.
 * 
 * @see ADR-001-ast-type-unification.md
 */

export {
  // Main adapters
  domainDeclarationToDomain,
  domainToDomainDeclaration,
  
  // Utility adapters
  spanToLocation,
  locationToSpan,
  defaultLocation,
  adaptIdentifier,
  adaptStringLiteral,
  adaptEntity,
  adaptBehavior,
  adaptField,
  adaptUseToImport,
  adaptInvariantsBlock,
  
  // Validation
  validateForConversion,
  type ValidationResult,
  
  // Parser types (for reference)
  type SourceLocation,
  type ParserASTNode,
  type ParserDomain,
  type ParserIdentifier,
  type ParserStringLiteral,
  type ParserImport,
  type ParserEntity,
  type ParserBehavior,
  type ParserField,
} from './domain-adapter.js';
