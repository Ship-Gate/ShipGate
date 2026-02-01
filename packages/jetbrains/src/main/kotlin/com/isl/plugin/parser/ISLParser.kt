package com.isl.plugin.parser

import com.intellij.lang.ASTNode
import com.intellij.lang.PsiBuilder
import com.intellij.lang.PsiParser
import com.intellij.psi.tree.IElementType
import com.isl.plugin.lexer.ISLTokenTypes

/**
 * ISL Parser
 * 
 * Parses ISL source into PSI tree.
 */
class ISLParser : PsiParser {
    
    override fun parse(root: IElementType, builder: PsiBuilder): ASTNode {
        val rootMarker = builder.mark()
        
        while (!builder.eof()) {
            parseTopLevel(builder)
        }
        
        rootMarker.done(root)
        return builder.treeBuilt
    }
    
    private fun parseTopLevel(builder: PsiBuilder) {
        skipWhitespaceAndComments(builder)
        
        if (builder.eof()) return
        
        when (builder.tokenType) {
            ISLTokenTypes.DOMAIN -> parseDomain(builder)
            ISLTokenTypes.COMMENT -> {
                builder.advanceLexer()
            }
            else -> {
                // Error recovery: skip unknown token
                builder.error("Expected 'domain' declaration")
                builder.advanceLexer()
            }
        }
    }
    
    private fun parseDomain(builder: PsiBuilder) {
        val marker = builder.mark()
        
        // domain keyword
        expect(builder, ISLTokenTypes.DOMAIN, "'domain'")
        
        // domain name
        expect(builder, ISLTokenTypes.IDENTIFIER, "domain name")
        
        // opening brace
        expect(builder, ISLTokenTypes.LBRACE, "'{'")
        
        // domain body
        while (!builder.eof() && builder.tokenType != ISLTokenTypes.RBRACE) {
            skipWhitespaceAndComments(builder)
            
            if (builder.tokenType == ISLTokenTypes.RBRACE) break
            
            parseDomainMember(builder)
        }
        
        // closing brace
        expect(builder, ISLTokenTypes.RBRACE, "'}'")
        
        marker.done(ISLElementTypes.DOMAIN_DECLARATION)
    }
    
    private fun parseDomainMember(builder: PsiBuilder) {
        skipWhitespaceAndComments(builder)
        
        when (builder.tokenType) {
            ISLTokenTypes.VERSION -> parseVersion(builder)
            ISLTokenTypes.IMPORTS -> parseImports(builder)
            ISLTokenTypes.ENTITY -> parseEntity(builder)
            ISLTokenTypes.BEHAVIOR -> parseBehavior(builder)
            ISLTokenTypes.TYPE -> parseType(builder)
            ISLTokenTypes.ENUM -> parseEnum(builder)
            ISLTokenTypes.INVARIANTS -> parseInvariants(builder)
            ISLTokenTypes.COMMENT -> builder.advanceLexer()
            else -> {
                if (builder.tokenType != ISLTokenTypes.RBRACE) {
                    builder.error("Unexpected token: ${builder.tokenText}")
                    builder.advanceLexer()
                }
            }
        }
    }
    
    private fun parseVersion(builder: PsiBuilder) {
        builder.advanceLexer() // version
        expect(builder, ISLTokenTypes.COLON, "':'")
        expect(builder, ISLTokenTypes.STRING, "version string")
    }
    
    private fun parseImports(builder: PsiBuilder) {
        val marker = builder.mark()
        builder.advanceLexer() // imports
        expect(builder, ISLTokenTypes.LBRACE, "'{'")
        
        while (!builder.eof() && builder.tokenType != ISLTokenTypes.RBRACE) {
            skipWhitespaceAndComments(builder)
            if (builder.tokenType == ISLTokenTypes.RBRACE) break
            
            // Parse import statement
            if (builder.tokenType == ISLTokenTypes.IDENTIFIER) {
                builder.advanceLexer()
            }
        }
        
        expect(builder, ISLTokenTypes.RBRACE, "'}'")
        marker.done(ISLElementTypes.IMPORT_DECLARATION)
    }
    
    private fun parseEntity(builder: PsiBuilder) {
        val marker = builder.mark()
        
        builder.advanceLexer() // entity
        expect(builder, ISLTokenTypes.IDENTIFIER, "entity name")
        expect(builder, ISLTokenTypes.LBRACE, "'{'")
        
        while (!builder.eof() && builder.tokenType != ISLTokenTypes.RBRACE) {
            skipWhitespaceAndComments(builder)
            if (builder.tokenType == ISLTokenTypes.RBRACE) break
            
            when (builder.tokenType) {
                ISLTokenTypes.INVARIANTS -> parseInvariantsBlock(builder)
                ISLTokenTypes.LIFECYCLE -> parseLifecycle(builder)
                ISLTokenTypes.IDENTIFIER -> parseField(builder)
                ISLTokenTypes.COMMENT -> builder.advanceLexer()
                else -> {
                    if (builder.tokenType != ISLTokenTypes.RBRACE) {
                        builder.advanceLexer()
                    }
                }
            }
        }
        
        expect(builder, ISLTokenTypes.RBRACE, "'}'")
        marker.done(ISLElementTypes.ENTITY_DECLARATION)
    }
    
    private fun parseField(builder: PsiBuilder) {
        val marker = builder.mark()
        
        // field name
        builder.advanceLexer()
        
        expect(builder, ISLTokenTypes.COLON, "':'")
        
        // type
        parseTypeExpression(builder)
        
        // optional ?
        if (builder.tokenType == ISLTokenTypes.QUESTION) {
            builder.advanceLexer()
        }
        
        // annotations [...]
        if (builder.tokenType == ISLTokenTypes.LBRACKET) {
            parseAnnotations(builder)
        }
        
        marker.done(ISLElementTypes.FIELD_DECLARATION)
    }
    
    private fun parseTypeExpression(builder: PsiBuilder) {
        val marker = builder.mark()
        
        if (builder.tokenType == ISLTokenTypes.IDENTIFIER) {
            builder.advanceLexer()
            
            // Generic type parameters
            if (builder.tokenType == ISLTokenTypes.LT) {
                builder.advanceLexer()
                parseTypeExpression(builder)
                while (builder.tokenType == ISLTokenTypes.COMMA) {
                    builder.advanceLexer()
                    parseTypeExpression(builder)
                }
                expect(builder, ISLTokenTypes.GT, "'>'")
            }
            
            // Type constraints { ... }
            if (builder.tokenType == ISLTokenTypes.LBRACE) {
                parseTypeConstraints(builder)
            }
        }
        
        marker.done(ISLElementTypes.TYPE_EXPRESSION)
    }
    
    private fun parseTypeConstraints(builder: PsiBuilder) {
        builder.advanceLexer() // {
        
        while (!builder.eof() && builder.tokenType != ISLTokenTypes.RBRACE) {
            skipWhitespaceAndComments(builder)
            if (builder.tokenType == ISLTokenTypes.RBRACE) break
            
            val constraintMarker = builder.mark()
            if (builder.tokenType == ISLTokenTypes.IDENTIFIER) {
                builder.advanceLexer()
                expect(builder, ISLTokenTypes.COLON, "':'")
                // constraint value
                if (builder.tokenType != ISLTokenTypes.RBRACE && builder.tokenType != ISLTokenTypes.COMMA) {
                    builder.advanceLexer()
                }
            }
            constraintMarker.done(ISLElementTypes.TYPE_CONSTRAINT)
            
            if (builder.tokenType == ISLTokenTypes.COMMA) {
                builder.advanceLexer()
            }
        }
        
        expect(builder, ISLTokenTypes.RBRACE, "'}'")
    }
    
    private fun parseAnnotations(builder: PsiBuilder) {
        val marker = builder.mark()
        builder.advanceLexer() // [
        
        while (!builder.eof() && builder.tokenType != ISLTokenTypes.RBRACKET) {
            skipWhitespaceAndComments(builder)
            if (builder.tokenType == ISLTokenTypes.RBRACKET) break
            
            val annotationMarker = builder.mark()
            if (builder.tokenType == ISLTokenTypes.IDENTIFIER) {
                builder.advanceLexer()
                
                // annotation value
                if (builder.tokenType == ISLTokenTypes.COLON) {
                    builder.advanceLexer()
                    if (builder.tokenType != ISLTokenTypes.RBRACKET && builder.tokenType != ISLTokenTypes.COMMA) {
                        builder.advanceLexer()
                    }
                }
            }
            annotationMarker.done(ISLElementTypes.ANNOTATION)
            
            if (builder.tokenType == ISLTokenTypes.COMMA) {
                builder.advanceLexer()
            }
        }
        
        expect(builder, ISLTokenTypes.RBRACKET, "']'")
        marker.done(ISLElementTypes.ANNOTATION_LIST)
    }
    
    private fun parseBehavior(builder: PsiBuilder) {
        val marker = builder.mark()
        
        builder.advanceLexer() // behavior
        expect(builder, ISLTokenTypes.IDENTIFIER, "behavior name")
        expect(builder, ISLTokenTypes.LBRACE, "'{'")
        
        while (!builder.eof() && builder.tokenType != ISLTokenTypes.RBRACE) {
            skipWhitespaceAndComments(builder)
            if (builder.tokenType == ISLTokenTypes.RBRACE) break
            
            when (builder.tokenType) {
                ISLTokenTypes.DESCRIPTION -> parseDescription(builder)
                ISLTokenTypes.ACTORS -> parseActors(builder)
                ISLTokenTypes.INPUT -> parseInput(builder)
                ISLTokenTypes.OUTPUT -> parseOutput(builder)
                ISLTokenTypes.PRECONDITIONS -> parsePreconditions(builder)
                ISLTokenTypes.POSTCONDITIONS -> parsePostconditions(builder)
                ISLTokenTypes.INVARIANTS -> parseInvariantsBlock(builder)
                ISLTokenTypes.TEMPORAL -> parseTemporal(builder)
                ISLTokenTypes.SECURITY -> parseSecurity(builder)
                ISLTokenTypes.COMPLIANCE -> parseCompliance(builder)
                ISLTokenTypes.SCENARIOS -> parseScenarios(builder)
                ISLTokenTypes.COMMENT -> builder.advanceLexer()
                else -> {
                    if (builder.tokenType != ISLTokenTypes.RBRACE) {
                        builder.advanceLexer()
                    }
                }
            }
        }
        
        expect(builder, ISLTokenTypes.RBRACE, "'}'")
        marker.done(ISLElementTypes.BEHAVIOR_DECLARATION)
    }
    
    private fun parseDescription(builder: PsiBuilder) {
        builder.advanceLexer() // description
        expect(builder, ISLTokenTypes.COLON, "':'")
        expect(builder, ISLTokenTypes.STRING, "description string")
    }
    
    private fun parseActors(builder: PsiBuilder) {
        val marker = builder.mark()
        builder.advanceLexer() // actors
        expect(builder, ISLTokenTypes.LBRACE, "'{'")
        
        while (!builder.eof() && builder.tokenType != ISLTokenTypes.RBRACE) {
            skipWhitespaceAndComments(builder)
            if (builder.tokenType == ISLTokenTypes.RBRACE) break
            
            if (builder.tokenType == ISLTokenTypes.IDENTIFIER) {
                parseActor(builder)
            } else {
                builder.advanceLexer()
            }
        }
        
        expect(builder, ISLTokenTypes.RBRACE, "'}'")
        marker.done(ISLElementTypes.ACTORS_BLOCK)
    }
    
    private fun parseActor(builder: PsiBuilder) {
        val marker = builder.mark()
        builder.advanceLexer() // actor name
        expect(builder, ISLTokenTypes.LBRACE, "'{'")
        
        while (!builder.eof() && builder.tokenType != ISLTokenTypes.RBRACE) {
            skipWhitespaceAndComments(builder)
            if (builder.tokenType == ISLTokenTypes.RBRACE) break
            
            // Parse actor constraints (must, owns, for, etc.)
            if (builder.tokenType in listOf(ISLTokenTypes.MUST, ISLTokenTypes.OWNS, ISLTokenTypes.FOR)) {
                val constraintMarker = builder.mark()
                builder.advanceLexer()
                expect(builder, ISLTokenTypes.COLON, "':'")
                if (builder.tokenType != ISLTokenTypes.RBRACE) {
                    builder.advanceLexer()
                }
                constraintMarker.done(ISLElementTypes.ACTOR_CONSTRAINT)
            } else {
                builder.advanceLexer()
            }
        }
        
        expect(builder, ISLTokenTypes.RBRACE, "'}'")
        marker.done(ISLElementTypes.ACTOR_DECLARATION)
    }
    
    private fun parseInput(builder: PsiBuilder) {
        val marker = builder.mark()
        builder.advanceLexer() // input
        expect(builder, ISLTokenTypes.LBRACE, "'{'")
        
        while (!builder.eof() && builder.tokenType != ISLTokenTypes.RBRACE) {
            skipWhitespaceAndComments(builder)
            if (builder.tokenType == ISLTokenTypes.RBRACE) break
            
            if (builder.tokenType == ISLTokenTypes.IDENTIFIER) {
                parseField(builder)
            } else {
                builder.advanceLexer()
            }
        }
        
        expect(builder, ISLTokenTypes.RBRACE, "'}'")
        marker.done(ISLElementTypes.INPUT_BLOCK)
    }
    
    private fun parseOutput(builder: PsiBuilder) {
        val marker = builder.mark()
        builder.advanceLexer() // output
        expect(builder, ISLTokenTypes.LBRACE, "'{'")
        
        while (!builder.eof() && builder.tokenType != ISLTokenTypes.RBRACE) {
            skipWhitespaceAndComments(builder)
            if (builder.tokenType == ISLTokenTypes.RBRACE) break
            
            when (builder.tokenType) {
                ISLTokenTypes.SUCCESS -> {
                    builder.advanceLexer()
                    expect(builder, ISLTokenTypes.COLON, "':'")
                    parseTypeExpression(builder)
                }
                ISLTokenTypes.ERRORS -> parseErrors(builder)
                else -> builder.advanceLexer()
            }
        }
        
        expect(builder, ISLTokenTypes.RBRACE, "'}'")
        marker.done(ISLElementTypes.OUTPUT_BLOCK)
    }
    
    private fun parseErrors(builder: PsiBuilder) {
        builder.advanceLexer() // errors
        expect(builder, ISLTokenTypes.LBRACE, "'{'")
        
        while (!builder.eof() && builder.tokenType != ISLTokenTypes.RBRACE) {
            skipWhitespaceAndComments(builder)
            if (builder.tokenType == ISLTokenTypes.RBRACE) break
            
            if (builder.tokenType == ISLTokenTypes.IDENTIFIER) {
                parseErrorDeclaration(builder)
            } else {
                builder.advanceLexer()
            }
        }
        
        expect(builder, ISLTokenTypes.RBRACE, "'}'")
    }
    
    private fun parseErrorDeclaration(builder: PsiBuilder) {
        val marker = builder.mark()
        builder.advanceLexer() // error name
        expect(builder, ISLTokenTypes.LBRACE, "'{'")
        
        while (!builder.eof() && builder.tokenType != ISLTokenTypes.RBRACE) {
            skipWhitespaceAndComments(builder)
            if (builder.tokenType == ISLTokenTypes.RBRACE) break
            
            // Parse error properties (when, retriable, retry_after)
            when (builder.tokenType) {
                ISLTokenTypes.WHEN, ISLTokenTypes.RETRIABLE, ISLTokenTypes.RETRY_AFTER -> {
                    builder.advanceLexer()
                    expect(builder, ISLTokenTypes.COLON, "':'")
                    if (builder.tokenType != ISLTokenTypes.RBRACE) {
                        builder.advanceLexer()
                    }
                }
                else -> builder.advanceLexer()
            }
        }
        
        expect(builder, ISLTokenTypes.RBRACE, "'}'")
        marker.done(ISLElementTypes.ERROR_DECLARATION)
    }
    
    private fun parsePreconditions(builder: PsiBuilder) {
        val marker = builder.mark()
        builder.advanceLexer() // preconditions
        expect(builder, ISLTokenTypes.LBRACE, "'{'")
        
        parseConditionBlock(builder)
        
        expect(builder, ISLTokenTypes.RBRACE, "'}'")
        marker.done(ISLElementTypes.PRECONDITIONS_BLOCK)
    }
    
    private fun parsePostconditions(builder: PsiBuilder) {
        val marker = builder.mark()
        builder.advanceLexer() // postconditions
        expect(builder, ISLTokenTypes.LBRACE, "'{'")
        
        parseConditionBlock(builder)
        
        expect(builder, ISLTokenTypes.RBRACE, "'}'")
        marker.done(ISLElementTypes.POSTCONDITIONS_BLOCK)
    }
    
    private fun parseConditionBlock(builder: PsiBuilder) {
        while (!builder.eof() && builder.tokenType != ISLTokenTypes.RBRACE) {
            skipWhitespaceAndComments(builder)
            if (builder.tokenType == ISLTokenTypes.RBRACE) break
            
            when (builder.tokenType) {
                ISLTokenTypes.SUCCESS, ISLTokenTypes.IDENTIFIER -> {
                    parseCondition(builder)
                }
                ISLTokenTypes.DASH -> {
                    parseConditionStatement(builder)
                }
                else -> builder.advanceLexer()
            }
        }
    }
    
    private fun parseCondition(builder: PsiBuilder) {
        val marker = builder.mark()
        
        // success or identifier
        builder.advanceLexer()
        
        // implies
        if (builder.tokenType == ISLTokenTypes.IMPLIES) {
            builder.advanceLexer()
            expect(builder, ISLTokenTypes.LBRACE, "'{'")
            
            while (!builder.eof() && builder.tokenType != ISLTokenTypes.RBRACE) {
                skipWhitespaceAndComments(builder)
                if (builder.tokenType == ISLTokenTypes.RBRACE) break
                
                if (builder.tokenType == ISLTokenTypes.DASH) {
                    parseConditionStatement(builder)
                } else {
                    builder.advanceLexer()
                }
            }
            
            expect(builder, ISLTokenTypes.RBRACE, "'}'")
        }
        
        marker.done(ISLElementTypes.CONDITION)
    }
    
    private fun parseConditionStatement(builder: PsiBuilder) {
        val marker = builder.mark()
        
        // Skip dash
        if (builder.tokenType == ISLTokenTypes.DASH) {
            builder.advanceLexer()
        }
        
        // Parse expression until newline or }
        while (!builder.eof() && 
               builder.tokenType != ISLTokenTypes.NEWLINE &&
               builder.tokenType != ISLTokenTypes.RBRACE &&
               builder.tokenType != ISLTokenTypes.DASH) {
            builder.advanceLexer()
        }
        
        marker.done(ISLElementTypes.CONDITION_STATEMENT)
    }
    
    private fun parseInvariantsBlock(builder: PsiBuilder) {
        val marker = builder.mark()
        builder.advanceLexer() // invariants
        expect(builder, ISLTokenTypes.LBRACE, "'{'")
        
        while (!builder.eof() && builder.tokenType != ISLTokenTypes.RBRACE) {
            skipWhitespaceAndComments(builder)
            if (builder.tokenType == ISLTokenTypes.RBRACE) break
            
            if (builder.tokenType == ISLTokenTypes.DASH) {
                val stmtMarker = builder.mark()
                builder.advanceLexer()
                while (!builder.eof() && 
                       builder.tokenType != ISLTokenTypes.NEWLINE &&
                       builder.tokenType != ISLTokenTypes.RBRACE &&
                       builder.tokenType != ISLTokenTypes.DASH) {
                    builder.advanceLexer()
                }
                stmtMarker.done(ISLElementTypes.INVARIANT_STATEMENT)
            } else {
                builder.advanceLexer()
            }
        }
        
        expect(builder, ISLTokenTypes.RBRACE, "'}'")
        marker.done(ISLElementTypes.INVARIANTS_BLOCK)
    }
    
    private fun parseTemporal(builder: PsiBuilder) {
        val marker = builder.mark()
        builder.advanceLexer() // temporal
        expect(builder, ISLTokenTypes.LBRACE, "'{'")
        
        while (!builder.eof() && builder.tokenType != ISLTokenTypes.RBRACE) {
            skipWhitespaceAndComments(builder)
            if (builder.tokenType == ISLTokenTypes.RBRACE) break
            
            if (builder.tokenType == ISLTokenTypes.DASH) {
                val reqMarker = builder.mark()
                builder.advanceLexer()
                
                // Parse temporal keywords
                while (!builder.eof() && 
                       builder.tokenType != ISLTokenTypes.NEWLINE &&
                       builder.tokenType != ISLTokenTypes.RBRACE &&
                       builder.tokenType != ISLTokenTypes.DASH) {
                    builder.advanceLexer()
                }
                
                reqMarker.done(ISLElementTypes.TEMPORAL_REQUIREMENT)
            } else {
                builder.advanceLexer()
            }
        }
        
        expect(builder, ISLTokenTypes.RBRACE, "'}'")
        marker.done(ISLElementTypes.TEMPORAL_BLOCK)
    }
    
    private fun parseSecurity(builder: PsiBuilder) {
        val marker = builder.mark()
        builder.advanceLexer() // security
        expect(builder, ISLTokenTypes.LBRACE, "'{'")
        
        while (!builder.eof() && builder.tokenType != ISLTokenTypes.RBRACE) {
            skipWhitespaceAndComments(builder)
            if (builder.tokenType == ISLTokenTypes.RBRACE) break
            
            if (builder.tokenType == ISLTokenTypes.DASH) {
                val reqMarker = builder.mark()
                builder.advanceLexer()
                
                while (!builder.eof() && 
                       builder.tokenType != ISLTokenTypes.NEWLINE &&
                       builder.tokenType != ISLTokenTypes.RBRACE &&
                       builder.tokenType != ISLTokenTypes.DASH) {
                    builder.advanceLexer()
                }
                
                reqMarker.done(ISLElementTypes.SECURITY_REQUIREMENT)
            } else {
                builder.advanceLexer()
            }
        }
        
        expect(builder, ISLTokenTypes.RBRACE, "'}'")
        marker.done(ISLElementTypes.SECURITY_BLOCK)
    }
    
    private fun parseCompliance(builder: PsiBuilder) {
        val marker = builder.mark()
        builder.advanceLexer() // compliance
        expect(builder, ISLTokenTypes.LBRACE, "'{'")
        
        while (!builder.eof() && builder.tokenType != ISLTokenTypes.RBRACE) {
            skipWhitespaceAndComments(builder)
            if (builder.tokenType == ISLTokenTypes.RBRACE) break
            
            if (builder.tokenType == ISLTokenTypes.IDENTIFIER) {
                val stdMarker = builder.mark()
                builder.advanceLexer()
                expect(builder, ISLTokenTypes.LBRACE, "'{'")
                
                while (!builder.eof() && builder.tokenType != ISLTokenTypes.RBRACE) {
                    builder.advanceLexer()
                }
                
                expect(builder, ISLTokenTypes.RBRACE, "'}'")
                stdMarker.done(ISLElementTypes.COMPLIANCE_STANDARD)
            } else {
                builder.advanceLexer()
            }
        }
        
        expect(builder, ISLTokenTypes.RBRACE, "'}'")
        marker.done(ISLElementTypes.COMPLIANCE_BLOCK)
    }
    
    private fun parseScenarios(builder: PsiBuilder) {
        val marker = builder.mark()
        builder.advanceLexer() // scenarios
        expect(builder, ISLTokenTypes.LBRACE, "'{'")
        
        while (!builder.eof() && builder.tokenType != ISLTokenTypes.RBRACE) {
            skipWhitespaceAndComments(builder)
            if (builder.tokenType == ISLTokenTypes.RBRACE) break
            builder.advanceLexer()
        }
        
        expect(builder, ISLTokenTypes.RBRACE, "'}'")
        marker.done(ISLElementTypes.SCENARIOS_BLOCK)
    }
    
    private fun parseLifecycle(builder: PsiBuilder) {
        val marker = builder.mark()
        builder.advanceLexer() // lifecycle
        expect(builder, ISLTokenTypes.LBRACE, "'{'")
        
        while (!builder.eof() && builder.tokenType != ISLTokenTypes.RBRACE) {
            skipWhitespaceAndComments(builder)
            if (builder.tokenType == ISLTokenTypes.RBRACE) break
            
            // Parse transitions: STATE -> STATE
            if (builder.tokenType == ISLTokenTypes.IDENTIFIER) {
                val transMarker = builder.mark()
                while (!builder.eof() && 
                       builder.tokenType != ISLTokenTypes.NEWLINE &&
                       builder.tokenType != ISLTokenTypes.RBRACE) {
                    builder.advanceLexer()
                }
                transMarker.done(ISLElementTypes.LIFECYCLE_TRANSITION)
            } else {
                builder.advanceLexer()
            }
        }
        
        expect(builder, ISLTokenTypes.RBRACE, "'}'")
        marker.done(ISLElementTypes.LIFECYCLE_BLOCK)
    }
    
    private fun parseType(builder: PsiBuilder) {
        val marker = builder.mark()
        
        builder.advanceLexer() // type
        expect(builder, ISLTokenTypes.IDENTIFIER, "type name")
        expect(builder, ISLTokenTypes.ASSIGN, "'='")
        parseTypeExpression(builder)
        
        marker.done(ISLElementTypes.TYPE_DECLARATION)
    }
    
    private fun parseEnum(builder: PsiBuilder) {
        val marker = builder.mark()
        
        builder.advanceLexer() // enum
        expect(builder, ISLTokenTypes.IDENTIFIER, "enum name")
        expect(builder, ISLTokenTypes.LBRACE, "'{'")
        
        while (!builder.eof() && builder.tokenType != ISLTokenTypes.RBRACE) {
            skipWhitespaceAndComments(builder)
            if (builder.tokenType == ISLTokenTypes.RBRACE) break
            
            if (builder.tokenType == ISLTokenTypes.IDENTIFIER) {
                builder.advanceLexer()
            } else {
                builder.advanceLexer()
            }
        }
        
        expect(builder, ISLTokenTypes.RBRACE, "'}'")
        marker.done(ISLElementTypes.ENUM_DECLARATION)
    }
    
    private fun parseInvariants(builder: PsiBuilder) {
        val marker = builder.mark()
        builder.advanceLexer() // invariants
        
        // Optional name
        if (builder.tokenType == ISLTokenTypes.IDENTIFIER) {
            builder.advanceLexer()
        }
        
        expect(builder, ISLTokenTypes.LBRACE, "'{'")
        
        while (!builder.eof() && builder.tokenType != ISLTokenTypes.RBRACE) {
            skipWhitespaceAndComments(builder)
            if (builder.tokenType == ISLTokenTypes.RBRACE) break
            builder.advanceLexer()
        }
        
        expect(builder, ISLTokenTypes.RBRACE, "'}'")
        marker.done(ISLElementTypes.INVARIANTS_BLOCK)
    }
    
    private fun skipWhitespaceAndComments(builder: PsiBuilder) {
        while (builder.tokenType in listOf(
            ISLTokenTypes.WHITE_SPACE, 
            ISLTokenTypes.NEWLINE
        )) {
            builder.advanceLexer()
        }
    }
    
    private fun expect(builder: PsiBuilder, expected: IElementType, name: String): Boolean {
        if (builder.tokenType == expected) {
            builder.advanceLexer()
            return true
        } else {
            builder.error("Expected $name")
            return false
        }
    }
}
