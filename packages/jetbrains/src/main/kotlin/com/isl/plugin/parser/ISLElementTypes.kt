package com.isl.plugin.parser

import com.intellij.psi.tree.IElementType
import com.intellij.psi.tree.IFileElementType
import com.isl.plugin.ISLLanguage

/**
 * ISL PSI Element Types
 */
object ISLElementTypes {
    
    @JvmField
    val FILE = IFileElementType(ISLLanguage)
    
    // Top-level declarations
    @JvmField val DOMAIN_DECLARATION = ISLElementType("DOMAIN_DECLARATION")
    @JvmField val IMPORT_DECLARATION = ISLElementType("IMPORT_DECLARATION")
    @JvmField val ENTITY_DECLARATION = ISLElementType("ENTITY_DECLARATION")
    @JvmField val BEHAVIOR_DECLARATION = ISLElementType("BEHAVIOR_DECLARATION")
    @JvmField val TYPE_DECLARATION = ISLElementType("TYPE_DECLARATION")
    @JvmField val ENUM_DECLARATION = ISLElementType("ENUM_DECLARATION")
    @JvmField val INVARIANTS_BLOCK = ISLElementType("INVARIANTS_BLOCK")
    
    // Entity components
    @JvmField val FIELD_DECLARATION = ISLElementType("FIELD_DECLARATION")
    @JvmField val LIFECYCLE_BLOCK = ISLElementType("LIFECYCLE_BLOCK")
    @JvmField val LIFECYCLE_TRANSITION = ISLElementType("LIFECYCLE_TRANSITION")
    
    // Behavior components
    @JvmField val INPUT_BLOCK = ISLElementType("INPUT_BLOCK")
    @JvmField val OUTPUT_BLOCK = ISLElementType("OUTPUT_BLOCK")
    @JvmField val ERROR_DECLARATION = ISLElementType("ERROR_DECLARATION")
    @JvmField val PRECONDITIONS_BLOCK = ISLElementType("PRECONDITIONS_BLOCK")
    @JvmField val POSTCONDITIONS_BLOCK = ISLElementType("POSTCONDITIONS_BLOCK")
    @JvmField val TEMPORAL_BLOCK = ISLElementType("TEMPORAL_BLOCK")
    @JvmField val SECURITY_BLOCK = ISLElementType("SECURITY_BLOCK")
    @JvmField val COMPLIANCE_BLOCK = ISLElementType("COMPLIANCE_BLOCK")
    @JvmField val ACTORS_BLOCK = ISLElementType("ACTORS_BLOCK")
    @JvmField val SCENARIOS_BLOCK = ISLElementType("SCENARIOS_BLOCK")
    
    // Actor
    @JvmField val ACTOR_DECLARATION = ISLElementType("ACTOR_DECLARATION")
    @JvmField val ACTOR_CONSTRAINT = ISLElementType("ACTOR_CONSTRAINT")
    
    // Conditions
    @JvmField val CONDITION = ISLElementType("CONDITION")
    @JvmField val CONDITION_STATEMENT = ISLElementType("CONDITION_STATEMENT")
    @JvmField val INVARIANT_STATEMENT = ISLElementType("INVARIANT_STATEMENT")
    
    // Temporal
    @JvmField val TEMPORAL_REQUIREMENT = ISLElementType("TEMPORAL_REQUIREMENT")
    
    // Security
    @JvmField val SECURITY_REQUIREMENT = ISLElementType("SECURITY_REQUIREMENT")
    
    // Compliance
    @JvmField val COMPLIANCE_STANDARD = ISLElementType("COMPLIANCE_STANDARD")
    @JvmField val COMPLIANCE_REQUIREMENT = ISLElementType("COMPLIANCE_REQUIREMENT")
    
    // Types
    @JvmField val TYPE_EXPRESSION = ISLElementType("TYPE_EXPRESSION")
    @JvmField val TYPE_CONSTRAINT = ISLElementType("TYPE_CONSTRAINT")
    @JvmField val ANNOTATION = ISLElementType("ANNOTATION")
    @JvmField val ANNOTATION_LIST = ISLElementType("ANNOTATION_LIST")
    
    // Expressions
    @JvmField val EXPRESSION = ISLElementType("EXPRESSION")
    @JvmField val BINARY_EXPRESSION = ISLElementType("BINARY_EXPRESSION")
    @JvmField val UNARY_EXPRESSION = ISLElementType("UNARY_EXPRESSION")
    @JvmField val MEMBER_EXPRESSION = ISLElementType("MEMBER_EXPRESSION")
    @JvmField val CALL_EXPRESSION = ISLElementType("CALL_EXPRESSION")
    @JvmField val REFERENCE_EXPRESSION = ISLElementType("REFERENCE_EXPRESSION")
    @JvmField val LITERAL_EXPRESSION = ISLElementType("LITERAL_EXPRESSION")
    
    // Scenario
    @JvmField val SCENARIO_DECLARATION = ISLElementType("SCENARIO_DECLARATION")
    @JvmField val GIVEN_BLOCK = ISLElementType("GIVEN_BLOCK")
    @JvmField val WHEN_BLOCK = ISLElementType("WHEN_BLOCK")
    @JvmField val THEN_BLOCK = ISLElementType("THEN_BLOCK")
}

/**
 * Custom element type for ISL PSI
 */
class ISLElementType(debugName: String) : IElementType(debugName, ISLLanguage)
