package com.isl.plugin.actions

import com.intellij.ide.actions.CreateFileFromTemplateAction
import com.intellij.ide.actions.CreateFileFromTemplateDialog
import com.intellij.openapi.project.DumbAware
import com.intellij.openapi.project.Project
import com.intellij.psi.PsiDirectory
import com.isl.plugin.ISLIcons

/**
 * Action to create a new ISL file
 */
class NewISLFileAction : CreateFileFromTemplateAction(
    "ISL Specification",
    "Create a new ISL specification file",
    ISLIcons.FILE
), DumbAware {
    
    override fun buildDialog(
        project: Project,
        directory: PsiDirectory,
        builder: CreateFileFromTemplateDialog.Builder
    ) {
        builder
            .setTitle("New ISL Specification")
            .addKind("Domain Specification", ISLIcons.DOMAIN, "ISL Domain")
            .addKind("Empty File", ISLIcons.FILE, "ISL Empty")
    }
    
    override fun getActionName(
        directory: PsiDirectory?,
        newName: String,
        templateName: String?
    ): String = "Creating ISL specification: $newName"
}
