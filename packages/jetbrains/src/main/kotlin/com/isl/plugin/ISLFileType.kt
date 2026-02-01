package com.isl.plugin

import com.intellij.openapi.fileTypes.LanguageFileType
import javax.swing.Icon

/**
 * ISL File Type Definition
 */
object ISLFileType : LanguageFileType(ISLLanguage) {
    
    override fun getName(): String = "ISL File"
    
    override fun getDescription(): String = "Intent Specification Language file"
    
    override fun getDefaultExtension(): String = "isl"
    
    override fun getIcon(): Icon = ISLIcons.FILE
    
    // Singleton instance for plugin.xml
    @JvmField
    val INSTANCE = this
}
