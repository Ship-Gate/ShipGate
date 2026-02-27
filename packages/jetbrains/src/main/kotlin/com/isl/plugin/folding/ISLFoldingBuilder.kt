package com.isl.plugin.folding

import com.intellij.lang.ASTNode
import com.intellij.lang.folding.FoldingBuilderEx
import com.intellij.lang.folding.FoldingDescriptor
import com.intellij.openapi.editor.Document
import com.intellij.openapi.editor.FoldingGroup
import com.intellij.openapi.project.DumbAware
import com.intellij.psi.PsiElement
import com.intellij.psi.util.PsiTreeUtil
import com.isl.plugin.parser.ISLElementTypes
import com.isl.plugin.psi.*

/**
 * ISL Folding Builder
 */
class ISLFoldingBuilder : FoldingBuilderEx(), DumbAware {
    
    override fun buildFoldRegions(
        root: PsiElement,
        document: Document,
        quick: Boolean
    ): Array<FoldingDescriptor> {
        val descriptors = mutableListOf<FoldingDescriptor>()
        
        // Fold domain declarations
        PsiTreeUtil.findChildrenOfType(root, ISLDomainDeclaration::class.java).forEach { domain ->
            addFoldingDescriptor(descriptors, domain, "domain ${domain.name} {...}")
        }
        
        // Fold entity declarations
        PsiTreeUtil.findChildrenOfType(root, ISLEntityDeclaration::class.java).forEach { entity ->
            addFoldingDescriptor(descriptors, entity, "entity ${entity.name} {...}")
        }
        
        // Fold behavior declarations
        PsiTreeUtil.findChildrenOfType(root, ISLBehaviorDeclaration::class.java).forEach { behavior ->
            addFoldingDescriptor(descriptors, behavior, "behavior ${behavior.name} {...}")
        }
        
        // Fold enum declarations
        PsiTreeUtil.findChildrenOfType(root, ISLEnumDeclaration::class.java).forEach { enum ->
            addFoldingDescriptor(descriptors, enum, "enum ${enum.name} {...}")
        }
        
        // Fold blocks
        PsiTreeUtil.findChildrenOfType(root, ISLInputBlock::class.java).forEach { block ->
            addFoldingDescriptor(descriptors, block, "input {...}")
        }
        
        PsiTreeUtil.findChildrenOfType(root, ISLOutputBlock::class.java).forEach { block ->
            addFoldingDescriptor(descriptors, block, "output {...}")
        }
        
        PsiTreeUtil.findChildrenOfType(root, ISLPreconditionsBlock::class.java).forEach { block ->
            addFoldingDescriptor(descriptors, block, "preconditions {...}")
        }
        
        PsiTreeUtil.findChildrenOfType(root, ISLPostconditionsBlock::class.java).forEach { block ->
            addFoldingDescriptor(descriptors, block, "postconditions {...}")
        }
        
        PsiTreeUtil.findChildrenOfType(root, ISLInvariantsBlock::class.java).forEach { block ->
            addFoldingDescriptor(descriptors, block, "invariants {...}")
        }
        
        PsiTreeUtil.findChildrenOfType(root, ISLTemporalBlock::class.java).forEach { block ->
            addFoldingDescriptor(descriptors, block, "temporal {...}")
        }
        
        PsiTreeUtil.findChildrenOfType(root, ISLSecurityBlock::class.java).forEach { block ->
            addFoldingDescriptor(descriptors, block, "security {...}")
        }
        
        return descriptors.toTypedArray()
    }
    
    private fun addFoldingDescriptor(
        descriptors: MutableList<FoldingDescriptor>,
        element: PsiElement,
        placeholder: String
    ) {
        val textRange = element.textRange
        if (textRange.length > 0) {
            descriptors.add(
                FoldingDescriptor(
                    element.node,
                    textRange,
                    FoldingGroup.newGroup("ISL"),
                    placeholder
                )
            )
        }
    }
    
    override fun getPlaceholderText(node: ASTNode): String {
        return when (node.elementType) {
            ISLElementTypes.DOMAIN_DECLARATION -> "domain {...}"
            ISLElementTypes.ENTITY_DECLARATION -> "entity {...}"
            ISLElementTypes.BEHAVIOR_DECLARATION -> "behavior {...}"
            ISLElementTypes.ENUM_DECLARATION -> "enum {...}"
            ISLElementTypes.INPUT_BLOCK -> "input {...}"
            ISLElementTypes.OUTPUT_BLOCK -> "output {...}"
            ISLElementTypes.PRECONDITIONS_BLOCK -> "preconditions {...}"
            ISLElementTypes.POSTCONDITIONS_BLOCK -> "postconditions {...}"
            ISLElementTypes.INVARIANTS_BLOCK -> "invariants {...}"
            ISLElementTypes.TEMPORAL_BLOCK -> "temporal {...}"
            ISLElementTypes.SECURITY_BLOCK -> "security {...}"
            else -> "{...}"
        }
    }
    
    override fun isCollapsedByDefault(node: ASTNode): Boolean {
        // Don't collapse by default
        return false
    }
}
