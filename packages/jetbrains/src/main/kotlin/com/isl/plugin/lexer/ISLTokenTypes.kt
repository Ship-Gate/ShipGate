package com.isl.plugin.lexer

import com.intellij.psi.tree.IElementType
import com.intellij.psi.tree.TokenSet
import com.isl.plugin.ISLLanguage

/**
 * ISL Token Types
 */
object ISLTokenTypes {
    
    // Keywords - Domain Structure
    @JvmField val DOMAIN = ISLTokenType("DOMAIN")
    @JvmField val VERSION = ISLTokenType("VERSION")
    @JvmField val IMPORTS = ISLTokenType("IMPORTS")
    @JvmField val ENTITY = ISLTokenType("ENTITY")
    @JvmField val BEHAVIOR = ISLTokenType("BEHAVIOR")
    @JvmField val TYPE = ISLTokenType("TYPE")
    @JvmField val ENUM = ISLTokenType("ENUM")
    
    // Keywords - Behavior Sections
    @JvmField val INPUT = ISLTokenType("INPUT")
    @JvmField val OUTPUT = ISLTokenType("OUTPUT")
    @JvmField val SUCCESS = ISLTokenType("SUCCESS")
    @JvmField val ERRORS = ISLTokenType("ERRORS")
    @JvmField val PRECONDITIONS = ISLTokenType("PRECONDITIONS")
    @JvmField val POSTCONDITIONS = ISLTokenType("POSTCONDITIONS")
    @JvmField val INVARIANTS = ISLTokenType("INVARIANTS")
    @JvmField val TEMPORAL = ISLTokenType("TEMPORAL")
    @JvmField val SECURITY = ISLTokenType("SECURITY")
    @JvmField val COMPLIANCE = ISLTokenType("COMPLIANCE")
    @JvmField val ACTORS = ISLTokenType("ACTORS")
    @JvmField val SCENARIOS = ISLTokenType("SCENARIOS")
    @JvmField val CHAOS = ISLTokenType("CHAOS")
    @JvmField val LIFECYCLE = ISLTokenType("LIFECYCLE")
    @JvmField val DESCRIPTION = ISLTokenType("DESCRIPTION")
    
    // Keywords - Conditions
    @JvmField val IMPLIES = ISLTokenType("IMPLIES")
    @JvmField val WHEN = ISLTokenType("WHEN")
    @JvmField val AND = ISLTokenType("AND")
    @JvmField val OR = ISLTokenType("OR")
    @JvmField val NOT = ISLTokenType("NOT")
    @JvmField val IN = ISLTokenType("IN")
    @JvmField val FOR = ISLTokenType("FOR")
    @JvmField val MUST = ISLTokenType("MUST")
    @JvmField val OWNS = ISLTokenType("OWNS")
    
    // Keywords - Temporal
    @JvmField val EVENTUALLY = ISLTokenType("EVENTUALLY")
    @JvmField val WITHIN = ISLTokenType("WITHIN")
    @JvmField val IMMEDIATELY = ISLTokenType("IMMEDIATELY")
    @JvmField val NEVER = ISLTokenType("NEVER")
    @JvmField val ALWAYS = ISLTokenType("ALWAYS")
    
    // Keywords - Quantifiers
    @JvmField val ALL = ISLTokenType("ALL")
    @JvmField val ANY = ISLTokenType("ANY")
    @JvmField val COUNT = ISLTokenType("COUNT")
    @JvmField val SUM = ISLTokenType("SUM")
    @JvmField val OLD = ISLTokenType("OLD")
    
    // Keywords - Modifiers
    @JvmField val RETRIABLE = ISLTokenType("RETRIABLE")
    @JvmField val RETRY_AFTER = ISLTokenType("RETRY_AFTER")
    @JvmField val RATE_LIMIT = ISLTokenType("RATE_LIMIT")
    @JvmField val PER = ISLTokenType("PER")
    @JvmField val ENABLED = ISLTokenType("ENABLED")
    @JvmField val SCOPE = ISLTokenType("SCOPE")
    @JvmField val GLOBAL = ISLTokenType("GLOBAL")
    
    // Literals
    @JvmField val TRUE = ISLTokenType("TRUE")
    @JvmField val FALSE = ISLTokenType("FALSE")
    @JvmField val NULL = ISLTokenType("NULL")
    
    // Identifiers and Literals
    @JvmField val IDENTIFIER = ISLTokenType("IDENTIFIER")
    @JvmField val STRING = ISLTokenType("STRING")
    @JvmField val NUMBER = ISLTokenType("NUMBER")
    @JvmField val DURATION = ISLTokenType("DURATION")
    @JvmField val PERCENTILE = ISLTokenType("PERCENTILE")
    
    // Operators
    @JvmField val EQ = ISLTokenType("EQ")           // ==
    @JvmField val NEQ = ISLTokenType("NEQ")         // !=
    @JvmField val ASSIGN = ISLTokenType("ASSIGN")   // =
    @JvmField val GT = ISLTokenType("GT")           // >
    @JvmField val LT = ISLTokenType("LT")           // <
    @JvmField val GTE = ISLTokenType("GTE")         // >=
    @JvmField val LTE = ISLTokenType("LTE")         // <=
    @JvmField val ARROW = ISLTokenType("ARROW")     // ->
    @JvmField val FAT_ARROW = ISLTokenType("FAT_ARROW") // =>
    
    // Delimiters
    @JvmField val LBRACE = ISLTokenType("LBRACE")   // {
    @JvmField val RBRACE = ISLTokenType("RBRACE")   // }
    @JvmField val LPAREN = ISLTokenType("LPAREN")   // (
    @JvmField val RPAREN = ISLTokenType("RPAREN")   // )
    @JvmField val LBRACKET = ISLTokenType("LBRACKET") // [
    @JvmField val RBRACKET = ISLTokenType("RBRACKET") // ]
    
    // Punctuation
    @JvmField val COLON = ISLTokenType("COLON")     // :
    @JvmField val COMMA = ISLTokenType("COMMA")     // ,
    @JvmField val DOT = ISLTokenType("DOT")         // .
    @JvmField val QUESTION = ISLTokenType("QUESTION") // ?
    @JvmField val DASH = ISLTokenType("DASH")       // -
    @JvmField val PIPE = ISLTokenType("PIPE")       // |
    @JvmField val AT = ISLTokenType("AT")           // @
    
    // Comments and Whitespace
    @JvmField val COMMENT = ISLTokenType("COMMENT")
    @JvmField val WHITE_SPACE = ISLTokenType("WHITE_SPACE")
    @JvmField val NEWLINE = ISLTokenType("NEWLINE")
    
    // Bad character
    @JvmField val BAD_CHARACTER = ISLTokenType("BAD_CHARACTER")
    
    // Token Sets
    @JvmField
    val KEYWORDS = TokenSet.create(
        DOMAIN, VERSION, IMPORTS, ENTITY, BEHAVIOR, TYPE, ENUM,
        INPUT, OUTPUT, SUCCESS, ERRORS, PRECONDITIONS, POSTCONDITIONS,
        INVARIANTS, TEMPORAL, SECURITY, COMPLIANCE, ACTORS, SCENARIOS,
        CHAOS, LIFECYCLE, DESCRIPTION, IMPLIES, WHEN, AND, OR, NOT, IN,
        FOR, MUST, OWNS, EVENTUALLY, WITHIN, IMMEDIATELY, NEVER, ALWAYS,
        ALL, ANY, COUNT, SUM, OLD, RETRIABLE, RETRY_AFTER, RATE_LIMIT,
        PER, ENABLED, SCOPE, GLOBAL, TRUE, FALSE, NULL
    )
    
    @JvmField
    val OPERATORS = TokenSet.create(
        EQ, NEQ, ASSIGN, GT, LT, GTE, LTE, ARROW, FAT_ARROW
    )
    
    @JvmField
    val BRACES = TokenSet.create(LBRACE, RBRACE)
    
    @JvmField
    val BRACKETS = TokenSet.create(LBRACKET, RBRACKET)
    
    @JvmField
    val PARENTHESES = TokenSet.create(LPAREN, RPAREN)
    
    @JvmField
    val COMMENTS = TokenSet.create(COMMENT)
    
    @JvmField
    val STRINGS = TokenSet.create(STRING)
    
    @JvmField
    val WHITESPACES = TokenSet.create(WHITE_SPACE, NEWLINE)
}

/**
 * Custom token type for ISL
 */
class ISLTokenType(debugName: String) : IElementType(debugName, ISLLanguage)
