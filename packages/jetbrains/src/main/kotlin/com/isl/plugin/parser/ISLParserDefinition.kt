package com.isl.plugin.parser

import com.intellij.lang.ASTNode
import com.intellij.lang.ParserDefinition
import com.intellij.lang.PsiParser
import com.intellij.lexer.Lexer
import com.intellij.openapi.project.Project
import com.intellij.psi.FileViewProvider
import com.intellij.psi.PsiElement
import com.intellij.psi.PsiFile
import com.intellij.psi.tree.IFileElementType
import com.intellij.psi.tree.TokenSet
import com.isl.plugin.lexer.ISLLexerAdapter
import com.isl.plugin.lexer.ISLTokenTypes
import com.isl.plugin.psi.ISLFile
import com.isl.plugin.psi.ISLPsiElementFactory

/**
 * ISL Parser Definition
 */
class ISLParserDefinition : ParserDefinition {
    
    override fun createLexer(project: Project?): Lexer = ISLLexerAdapter()
    
    override fun createParser(project: Project?): PsiParser = ISLParser()
    
    override fun getFileNodeType(): IFileElementType = ISLElementTypes.FILE
    
    override fun getCommentTokens(): TokenSet = ISLTokenTypes.COMMENTS
    
    override fun getStringLiteralElements(): TokenSet = ISLTokenTypes.STRINGS
    
    override fun getWhitespaceTokens(): TokenSet = ISLTokenTypes.WHITESPACES
    
    override fun createElement(node: ASTNode): PsiElement = ISLPsiElementFactory.createElement(node)
    
    override fun createFile(viewProvider: FileViewProvider): PsiFile = ISLFile(viewProvider)
}
