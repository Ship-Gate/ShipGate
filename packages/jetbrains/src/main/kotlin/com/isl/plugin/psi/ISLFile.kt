package com.isl.plugin.psi

import com.intellij.extapi.psi.PsiFileBase
import com.intellij.openapi.fileTypes.FileType
import com.intellij.psi.FileViewProvider
import com.isl.plugin.ISLFileType
import com.isl.plugin.ISLLanguage

/**
 * ISL PSI File
 */
class ISLFile(viewProvider: FileViewProvider) : PsiFileBase(viewProvider, ISLLanguage) {
    
    override fun getFileType(): FileType = ISLFileType
    
    override fun toString(): String = "ISL File"
    
    /**
     * Get the domain name from this file
     */
    fun getDomainName(): String? {
        // Find domain declaration and extract name
        return findChildByClass(ISLDomainDeclaration::class.java)?.name
    }
    
    /**
     * Get all entities declared in this file
     */
    fun getEntities(): List<ISLEntityDeclaration> {
        val domain = findChildByClass(ISLDomainDeclaration::class.java) ?: return emptyList()
        return domain.getEntities()
    }
    
    /**
     * Get all behaviors declared in this file
     */
    fun getBehaviors(): List<ISLBehaviorDeclaration> {
        val domain = findChildByClass(ISLDomainDeclaration::class.java) ?: return emptyList()
        return domain.getBehaviors()
    }
}
