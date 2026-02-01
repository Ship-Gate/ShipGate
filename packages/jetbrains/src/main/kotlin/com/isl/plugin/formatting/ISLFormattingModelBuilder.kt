package com.isl.plugin.formatting

import com.intellij.formatting.*
import com.intellij.lang.ASTNode
import com.intellij.psi.PsiFile
import com.intellij.psi.codeStyle.CodeStyleSettings
import com.intellij.psi.formatter.common.AbstractBlock
import com.isl.plugin.ISLLanguage
import com.isl.plugin.lexer.ISLTokenTypes
import com.isl.plugin.parser.ISLElementTypes

/**
 * ISL Formatting Model Builder
 */
class ISLFormattingModelBuilder : FormattingModelBuilder {
    
    override fun createModel(formattingContext: FormattingContext): FormattingModel {
        val settings = formattingContext.codeStyleSettings
        val containingFile = formattingContext.containingFile
        
        val block = ISLFormattingBlock(
            containingFile.node,
            Wrap.createWrap(WrapType.NONE, false),
            null,
            createSpaceBuilder(settings)
        )
        
        return FormattingModelProvider.createFormattingModelForPsiFile(
            containingFile,
            block,
            settings
        )
    }
    
    private fun createSpaceBuilder(settings: CodeStyleSettings): SpacingBuilder {
        return SpacingBuilder(settings, ISLLanguage)
            // Space after keywords
            .after(ISLTokenTypes.DOMAIN).spaces(1)
            .after(ISLTokenTypes.ENTITY).spaces(1)
            .after(ISLTokenTypes.BEHAVIOR).spaces(1)
            .after(ISLTokenTypes.TYPE).spaces(1)
            .after(ISLTokenTypes.ENUM).spaces(1)
            // Space after colon
            .after(ISLTokenTypes.COLON).spaces(1)
            // Space around operators
            .around(ISLTokenTypes.ASSIGN).spaces(1)
            .around(ISLTokenTypes.EQ).spaces(1)
            .around(ISLTokenTypes.NEQ).spaces(1)
            .around(ISLTokenTypes.GT).spaces(1)
            .around(ISLTokenTypes.LT).spaces(1)
            .around(ISLTokenTypes.GTE).spaces(1)
            .around(ISLTokenTypes.LTE).spaces(1)
            .around(ISLTokenTypes.ARROW).spaces(1)
            // No space before colon
            .before(ISLTokenTypes.COLON).spaces(0)
            // No space after opening brace
            .after(ISLTokenTypes.LBRACE).lineBreakInCode()
            // Line break before closing brace
            .before(ISLTokenTypes.RBRACE).lineBreakInCode()
    }
}

/**
 * ISL Formatting Block
 */
class ISLFormattingBlock(
    node: ASTNode,
    wrap: Wrap?,
    alignment: Alignment?,
    private val spacingBuilder: SpacingBuilder
) : AbstractBlock(node, wrap, alignment) {
    
    override fun buildChildren(): List<Block> {
        val blocks = mutableListOf<Block>()
        var child = myNode.firstChildNode
        
        while (child != null) {
            if (child.elementType != ISLTokenTypes.WHITE_SPACE &&
                child.elementType != ISLTokenTypes.NEWLINE) {
                blocks.add(
                    ISLFormattingBlock(
                        child,
                        Wrap.createWrap(WrapType.NONE, false),
                        null,
                        spacingBuilder
                    )
                )
            }
            child = child.treeNext
        }
        
        return blocks
    }
    
    override fun getIndent(): Indent? {
        val elementType = myNode.elementType
        val parentType = myNode.treeParent?.elementType
        
        // Indent contents of blocks
        if (parentType in listOf(
            ISLElementTypes.DOMAIN_DECLARATION,
            ISLElementTypes.ENTITY_DECLARATION,
            ISLElementTypes.BEHAVIOR_DECLARATION,
            ISLElementTypes.ENUM_DECLARATION,
            ISLElementTypes.INPUT_BLOCK,
            ISLElementTypes.OUTPUT_BLOCK,
            ISLElementTypes.PRECONDITIONS_BLOCK,
            ISLElementTypes.POSTCONDITIONS_BLOCK,
            ISLElementTypes.INVARIANTS_BLOCK,
            ISLElementTypes.TEMPORAL_BLOCK,
            ISLElementTypes.SECURITY_BLOCK,
            ISLElementTypes.ACTORS_BLOCK
        )) {
            if (elementType != ISLTokenTypes.LBRACE && elementType != ISLTokenTypes.RBRACE) {
                return Indent.getNormalIndent()
            }
        }
        
        return Indent.getNoneIndent()
    }
    
    override fun getSpacing(child1: Block?, child2: Block): Spacing? {
        return spacingBuilder.getSpacing(this, child1, child2)
    }
    
    override fun isLeaf(): Boolean = myNode.firstChildNode == null
}
