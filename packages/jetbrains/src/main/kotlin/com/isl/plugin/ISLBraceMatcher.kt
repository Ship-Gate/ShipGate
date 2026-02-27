package com.isl.plugin

import com.intellij.lang.BracePair
import com.intellij.lang.PairedBraceMatcher
import com.intellij.psi.PsiFile
import com.intellij.psi.tree.IElementType
import com.isl.plugin.lexer.ISLTokenTypes

/**
 * ISL Brace Matcher
 */
class ISLBraceMatcher : PairedBraceMatcher {
    
    companion object {
        private val BRACE_PAIRS = arrayOf(
            BracePair(ISLTokenTypes.LBRACE, ISLTokenTypes.RBRACE, true),
            BracePair(ISLTokenTypes.LBRACKET, ISLTokenTypes.RBRACKET, false),
            BracePair(ISLTokenTypes.LPAREN, ISLTokenTypes.RPAREN, false),
        )
    }
    
    override fun getPairs(): Array<BracePair> = BRACE_PAIRS
    
    override fun isPairedBracesAllowedBeforeType(
        lbraceType: IElementType,
        contextType: IElementType?
    ): Boolean = true
    
    override fun getCodeConstructStart(
        file: PsiFile?,
        openingBraceOffset: Int
    ): Int = openingBraceOffset
}
