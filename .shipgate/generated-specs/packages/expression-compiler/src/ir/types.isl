# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: generateNodeId, resetNodeIdCounter, IR, SUPPORTED_PATTERNS, IRNode, IRSourceLoc, IRExpr, IRLiteralNull, IRLiteralBool, IRLiteralNumber, IRLiteralString, IRLiteralRegex, IRLiteralList, IRLiteralMap, IRVariable, IRPropertyAccess, IRIndexAccess, IRExistence, IRStringLength, IRStringMatches, IRStringIncludes, IRStringStartsWith, IRStringEndsWith, ComparisonOperator, IRComparison, IRBetween, IREqualityCheck, IRInSet, IRLogicalAnd, IRLogicalOr, IRLogicalNot, IRLogicalImplies, IRArrayLength, IRArrayIncludes, IRArrayEvery, IRArraySome, IRArrayFilter, IRArrayMap, IRQuantifierAll, IRQuantifierAny, IRQuantifierNone, IRQuantifierCount, ArithmeticOperator, IRArithmetic, IRConditional, IROldValue, IRResultValue, IRInputValue, IRFunctionCall, IREntityExists, IREntityLookup, IREntityCount
# dependencies: 

domain Types {
  version: "1.0.0"

  type IRNode = String
  type IRSourceLoc = String
  type IRExpr = String
  type IRLiteralNull = String
  type IRLiteralBool = String
  type IRLiteralNumber = String
  type IRLiteralString = String
  type IRLiteralRegex = String
  type IRLiteralList = String
  type IRLiteralMap = String
  type IRVariable = String
  type IRPropertyAccess = String
  type IRIndexAccess = String
  type IRExistence = String
  type IRStringLength = String
  type IRStringMatches = String
  type IRStringIncludes = String
  type IRStringStartsWith = String
  type IRStringEndsWith = String
  type ComparisonOperator = String
  type IRComparison = String
  type IRBetween = String
  type IREqualityCheck = String
  type IRInSet = String
  type IRLogicalAnd = String
  type IRLogicalOr = String
  type IRLogicalNot = String
  type IRLogicalImplies = String
  type IRArrayLength = String
  type IRArrayIncludes = String
  type IRArrayEvery = String
  type IRArraySome = String
  type IRArrayFilter = String
  type IRArrayMap = String
  type IRQuantifierAll = String
  type IRQuantifierAny = String
  type IRQuantifierNone = String
  type IRQuantifierCount = String
  type ArithmeticOperator = String
  type IRArithmetic = String
  type IRConditional = String
  type IROldValue = String
  type IRResultValue = String
  type IRInputValue = String
  type IRFunctionCall = String
  type IREntityExists = String
  type IREntityLookup = String
  type IREntityCount = String

  invariants exports_present {
    - true
  }
}
