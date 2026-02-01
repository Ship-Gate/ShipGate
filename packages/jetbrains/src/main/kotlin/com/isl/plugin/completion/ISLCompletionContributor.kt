package com.isl.plugin.completion

import com.intellij.codeInsight.completion.*
import com.intellij.codeInsight.lookup.LookupElementBuilder
import com.intellij.patterns.PlatformPatterns
import com.intellij.psi.util.PsiTreeUtil
import com.intellij.util.ProcessingContext
import com.isl.plugin.ISLIcons
import com.isl.plugin.psi.*

/**
 * ISL Completion Contributor
 * 
 * Provides code completion for ISL files.
 */
class ISLCompletionContributor : CompletionContributor() {
    
    init {
        // Keywords completion
        extend(
            CompletionType.BASIC,
            PlatformPatterns.psiElement(),
            KeywordCompletionProvider()
        )
        
        // Type completion
        extend(
            CompletionType.BASIC,
            PlatformPatterns.psiElement(),
            TypeCompletionProvider()
        )
        
        // Annotation completion  
        extend(
            CompletionType.BASIC,
            PlatformPatterns.psiElement(),
            AnnotationCompletionProvider()
        )
        
        // Reference completion (entities, behaviors, types)
        extend(
            CompletionType.BASIC,
            PlatformPatterns.psiElement(),
            ReferenceCompletionProvider()
        )
    }
}

/**
 * Keyword completion provider
 */
class KeywordCompletionProvider : CompletionProvider<CompletionParameters>() {
    
    private val topLevelKeywords = listOf(
        "domain" to "Define a new domain",
    )
    
    private val domainKeywords = listOf(
        "version" to "Domain version",
        "imports" to "Import declarations",
        "entity" to "Define an entity",
        "behavior" to "Define a behavior",
        "type" to "Define a type alias",
        "enum" to "Define an enumeration",
        "invariants" to "Global invariants",
    )
    
    private val behaviorKeywords = listOf(
        "description" to "Behavior description",
        "actors" to "Define actors",
        "input" to "Input parameters",
        "output" to "Output and errors",
        "preconditions" to "Input validations",
        "postconditions" to "State guarantees",
        "invariants" to "Behavior invariants",
        "temporal" to "Timing requirements",
        "security" to "Security constraints",
        "compliance" to "Compliance requirements",
        "scenarios" to "Test scenarios",
        "chaos" to "Chaos testing",
    )
    
    private val entityKeywords = listOf(
        "invariants" to "Entity invariants",
        "lifecycle" to "State transitions",
    )
    
    private val outputKeywords = listOf(
        "success" to "Success return type",
        "errors" to "Error definitions",
    )
    
    private val errorKeywords = listOf(
        "when" to "Error condition",
        "retriable" to "Can be retried",
        "retry_after" to "Retry delay",
    )
    
    private val conditionKeywords = listOf(
        "success" to "On success",
        "failure" to "On failure",
        "implies" to "Implies condition",
        "and" to "Logical AND",
        "or" to "Logical OR",
        "not" to "Logical NOT",
        "all" to "For all quantifier",
        "any" to "Exists quantifier",
        "old" to "Previous value",
    )
    
    private val temporalKeywords = listOf(
        "eventually" to "Eventually happens",
        "within" to "Within duration",
        "immediately" to "Immediately",
        "never" to "Never happens",
        "always" to "Always true",
    )
    
    private val actorKeywords = listOf(
        "must" to "Actor requirement",
        "owns" to "Actor ownership",
        "for" to "Actor purpose",
    )
    
    override fun addCompletions(
        parameters: CompletionParameters,
        context: ProcessingContext,
        result: CompletionResultSet
    ) {
        val position = parameters.position
        val parent = position.parent
        
        // Determine context and add appropriate keywords
        when {
            // Top level - suggest domain
            parent is ISLFile || parent?.parent is ISLFile -> {
                addKeywords(result, topLevelKeywords, ISLIcons.DOMAIN)
            }
            
            // Inside domain - suggest entity, behavior, etc.
            isInsideDomain(position) && !isInsideEntity(position) && !isInsideBehavior(position) -> {
                addKeywords(result, domainKeywords, ISLIcons.ENTITY)
            }
            
            // Inside entity
            isInsideEntity(position) -> {
                addKeywords(result, entityKeywords, ISLIcons.INVARIANT)
            }
            
            // Inside behavior
            isInsideBehavior(position) -> {
                addKeywords(result, behaviorKeywords, ISLIcons.BEHAVIOR)
            }
            
            // Inside output block
            isInsideOutputBlock(position) -> {
                addKeywords(result, outputKeywords, null)
            }
            
            // Inside error declaration
            isInsideErrorBlock(position) -> {
                addKeywords(result, errorKeywords, null)
            }
            
            // Inside conditions (pre/post)
            isInsideConditionBlock(position) -> {
                addKeywords(result, conditionKeywords, null)
            }
            
            // Inside temporal block
            isInsideTemporalBlock(position) -> {
                addKeywords(result, temporalKeywords, null)
            }
            
            // Inside actors block
            isInsideActorsBlock(position) -> {
                addKeywords(result, actorKeywords, null)
            }
        }
    }
    
    private fun addKeywords(
        result: CompletionResultSet,
        keywords: List<Pair<String, String>>,
        icon: javax.swing.Icon?
    ) {
        keywords.forEach { (keyword, description) ->
            val element = LookupElementBuilder.create(keyword)
                .bold()
                .withTypeText("keyword")
                .withTailText(" $description", true)
            
            result.addElement(if (icon != null) element.withIcon(icon) else element)
        }
    }
    
    private fun isInsideDomain(element: com.intellij.psi.PsiElement): Boolean {
        return PsiTreeUtil.getParentOfType(element, ISLDomainDeclaration::class.java) != null
    }
    
    private fun isInsideEntity(element: com.intellij.psi.PsiElement): Boolean {
        return PsiTreeUtil.getParentOfType(element, ISLEntityDeclaration::class.java) != null
    }
    
    private fun isInsideBehavior(element: com.intellij.psi.PsiElement): Boolean {
        return PsiTreeUtil.getParentOfType(element, ISLBehaviorDeclaration::class.java) != null
    }
    
    private fun isInsideOutputBlock(element: com.intellij.psi.PsiElement): Boolean {
        return PsiTreeUtil.getParentOfType(element, ISLOutputBlock::class.java) != null
    }
    
    private fun isInsideErrorBlock(element: com.intellij.psi.PsiElement): Boolean {
        return PsiTreeUtil.getParentOfType(element, ISLErrorDeclaration::class.java) != null
    }
    
    private fun isInsideConditionBlock(element: com.intellij.psi.PsiElement): Boolean {
        return PsiTreeUtil.getParentOfType(element, ISLPreconditionsBlock::class.java) != null ||
               PsiTreeUtil.getParentOfType(element, ISLPostconditionsBlock::class.java) != null
    }
    
    private fun isInsideTemporalBlock(element: com.intellij.psi.PsiElement): Boolean {
        return PsiTreeUtil.getParentOfType(element, ISLTemporalBlock::class.java) != null
    }
    
    private fun isInsideActorsBlock(element: com.intellij.psi.PsiElement): Boolean {
        return PsiTreeUtil.getParentOfType(element, ISLActorsBlock::class.java) != null
    }
}

/**
 * Type completion provider
 */
class TypeCompletionProvider : CompletionProvider<CompletionParameters>() {
    
    private val builtInTypes = listOf(
        "String" to "Text value",
        "Int" to "Integer number",
        "Float" to "Floating point number",
        "Decimal" to "Precise decimal number",
        "Boolean" to "True or false",
        "UUID" to "Unique identifier",
        "Timestamp" to "Date and time",
        "Date" to "Date only",
        "Duration" to "Time duration",
        "List" to "Ordered collection",
        "Map" to "Key-value pairs",
        "Set" to "Unique collection",
        "JSON" to "JSON data",
        "Any" to "Any type",
        "Void" to "No value",
    )
    
    override fun addCompletions(
        parameters: CompletionParameters,
        context: ProcessingContext,
        result: CompletionResultSet
    ) {
        // Add built-in types
        builtInTypes.forEach { (type, description) ->
            result.addElement(
                LookupElementBuilder.create(type)
                    .withTypeText("type")
                    .withTailText(" $description", true)
                    .withIcon(ISLIcons.TYPE)
            )
        }
    }
}

/**
 * Annotation completion provider
 */
class AnnotationCompletionProvider : CompletionProvider<CompletionParameters>() {
    
    private val annotations = listOf(
        "immutable" to "Cannot be changed after creation",
        "unique" to "Must be unique",
        "indexed" to "Database index",
        "secret" to "Sensitive data (excluded from logs)",
        "sensitive" to "PII or sensitive",
        "pii" to "Personal identifiable information",
        "computed" to "Computed from other fields",
        "deprecated" to "Deprecated field",
        "default" to "Default value",
        "optional" to "Optional field",
        "required" to "Required field",
    )
    
    override fun addCompletions(
        parameters: CompletionParameters,
        context: ProcessingContext,
        result: CompletionResultSet
    ) {
        annotations.forEach { (annotation, description) ->
            result.addElement(
                LookupElementBuilder.create(annotation)
                    .withTypeText("annotation")
                    .withTailText(" $description", true)
                    .withIcon(ISLIcons.ANNOTATION)
            )
        }
    }
}

/**
 * Reference completion provider
 */
class ReferenceCompletionProvider : CompletionProvider<CompletionParameters>() {
    
    override fun addCompletions(
        parameters: CompletionParameters,
        context: ProcessingContext,
        result: CompletionResultSet
    ) {
        val file = parameters.originalFile as? ISLFile ?: return
        
        // Add entities
        file.getEntities().forEach { entity ->
            entity.name?.let { name ->
                result.addElement(
                    LookupElementBuilder.create(name)
                        .withTypeText("entity")
                        .withIcon(ISLIcons.ENTITY)
                )
            }
        }
        
        // Add behaviors
        file.getBehaviors().forEach { behavior ->
            behavior.name?.let { name ->
                result.addElement(
                    LookupElementBuilder.create(name)
                        .withTypeText("behavior")
                        .withIcon(ISLIcons.BEHAVIOR)
                )
            }
        }
    }
}
