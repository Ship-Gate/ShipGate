package com.isl.plugin.psi

import com.intellij.extapi.psi.ASTWrapperPsiElement
import com.intellij.lang.ASTNode
import com.intellij.psi.PsiElement
import com.intellij.psi.PsiNameIdentifierOwner
import com.intellij.psi.util.PsiTreeUtil
import com.isl.plugin.lexer.ISLTokenTypes
import com.isl.plugin.parser.ISLElementTypes

/**
 * Base class for ISL PSI elements
 */
abstract class ISLPsiElement(node: ASTNode) : ASTWrapperPsiElement(node)

/**
 * Domain declaration
 */
class ISLDomainDeclaration(node: ASTNode) : ISLPsiElement(node), PsiNameIdentifierOwner {
    
    override fun getName(): String? {
        return nameIdentifier?.text
    }
    
    override fun setName(name: String): PsiElement {
        // Implement rename
        return this
    }
    
    override fun getNameIdentifier(): PsiElement? {
        return findChildByType(ISLTokenTypes.IDENTIFIER)
    }
    
    fun getEntities(): List<ISLEntityDeclaration> {
        return PsiTreeUtil.getChildrenOfTypeAsList(this, ISLEntityDeclaration::class.java)
    }
    
    fun getBehaviors(): List<ISLBehaviorDeclaration> {
        return PsiTreeUtil.getChildrenOfTypeAsList(this, ISLBehaviorDeclaration::class.java)
    }
    
    fun getTypes(): List<ISLTypeDeclaration> {
        return PsiTreeUtil.getChildrenOfTypeAsList(this, ISLTypeDeclaration::class.java)
    }
    
    fun getEnums(): List<ISLEnumDeclaration> {
        return PsiTreeUtil.getChildrenOfTypeAsList(this, ISLEnumDeclaration::class.java)
    }
}

/**
 * Entity declaration
 */
class ISLEntityDeclaration(node: ASTNode) : ISLPsiElement(node), PsiNameIdentifierOwner {
    
    override fun getName(): String? {
        return nameIdentifier?.text
    }
    
    override fun setName(name: String): PsiElement {
        return this
    }
    
    override fun getNameIdentifier(): PsiElement? {
        return findChildByType(ISLTokenTypes.IDENTIFIER)
    }
    
    fun getFields(): List<ISLFieldDeclaration> {
        return PsiTreeUtil.getChildrenOfTypeAsList(this, ISLFieldDeclaration::class.java)
    }
}

/**
 * Behavior declaration
 */
class ISLBehaviorDeclaration(node: ASTNode) : ISLPsiElement(node), PsiNameIdentifierOwner {
    
    override fun getName(): String? {
        return nameIdentifier?.text
    }
    
    override fun setName(name: String): PsiElement {
        return this
    }
    
    override fun getNameIdentifier(): PsiElement? {
        return findChildByType(ISLTokenTypes.IDENTIFIER)
    }
    
    fun getInputBlock(): ISLInputBlock? {
        return findChildByClass(ISLInputBlock::class.java)
    }
    
    fun getOutputBlock(): ISLOutputBlock? {
        return findChildByClass(ISLOutputBlock::class.java)
    }
}

/**
 * Type declaration
 */
class ISLTypeDeclaration(node: ASTNode) : ISLPsiElement(node), PsiNameIdentifierOwner {
    
    override fun getName(): String? {
        return nameIdentifier?.text
    }
    
    override fun setName(name: String): PsiElement {
        return this
    }
    
    override fun getNameIdentifier(): PsiElement? {
        return findChildByType(ISLTokenTypes.IDENTIFIER)
    }
}

/**
 * Enum declaration
 */
class ISLEnumDeclaration(node: ASTNode) : ISLPsiElement(node), PsiNameIdentifierOwner {
    
    override fun getName(): String? {
        return nameIdentifier?.text
    }
    
    override fun setName(name: String): PsiElement {
        return this
    }
    
    override fun getNameIdentifier(): PsiElement? {
        return findChildByType(ISLTokenTypes.IDENTIFIER)
    }
    
    fun getVariants(): List<String> {
        return children
            .filter { it.node.elementType == ISLTokenTypes.IDENTIFIER }
            .drop(1) // Skip enum name
            .map { it.text }
    }
}

/**
 * Field declaration
 */
class ISLFieldDeclaration(node: ASTNode) : ISLPsiElement(node), PsiNameIdentifierOwner {
    
    override fun getName(): String? {
        return nameIdentifier?.text
    }
    
    override fun setName(name: String): PsiElement {
        return this
    }
    
    override fun getNameIdentifier(): PsiElement? {
        return findChildByType(ISLTokenTypes.IDENTIFIER)
    }
    
    fun getType(): ISLTypeExpression? {
        return findChildByClass(ISLTypeExpression::class.java)
    }
    
    fun getAnnotations(): ISLAnnotationList? {
        return findChildByClass(ISLAnnotationList::class.java)
    }
    
    fun isOptional(): Boolean {
        return findChildByType<PsiElement>(ISLTokenTypes.QUESTION) != null
    }
}

/**
 * Type expression
 */
class ISLTypeExpression(node: ASTNode) : ISLPsiElement(node)

/**
 * Annotation list
 */
class ISLAnnotationList(node: ASTNode) : ISLPsiElement(node) {
    
    fun getAnnotations(): List<ISLAnnotation> {
        return PsiTreeUtil.getChildrenOfTypeAsList(this, ISLAnnotation::class.java)
    }
}

/**
 * Annotation
 */
class ISLAnnotation(node: ASTNode) : ISLPsiElement(node) {
    
    fun getName(): String? {
        return findChildByType<PsiElement>(ISLTokenTypes.IDENTIFIER)?.text
    }
}

/**
 * Input block
 */
class ISLInputBlock(node: ASTNode) : ISLPsiElement(node) {
    
    fun getFields(): List<ISLFieldDeclaration> {
        return PsiTreeUtil.getChildrenOfTypeAsList(this, ISLFieldDeclaration::class.java)
    }
}

/**
 * Output block
 */
class ISLOutputBlock(node: ASTNode) : ISLPsiElement(node)

/**
 * Error declaration
 */
class ISLErrorDeclaration(node: ASTNode) : ISLPsiElement(node), PsiNameIdentifierOwner {
    
    override fun getName(): String? {
        return nameIdentifier?.text
    }
    
    override fun setName(name: String): PsiElement {
        return this
    }
    
    override fun getNameIdentifier(): PsiElement? {
        return findChildByType(ISLTokenTypes.IDENTIFIER)
    }
}

/**
 * Preconditions block
 */
class ISLPreconditionsBlock(node: ASTNode) : ISLPsiElement(node)

/**
 * Postconditions block
 */
class ISLPostconditionsBlock(node: ASTNode) : ISLPsiElement(node)

/**
 * Invariants block
 */
class ISLInvariantsBlock(node: ASTNode) : ISLPsiElement(node)

/**
 * Temporal block
 */
class ISLTemporalBlock(node: ASTNode) : ISLPsiElement(node)

/**
 * Security block
 */
class ISLSecurityBlock(node: ASTNode) : ISLPsiElement(node)

/**
 * Compliance block
 */
class ISLComplianceBlock(node: ASTNode) : ISLPsiElement(node)

/**
 * Actors block
 */
class ISLActorsBlock(node: ASTNode) : ISLPsiElement(node)

/**
 * Lifecycle block
 */
class ISLLifecycleBlock(node: ASTNode) : ISLPsiElement(node)
