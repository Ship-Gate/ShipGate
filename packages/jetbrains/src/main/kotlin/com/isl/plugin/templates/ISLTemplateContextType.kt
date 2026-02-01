package com.isl.plugin.templates

import com.intellij.codeInsight.template.TemplateActionContext
import com.intellij.codeInsight.template.TemplateContextType
import com.isl.plugin.ISLFileType

/**
 * ISL Template Context Type
 */
class ISLTemplateContextType : TemplateContextType("ISL", "ISL") {
    
    override fun isInContext(context: TemplateActionContext): Boolean {
        return context.file.fileType == ISLFileType
    }
}
