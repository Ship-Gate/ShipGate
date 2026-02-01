package com.isl.plugin

import com.intellij.codeInsight.editorActions.SimpleTokenSetQuoteHandler
import com.isl.plugin.lexer.ISLTokenTypes

/**
 * ISL Quote Handler
 */
class ISLQuoteHandler : SimpleTokenSetQuoteHandler(ISLTokenTypes.STRING)
