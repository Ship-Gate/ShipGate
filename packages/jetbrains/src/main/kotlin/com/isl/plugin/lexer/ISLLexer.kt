package com.isl.plugin.lexer

import com.intellij.lexer.LexerBase
import com.intellij.psi.tree.IElementType

/**
 * ISL Lexer
 * 
 * Tokenizes ISL source files.
 */
class ISLLexer : LexerBase() {
    
    private var buffer: CharSequence = ""
    private var bufferEnd: Int = 0
    private var tokenStart: Int = 0
    private var tokenEnd: Int = 0
    private var tokenType: IElementType? = null
    
    private val keywords = mapOf(
        "domain" to ISLTokenTypes.DOMAIN,
        "version" to ISLTokenTypes.VERSION,
        "imports" to ISLTokenTypes.IMPORTS,
        "entity" to ISLTokenTypes.ENTITY,
        "behavior" to ISLTokenTypes.BEHAVIOR,
        "type" to ISLTokenTypes.TYPE,
        "enum" to ISLTokenTypes.ENUM,
        "input" to ISLTokenTypes.INPUT,
        "output" to ISLTokenTypes.OUTPUT,
        "success" to ISLTokenTypes.SUCCESS,
        "errors" to ISLTokenTypes.ERRORS,
        "preconditions" to ISLTokenTypes.PRECONDITIONS,
        "postconditions" to ISLTokenTypes.POSTCONDITIONS,
        "invariants" to ISLTokenTypes.INVARIANTS,
        "temporal" to ISLTokenTypes.TEMPORAL,
        "security" to ISLTokenTypes.SECURITY,
        "compliance" to ISLTokenTypes.COMPLIANCE,
        "actors" to ISLTokenTypes.ACTORS,
        "scenarios" to ISLTokenTypes.SCENARIOS,
        "chaos" to ISLTokenTypes.CHAOS,
        "lifecycle" to ISLTokenTypes.LIFECYCLE,
        "description" to ISLTokenTypes.DESCRIPTION,
        "implies" to ISLTokenTypes.IMPLIES,
        "when" to ISLTokenTypes.WHEN,
        "and" to ISLTokenTypes.AND,
        "or" to ISLTokenTypes.OR,
        "not" to ISLTokenTypes.NOT,
        "in" to ISLTokenTypes.IN,
        "for" to ISLTokenTypes.FOR,
        "must" to ISLTokenTypes.MUST,
        "owns" to ISLTokenTypes.OWNS,
        "eventually" to ISLTokenTypes.EVENTUALLY,
        "within" to ISLTokenTypes.WITHIN,
        "immediately" to ISLTokenTypes.IMMEDIATELY,
        "never" to ISLTokenTypes.NEVER,
        "always" to ISLTokenTypes.ALWAYS,
        "all" to ISLTokenTypes.ALL,
        "any" to ISLTokenTypes.ANY,
        "count" to ISLTokenTypes.COUNT,
        "sum" to ISLTokenTypes.SUM,
        "old" to ISLTokenTypes.OLD,
        "retriable" to ISLTokenTypes.RETRIABLE,
        "retry_after" to ISLTokenTypes.RETRY_AFTER,
        "rate_limit" to ISLTokenTypes.RATE_LIMIT,
        "per" to ISLTokenTypes.PER,
        "enabled" to ISLTokenTypes.ENABLED,
        "scope" to ISLTokenTypes.SCOPE,
        "global" to ISLTokenTypes.GLOBAL,
        "true" to ISLTokenTypes.TRUE,
        "false" to ISLTokenTypes.FALSE,
        "null" to ISLTokenTypes.NULL
    )
    
    override fun start(buffer: CharSequence, startOffset: Int, endOffset: Int, initialState: Int) {
        this.buffer = buffer
        this.bufferEnd = endOffset
        this.tokenStart = startOffset
        this.tokenEnd = startOffset
        this.tokenType = null
        advance()
    }
    
    override fun getState(): Int = 0
    
    override fun getTokenType(): IElementType? = tokenType
    
    override fun getTokenStart(): Int = tokenStart
    
    override fun getTokenEnd(): Int = tokenEnd
    
    override fun advance() {
        tokenStart = tokenEnd
        
        if (tokenStart >= bufferEnd) {
            tokenType = null
            return
        }
        
        val c = buffer[tokenStart]
        
        when {
            // Whitespace
            c.isWhitespace() -> {
                tokenEnd = skipWhitespace(tokenStart)
                tokenType = if (c == '\n' || c == '\r') ISLTokenTypes.NEWLINE else ISLTokenTypes.WHITE_SPACE
            }
            
            // Comment
            c == '#' -> {
                tokenEnd = skipToEndOfLine(tokenStart)
                tokenType = ISLTokenTypes.COMMENT
            }
            
            // String
            c == '"' -> {
                tokenEnd = scanString(tokenStart)
                tokenType = ISLTokenTypes.STRING
            }
            
            // Number or Duration
            c.isDigit() -> {
                val (end, type) = scanNumberOrDuration(tokenStart)
                tokenEnd = end
                tokenType = type
            }
            
            // Identifier or Keyword
            c.isLetter() || c == '_' -> {
                tokenEnd = scanIdentifier(tokenStart)
                val text = buffer.substring(tokenStart, tokenEnd)
                tokenType = keywords[text.lowercase()] ?: ISLTokenTypes.IDENTIFIER
            }
            
            // Operators and Punctuation
            else -> {
                tokenEnd = tokenStart + 1
                tokenType = when (c) {
                    '{' -> ISLTokenTypes.LBRACE
                    '}' -> ISLTokenTypes.RBRACE
                    '(' -> ISLTokenTypes.LPAREN
                    ')' -> ISLTokenTypes.RPAREN
                    '[' -> ISLTokenTypes.LBRACKET
                    ']' -> ISLTokenTypes.RBRACKET
                    ':' -> ISLTokenTypes.COLON
                    ',' -> ISLTokenTypes.COMMA
                    '.' -> ISLTokenTypes.DOT
                    '?' -> ISLTokenTypes.QUESTION
                    '|' -> ISLTokenTypes.PIPE
                    '@' -> ISLTokenTypes.AT
                    '=' -> {
                        if (tokenStart + 1 < bufferEnd && buffer[tokenStart + 1] == '=') {
                            tokenEnd = tokenStart + 2
                            ISLTokenTypes.EQ
                        } else if (tokenStart + 1 < bufferEnd && buffer[tokenStart + 1] == '>') {
                            tokenEnd = tokenStart + 2
                            ISLTokenTypes.FAT_ARROW
                        } else {
                            ISLTokenTypes.ASSIGN
                        }
                    }
                    '!' -> {
                        if (tokenStart + 1 < bufferEnd && buffer[tokenStart + 1] == '=') {
                            tokenEnd = tokenStart + 2
                            ISLTokenTypes.NEQ
                        } else {
                            ISLTokenTypes.BAD_CHARACTER
                        }
                    }
                    '>' -> {
                        if (tokenStart + 1 < bufferEnd && buffer[tokenStart + 1] == '=') {
                            tokenEnd = tokenStart + 2
                            ISLTokenTypes.GTE
                        } else {
                            ISLTokenTypes.GT
                        }
                    }
                    '<' -> {
                        if (tokenStart + 1 < bufferEnd && buffer[tokenStart + 1] == '=') {
                            tokenEnd = tokenStart + 2
                            ISLTokenTypes.LTE
                        } else {
                            ISLTokenTypes.LT
                        }
                    }
                    '-' -> {
                        if (tokenStart + 1 < bufferEnd && buffer[tokenStart + 1] == '>') {
                            tokenEnd = tokenStart + 2
                            ISLTokenTypes.ARROW
                        } else {
                            ISLTokenTypes.DASH
                        }
                    }
                    else -> ISLTokenTypes.BAD_CHARACTER
                }
            }
        }
    }
    
    override fun getBufferSequence(): CharSequence = buffer
    
    override fun getBufferEnd(): Int = bufferEnd
    
    private fun skipWhitespace(start: Int): Int {
        var pos = start
        while (pos < bufferEnd && buffer[pos].isWhitespace() && buffer[pos] != '\n' && buffer[pos] != '\r') {
            pos++
        }
        // Include single newline in whitespace if at start
        if (pos == start && (buffer[pos] == '\n' || buffer[pos] == '\r')) {
            pos++
            if (pos < bufferEnd && buffer[pos - 1] == '\r' && buffer[pos] == '\n') {
                pos++
            }
        }
        return if (pos == start) start + 1 else pos
    }
    
    private fun skipToEndOfLine(start: Int): Int {
        var pos = start
        while (pos < bufferEnd && buffer[pos] != '\n' && buffer[pos] != '\r') {
            pos++
        }
        return pos
    }
    
    private fun scanString(start: Int): Int {
        var pos = start + 1 // Skip opening quote
        while (pos < bufferEnd) {
            val c = buffer[pos]
            if (c == '"') {
                return pos + 1 // Include closing quote
            }
            if (c == '\\' && pos + 1 < bufferEnd) {
                pos += 2 // Skip escape sequence
                continue
            }
            if (c == '\n' || c == '\r') {
                return pos // Unterminated string
            }
            pos++
        }
        return pos // Unterminated string at end of file
    }
    
    private fun scanIdentifier(start: Int): Int {
        var pos = start
        while (pos < bufferEnd) {
            val c = buffer[pos]
            if (!c.isLetterOrDigit() && c != '_') {
                break
            }
            pos++
        }
        return pos
    }
    
    private fun scanNumberOrDuration(start: Int): Pair<Int, IElementType> {
        var pos = start
        var hasDot = false
        
        // Scan digits
        while (pos < bufferEnd && (buffer[pos].isDigit() || buffer[pos] == '.')) {
            if (buffer[pos] == '.') {
                if (hasDot) break
                hasDot = true
            }
            pos++
        }
        
        // Check for duration suffix (ms, s, m, h, d)
        if (pos < bufferEnd) {
            val remaining = bufferEnd - pos
            when {
                remaining >= 2 && buffer.substring(pos, pos + 2) == "ms" -> {
                    return Pair(pos + 2, ISLTokenTypes.DURATION)
                }
                remaining >= 1 && buffer[pos] in listOf('s', 'm', 'h', 'd') -> {
                    // Make sure it's not part of an identifier
                    if (pos + 1 >= bufferEnd || !buffer[pos + 1].isLetterOrDigit()) {
                        return Pair(pos + 1, ISLTokenTypes.DURATION)
                    }
                }
            }
        }
        
        // Check for percentile (p50, p99, etc.)
        if (pos < bufferEnd && buffer[pos] == 'p' && pos + 1 < bufferEnd && buffer[pos + 1].isDigit()) {
            pos++ // Skip 'p'
            while (pos < bufferEnd && buffer[pos].isDigit()) {
                pos++
            }
            return Pair(pos, ISLTokenTypes.PERCENTILE)
        }
        
        return Pair(pos, ISLTokenTypes.NUMBER)
    }
}
