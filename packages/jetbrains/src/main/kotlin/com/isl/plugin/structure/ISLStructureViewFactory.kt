package com.isl.plugin.structure

import com.intellij.ide.structureView.*
import com.intellij.ide.util.treeView.smartTree.TreeElement
import com.intellij.lang.PsiStructureViewFactory
import com.intellij.navigation.ItemPresentation
import com.intellij.openapi.editor.Editor
import com.intellij.psi.PsiFile
import com.intellij.psi.util.PsiTreeUtil
import com.isl.plugin.ISLIcons
import com.isl.plugin.psi.*
import javax.swing.Icon

/**
 * ISL Structure View Factory
 */
class ISLStructureViewFactory : PsiStructureViewFactory {
    
    override fun getStructureViewBuilder(psiFile: PsiFile): StructureViewBuilder? {
        if (psiFile !is ISLFile) return null
        
        return object : TreeBasedStructureViewBuilder() {
            override fun createStructureViewModel(editor: Editor?): StructureViewModel {
                return ISLStructureViewModel(psiFile, editor)
            }
        }
    }
}

/**
 * ISL Structure View Model
 */
class ISLStructureViewModel(
    file: ISLFile,
    editor: Editor?
) : StructureViewModelBase(file, editor, ISLStructureViewElement(file)) {
    
    override fun getSorters() = arrayOf(
        com.intellij.ide.util.treeView.smartTree.Sorter.ALPHA_SORTER
    )
}

/**
 * ISL Structure View Element
 */
class ISLStructureViewElement(private val element: com.intellij.psi.PsiElement) : StructureViewTreeElement {
    
    override fun getValue(): Any = element
    
    override fun getPresentation(): ItemPresentation {
        return when (element) {
            is ISLFile -> object : ItemPresentation {
                override fun getPresentableText(): String = element.name ?: "ISL File"
                override fun getIcon(unused: Boolean): Icon = ISLIcons.FILE
                override fun getLocationString(): String? = null
            }
            
            is ISLDomainDeclaration -> object : ItemPresentation {
                override fun getPresentableText(): String = element.name ?: "domain"
                override fun getIcon(unused: Boolean): Icon = ISLIcons.DOMAIN
                override fun getLocationString(): String? = "domain"
            }
            
            is ISLEntityDeclaration -> object : ItemPresentation {
                override fun getPresentableText(): String = element.name ?: "entity"
                override fun getIcon(unused: Boolean): Icon = ISLIcons.ENTITY
                override fun getLocationString(): String? = "entity"
            }
            
            is ISLBehaviorDeclaration -> object : ItemPresentation {
                override fun getPresentableText(): String = element.name ?: "behavior"
                override fun getIcon(unused: Boolean): Icon = ISLIcons.BEHAVIOR
                override fun getLocationString(): String? = "behavior"
            }
            
            is ISLTypeDeclaration -> object : ItemPresentation {
                override fun getPresentableText(): String = element.name ?: "type"
                override fun getIcon(unused: Boolean): Icon = ISLIcons.TYPE
                override fun getLocationString(): String? = "type"
            }
            
            is ISLEnumDeclaration -> object : ItemPresentation {
                override fun getPresentableText(): String = element.name ?: "enum"
                override fun getIcon(unused: Boolean): Icon = ISLIcons.ENUM
                override fun getLocationString(): String? = "enum"
            }
            
            is ISLFieldDeclaration -> object : ItemPresentation {
                override fun getPresentableText(): String = element.name ?: "field"
                override fun getIcon(unused: Boolean): Icon = ISLIcons.FIELD
                override fun getLocationString(): String? = element.getType()?.text
            }
            
            else -> object : ItemPresentation {
                override fun getPresentableText(): String = element.text?.take(30) ?: ""
                override fun getIcon(unused: Boolean): Icon? = null
                override fun getLocationString(): String? = null
            }
        }
    }
    
    override fun getChildren(): Array<TreeElement> {
        return when (element) {
            is ISLFile -> {
                val domain = PsiTreeUtil.findChildOfType(element, ISLDomainDeclaration::class.java)
                if (domain != null) {
                    arrayOf(ISLStructureViewElement(domain))
                } else {
                    emptyArray()
                }
            }
            
            is ISLDomainDeclaration -> {
                val children = mutableListOf<TreeElement>()
                
                // Add entities
                element.getEntities().forEach { entity ->
                    children.add(ISLStructureViewElement(entity))
                }
                
                // Add behaviors
                element.getBehaviors().forEach { behavior ->
                    children.add(ISLStructureViewElement(behavior))
                }
                
                // Add types
                element.getTypes().forEach { type ->
                    children.add(ISLStructureViewElement(type))
                }
                
                // Add enums
                element.getEnums().forEach { enum ->
                    children.add(ISLStructureViewElement(enum))
                }
                
                children.toTypedArray()
            }
            
            is ISLEntityDeclaration -> {
                element.getFields().map { field ->
                    ISLStructureViewElement(field)
                }.toTypedArray()
            }
            
            is ISLBehaviorDeclaration -> {
                val children = mutableListOf<TreeElement>()
                
                element.getInputBlock()?.getFields()?.forEach { field ->
                    children.add(ISLStructureViewElement(field))
                }
                
                children.toTypedArray()
            }
            
            else -> emptyArray()
        }
    }
    
    override fun navigate(requestFocus: Boolean) {
        if (element is com.intellij.pom.Navigatable) {
            element.navigate(requestFocus)
        }
    }
    
    override fun canNavigate(): Boolean = element is com.intellij.pom.Navigatable
    
    override fun canNavigateToSource(): Boolean = canNavigate()
}
