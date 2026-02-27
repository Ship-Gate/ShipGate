package com.isl.plugin

import com.intellij.lang.Language

/**
 * ISL Language Definition
 */
object ISLLanguage : Language("ISL") {
    
    override fun getDisplayName(): String = "Intent Specification Language"
    
    override fun isCaseSensitive(): Boolean = true
    
    // Mime type for ISL files
    const val MIME_TYPE = "text/x-isl"
}
