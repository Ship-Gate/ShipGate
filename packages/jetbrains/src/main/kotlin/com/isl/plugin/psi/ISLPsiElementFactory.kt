package com.isl.plugin.psi

import com.intellij.lang.ASTNode
import com.intellij.psi.PsiElement
import com.isl.plugin.parser.ISLElementTypes

/**
 * Factory for creating ISL PSI elements
 */
object ISLPsiElementFactory {
    
    fun createElement(node: ASTNode): PsiElement {
        return when (node.elementType) {
            ISLElementTypes.DOMAIN_DECLARATION -> ISLDomainDeclaration(node)
            ISLElementTypes.ENTITY_DECLARATION -> ISLEntityDeclaration(node)
            ISLElementTypes.BEHAVIOR_DECLARATION -> ISLBehaviorDeclaration(node)
            ISLElementTypes.TYPE_DECLARATION -> ISLTypeDeclaration(node)
            ISLElementTypes.ENUM_DECLARATION -> ISLEnumDeclaration(node)
            ISLElementTypes.FIELD_DECLARATION -> ISLFieldDeclaration(node)
            ISLElementTypes.TYPE_EXPRESSION -> ISLTypeExpression(node)
            ISLElementTypes.ANNOTATION_LIST -> ISLAnnotationList(node)
            ISLElementTypes.ANNOTATION -> ISLAnnotation(node)
            ISLElementTypes.INPUT_BLOCK -> ISLInputBlock(node)
            ISLElementTypes.OUTPUT_BLOCK -> ISLOutputBlock(node)
            ISLElementTypes.ERROR_DECLARATION -> ISLErrorDeclaration(node)
            ISLElementTypes.PRECONDITIONS_BLOCK -> ISLPreconditionsBlock(node)
            ISLElementTypes.POSTCONDITIONS_BLOCK -> ISLPostconditionsBlock(node)
            ISLElementTypes.INVARIANTS_BLOCK -> ISLInvariantsBlock(node)
            ISLElementTypes.TEMPORAL_BLOCK -> ISLTemporalBlock(node)
            ISLElementTypes.SECURITY_BLOCK -> ISLSecurityBlock(node)
            ISLElementTypes.COMPLIANCE_BLOCK -> ISLComplianceBlock(node)
            ISLElementTypes.ACTORS_BLOCK -> ISLActorsBlock(node)
            ISLElementTypes.LIFECYCLE_BLOCK -> ISLLifecycleBlock(node)
            else -> ISLGenericElement(node)
        }
    }
}

/**
 * Generic PSI element for unhandled types
 */
class ISLGenericElement(node: ASTNode) : ISLPsiElement(node)
