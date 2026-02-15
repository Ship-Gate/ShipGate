# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: createError, createWarning, undefinedTypeError, undefinedEntityError, undefinedFieldError, undefinedVariableError, undefinedBehaviorError, undefinedEnumVariantError, duplicateTypeError, duplicateEntityError, duplicateFieldError, duplicateBehaviorError, typeMismatchError, incompatibleTypesError, invalidOperatorError, oldOutsidePostconditionError, resultOutsidePostconditionError, inputInvalidFieldError, invalidLifecycleStateError, invalidEntityLookupError, invalidEntityExistsError, invalidConstraintValueError, circularReferenceError, ErrorCodes, DiagnosticSeverity, RelatedInformation, Diagnostic, ErrorCode
# dependencies: @isl-lang/errors

domain Errors {
  version: "1.0.0"

  type DiagnosticSeverity = String
  type RelatedInformation = String
  type Diagnostic = String
  type ErrorCode = String

  invariants exports_present {
    - true
  }
}
