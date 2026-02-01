package com.isl.plugin.highlighting

import com.intellij.lexer.Lexer
import com.intellij.openapi.editor.DefaultLanguageHighlighterColors
import com.intellij.openapi.editor.HighlighterColors
import com.intellij.openapi.editor.colors.TextAttributesKey
import com.intellij.openapi.editor.colors.TextAttributesKey.createTextAttributesKey
import com.intellij.openapi.fileTypes.SyntaxHighlighterBase
import com.intellij.psi.tree.IElementType
import com.isl.plugin.lexer.ISLLexerAdapter
import com.isl.plugin.lexer.ISLTokenTypes

/**
 * ISL Syntax Highlighter
 */
class ISLSyntaxHighlighter : SyntaxHighlighterBase() {
    
    companion object {
        // Text attribute keys
        val KEYWORD = createTextAttributesKey("ISL_KEYWORD", DefaultLanguageHighlighterColors.KEYWORD)
        val TYPE = createTextAttributesKey("ISL_TYPE", DefaultLanguageHighlighterColors.CLASS_NAME)
        val ANNOTATION = createTextAttributesKey("ISL_ANNOTATION", DefaultLanguageHighlighterColors.METADATA)
        val STRING = createTextAttributesKey("ISL_STRING", DefaultLanguageHighlighterColors.STRING)
        val NUMBER = createTextAttributesKey("ISL_NUMBER", DefaultLanguageHighlighterColors.NUMBER)
        val DURATION = createTextAttributesKey("ISL_DURATION", DefaultLanguageHighlighterColors.NUMBER)
        val COMMENT = createTextAttributesKey("ISL_COMMENT", DefaultLanguageHighlighterColors.LINE_COMMENT)
        val OPERATOR = createTextAttributesKey("ISL_OPERATOR", DefaultLanguageHighlighterColors.OPERATION_SIGN)
        val BRACE = createTextAttributesKey("ISL_BRACE", DefaultLanguageHighlighterColors.BRACES)
        val BRACKET = createTextAttributesKey("ISL_BRACKET", DefaultLanguageHighlighterColors.BRACKETS)
        val PAREN = createTextAttributesKey("ISL_PAREN", DefaultLanguageHighlighterColors.PARENTHESES)
        val IDENTIFIER = createTextAttributesKey("ISL_IDENTIFIER", DefaultLanguageHighlighterColors.IDENTIFIER)
        val FIELD = createTextAttributesKey("ISL_FIELD", DefaultLanguageHighlighterColors.INSTANCE_FIELD)
        val CONSTANT = createTextAttributesKey("ISL_CONSTANT", DefaultLanguageHighlighterColors.CONSTANT)
        val BAD_CHARACTER = createTextAttributesKey("ISL_BAD_CHARACTER", HighlighterColors.BAD_CHARACTER)
        
        // Token to key mapping
        private val KEYWORD_KEYS = arrayOf(KEYWORD)
        private val TYPE_KEYS = arrayOf(TYPE)
        private val STRING_KEYS = arrayOf(STRING)
        private val NUMBER_KEYS = arrayOf(NUMBER)
        private val DURATION_KEYS = arrayOf(DURATION)
        private val COMMENT_KEYS = arrayOf(COMMENT)
        private val OPERATOR_KEYS = arrayOf(OPERATOR)
        private val BRACE_KEYS = arrayOf(BRACE)
        private val BRACKET_KEYS = arrayOf(BRACKET)
        private val PAREN_KEYS = arrayOf(PAREN)
        private val IDENTIFIER_KEYS = arrayOf(IDENTIFIER)
        private val CONSTANT_KEYS = arrayOf(CONSTANT)
        private val BAD_CHARACTER_KEYS = arrayOf(BAD_CHARACTER)
        private val EMPTY_KEYS = emptyArray<TextAttributesKey>()
    }
    
    override fun getHighlightingLexer(): Lexer = ISLLexerAdapter()
    
    override fun getTokenHighlights(tokenType: IElementType?): Array<TextAttributesKey> {
        return when (tokenType) {
            // Keywords
            ISLTokenTypes.DOMAIN,
            ISLTokenTypes.VERSION,
            ISLTokenTypes.IMPORTS,
            ISLTokenTypes.ENTITY,
            ISLTokenTypes.BEHAVIOR,
            ISLTokenTypes.TYPE,
            ISLTokenTypes.ENUM,
            ISLTokenTypes.INPUT,
            ISLTokenTypes.OUTPUT,
            ISLTokenTypes.SUCCESS,
            ISLTokenTypes.ERRORS,
            ISLTokenTypes.PRECONDITIONS,
            ISLTokenTypes.POSTCONDITIONS,
            ISLTokenTypes.INVARIANTS,
            ISLTokenTypes.TEMPORAL,
            ISLTokenTypes.SECURITY,
            ISLTokenTypes.COMPLIANCE,
            ISLTokenTypes.ACTORS,
            ISLTokenTypes.SCENARIOS,
            ISLTokenTypes.CHAOS,
            ISLTokenTypes.LIFECYCLE,
            ISLTokenTypes.DESCRIPTION,
            ISLTokenTypes.IMPLIES,
            ISLTokenTypes.WHEN,
            ISLTokenTypes.AND,
            ISLTokenTypes.OR,
            ISLTokenTypes.NOT,
            ISLTokenTypes.IN,
            ISLTokenTypes.FOR,
            ISLTokenTypes.MUST,
            ISLTokenTypes.OWNS,
            ISLTokenTypes.EVENTUALLY,
            ISLTokenTypes.WITHIN,
            ISLTokenTypes.IMMEDIATELY,
            ISLTokenTypes.NEVER,
            ISLTokenTypes.ALWAYS,
            ISLTokenTypes.ALL,
            ISLTokenTypes.ANY,
            ISLTokenTypes.COUNT,
            ISLTokenTypes.SUM,
            ISLTokenTypes.OLD,
            ISLTokenTypes.RETRIABLE,
            ISLTokenTypes.RETRY_AFTER,
            ISLTokenTypes.RATE_LIMIT,
            ISLTokenTypes.PER,
            ISLTokenTypes.ENABLED,
            ISLTokenTypes.SCOPE,
            ISLTokenTypes.GLOBAL -> KEYWORD_KEYS
            
            // Boolean/Null literals
            ISLTokenTypes.TRUE,
            ISLTokenTypes.FALSE,
            ISLTokenTypes.NULL -> CONSTANT_KEYS
            
            // Literals
            ISLTokenTypes.STRING -> STRING_KEYS
            ISLTokenTypes.NUMBER -> NUMBER_KEYS
            ISLTokenTypes.DURATION,
            ISLTokenTypes.PERCENTILE -> DURATION_KEYS
            
            // Operators
            ISLTokenTypes.EQ,
            ISLTokenTypes.NEQ,
            ISLTokenTypes.ASSIGN,
            ISLTokenTypes.GT,
            ISLTokenTypes.LT,
            ISLTokenTypes.GTE,
            ISLTokenTypes.LTE,
            ISLTokenTypes.ARROW,
            ISLTokenTypes.FAT_ARROW -> OPERATOR_KEYS
            
            // Braces
            ISLTokenTypes.LBRACE,
            ISLTokenTypes.RBRACE -> BRACE_KEYS
            
            // Brackets
            ISLTokenTypes.LBRACKET,
            ISLTokenTypes.RBRACKET -> BRACKET_KEYS
            
            // Parentheses
            ISLTokenTypes.LPAREN,
            ISLTokenTypes.RPAREN -> PAREN_KEYS
            
            // Comments
            ISLTokenTypes.COMMENT -> COMMENT_KEYS
            
            // Identifiers
            ISLTokenTypes.IDENTIFIER -> IDENTIFIER_KEYS
            
            // Bad character
            ISLTokenTypes.BAD_CHARACTER -> BAD_CHARACTER_KEYS
            
            else -> EMPTY_KEYS
        }
    }
}
