package com.isl.plugin.lexer

import com.intellij.lexer.LexerBase

/**
 * Adapter for ISL Lexer to work with IntelliJ APIs
 */
class ISLLexerAdapter : LexerBase() {
    
    private val lexer = ISLLexer()
    
    override fun start(buffer: CharSequence, startOffset: Int, endOffset: Int, initialState: Int) {
        lexer.start(buffer, startOffset, endOffset, initialState)
    }
    
    override fun getState(): Int = lexer.state
    
    override fun getTokenType() = lexer.tokenType
    
    override fun getTokenStart(): Int = lexer.tokenStart
    
    override fun getTokenEnd(): Int = lexer.tokenEnd
    
    override fun advance() {
        lexer.advance()
    }
    
    override fun getBufferSequence(): CharSequence = lexer.bufferSequence
    
    override fun getBufferEnd(): Int = lexer.bufferEnd
}
