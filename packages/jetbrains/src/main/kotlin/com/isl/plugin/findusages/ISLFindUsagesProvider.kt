package com.isl.plugin.findusages

import com.intellij.lang.cacheBuilder.DefaultWordsScanner
import com.intellij.lang.cacheBuilder.WordsScanner
import com.intellij.lang.findUsages.FindUsagesProvider
import com.intellij.psi.PsiElement
import com.intellij.psi.PsiNamedElement
import com.isl.plugin.lexer.ISLLexerAdapter
import com.isl.plugin.lexer.ISLTokenTypes
import com.isl.plugin.psi.*

/**
 * ISL Find Usages Provider
 */
class ISLFindUsagesProvider : FindUsagesProvider {
    
    override fun getWordsScanner(): WordsScanner {
        return DefaultWordsScanner(
            ISLLexerAdapter(),
            ISLTokenTypes.KEYWORDS,
            ISLTokenTypes.COMMENTS,
            ISLTokenTypes.STRINGS
        )
    }
    
    override fun canFindUsagesFor(psiElement: PsiElement): Boolean {
        return psiElement is PsiNamedElement
    }
    
    override fun getHelpId(psiElement: PsiElement): String? = null
    
    override fun getType(element: PsiElement): String {
        return when (element) {
            is ISLDomainDeclaration -> "domain"
            is ISLEntityDeclaration -> "entity"
            is ISLBehaviorDeclaration -> "behavior"
            is ISLTypeDeclaration -> "type"
            is ISLEnumDeclaration -> "enum"
            is ISLFieldDeclaration -> "field"
            is ISLErrorDeclaration -> "error"
            else -> "element"
        }
    }
    
    override fun getDescriptiveName(element: PsiElement): String {
        return when (element) {
            is PsiNamedElement -> element.name ?: ""
            else -> ""
        }
    }
    
    override fun getNodeText(element: PsiElement, useFullName: Boolean): String {
        return when (element) {
            is ISLDomainDeclaration -> "domain ${element.name}"
            is ISLEntityDeclaration -> "entity ${element.name}"
            is ISLBehaviorDeclaration -> "behavior ${element.name}"
            is ISLTypeDeclaration -> "type ${element.name}"
            is ISLEnumDeclaration -> "enum ${element.name}"
            is ISLFieldDeclaration -> "${element.name}: ${element.getType()?.text ?: "?"}"
            is PsiNamedElement -> element.name ?: element.text
            else -> element.text
        }
    }
}
