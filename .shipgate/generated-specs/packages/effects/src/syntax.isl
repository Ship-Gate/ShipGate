# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: parseEffectDeclaration, parseEffectAnnotation, generateISLSyntax, generateBehaviorEffects, parseHandlerDeclaration, generateTypeScript, ISLEffectDeclaration, ISLEffectOperation, ISLEffectParam, ISLEffectAnnotation, ISLHandlerDeclaration, ISLHandlerImpl, ISLEffectPolymorphicFn, ISLEffectScope
# dependencies: 

domain Syntax {
  version: "1.0.0"

  type ISLEffectDeclaration = String
  type ISLEffectOperation = String
  type ISLEffectParam = String
  type ISLEffectAnnotation = String
  type ISLHandlerDeclaration = String
  type ISLHandlerImpl = String
  type ISLEffectPolymorphicFn = String
  type ISLEffectScope = String

  invariants exports_present {
    - true
  }
}
