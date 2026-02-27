package com.isl.plugin.annotator

import com.intellij.lang.annotation.AnnotationHolder
import com.intellij.lang.annotation.Annotator
import com.intellij.lang.annotation.HighlightSeverity
import com.intellij.psi.PsiElement
import com.intellij.psi.util.PsiTreeUtil
import com.isl.plugin.highlighting.ISLSyntaxHighlighter
import com.isl.plugin.lexer.ISLTokenTypes
import com.isl.plugin.psi.*

/**
 * ISL Annotator
 * 
 * Provides semantic error highlighting and additional syntax coloring.
 */
class ISLAnnotator : Annotator {
    
    override fun annotate(element: PsiElement, holder: AnnotationHolder) {
        when (element) {
            is ISLEntityDeclaration -> annotateEntity(element, holder)
            is ISLBehaviorDeclaration -> annotateBehavior(element, holder)
            is ISLFieldDeclaration -> annotateField(element, holder)
            is ISLTypeDeclaration -> annotateType(element, holder)
            is ISLEnumDeclaration -> annotateEnum(element, holder)
        }
        
        // Highlight type references
        if (element.node?.elementType == ISLTokenTypes.IDENTIFIER) {
            val text = element.text
            if (text.isNotEmpty() && text[0].isUpperCase()) {
                // Check if it's a type reference (not a declaration)
                val parent = element.parent
                if (parent is ISLTypeExpression) {
                    holder.newSilentAnnotation(HighlightSeverity.INFORMATION)
                        .textAttributes(ISLSyntaxHighlighter.TYPE)
                        .create()
                }
            }
        }
    }
    
    private fun annotateEntity(entity: ISLEntityDeclaration, holder: AnnotationHolder) {
        val name = entity.name
        
        // Check for empty entity
        if (entity.getFields().isEmpty()) {
            holder.newAnnotation(HighlightSeverity.WEAK_WARNING, "Entity has no fields")
                .range(entity)
                .create()
        }
        
        // Check for missing id field
        val hasIdField = entity.getFields().any { 
            it.name?.lowercase() == "id" 
        }
        if (!hasIdField) {
            holder.newAnnotation(HighlightSeverity.WARNING, "Entity should have an 'id' field")
                .range(entity.nameIdentifier ?: entity)
                .create()
        }
        
        // Check for duplicate field names
        val fieldNames = entity.getFields().mapNotNull { it.name }
        val duplicates = fieldNames.groupBy { it }.filter { it.value.size > 1 }.keys
        
        entity.getFields().forEach { field ->
            if (field.name in duplicates) {
                holder.newAnnotation(HighlightSeverity.ERROR, "Duplicate field name: ${field.name}")
                    .range(field.nameIdentifier ?: field)
                    .create()
            }
        }
    }
    
    private fun annotateBehavior(behavior: ISLBehaviorDeclaration, holder: AnnotationHolder) {
        val name = behavior.name
        
        // Check naming convention (PascalCase)
        if (name != null && !name[0].isUpperCase()) {
            holder.newAnnotation(
                HighlightSeverity.WEAK_WARNING, 
                "Behavior names should be PascalCase"
            )
                .range(behavior.nameIdentifier ?: behavior)
                .create()
        }
        
        // Check for missing output block
        if (behavior.getOutputBlock() == null) {
            holder.newAnnotation(HighlightSeverity.WARNING, "Behavior has no output block")
                .range(behavior)
                .create()
        }
    }
    
    private fun annotateField(field: ISLFieldDeclaration, holder: AnnotationHolder) {
        val name = field.name ?: return
        
        // Check naming convention (snake_case or camelCase)
        if (name.contains("-")) {
            holder.newAnnotation(
                HighlightSeverity.WARNING,
                "Field names should use snake_case or camelCase, not kebab-case"
            )
                .range(field.nameIdentifier ?: field)
                .create()
        }
        
        // Highlight sensitive fields
        val annotations = field.getAnnotations()?.getAnnotations()?.mapNotNull { it.getName() } ?: emptyList()
        
        if ("secret" in annotations || "sensitive" in annotations) {
            holder.newSilentAnnotation(HighlightSeverity.INFORMATION)
                .textAttributes(ISLSyntaxHighlighter.ANNOTATION)
                .range(field)
                .create()
        }
    }
    
    private fun annotateType(type: ISLTypeDeclaration, holder: AnnotationHolder) {
        val name = type.name ?: return
        
        // Check naming convention (PascalCase)
        if (!name[0].isUpperCase()) {
            holder.newAnnotation(
                HighlightSeverity.WARNING,
                "Type names should be PascalCase"
            )
                .range(type.nameIdentifier ?: type)
                .create()
        }
    }
    
    private fun annotateEnum(enum: ISLEnumDeclaration, holder: AnnotationHolder) {
        val name = enum.name ?: return
        
        // Check naming convention for enum (PascalCase)
        if (!name[0].isUpperCase()) {
            holder.newAnnotation(
                HighlightSeverity.WARNING,
                "Enum names should be PascalCase"
            )
                .range(enum.nameIdentifier ?: enum)
                .create()
        }
        
        // Check for empty enum
        if (enum.getVariants().isEmpty()) {
            holder.newAnnotation(HighlightSeverity.WARNING, "Enum has no variants")
                .range(enum)
                .create()
        }
        
        // Check enum variant naming (SCREAMING_SNAKE_CASE)
        enum.getVariants().forEach { variant ->
            if (variant != variant.uppercase()) {
                // Find the element for the variant (this is simplified)
                holder.newAnnotation(
                    HighlightSeverity.WEAK_WARNING,
                    "Enum variants should be SCREAMING_SNAKE_CASE"
                )
                    .range(enum)
                    .create()
            }
        }
    }
}
