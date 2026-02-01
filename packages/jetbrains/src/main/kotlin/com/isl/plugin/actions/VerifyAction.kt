package com.isl.plugin.actions

import com.intellij.notification.NotificationType
import com.intellij.openapi.actionSystem.AnAction
import com.intellij.openapi.actionSystem.AnActionEvent
import com.intellij.openapi.actionSystem.CommonDataKeys
import com.intellij.openapi.application.ApplicationManager
import com.intellij.openapi.fileEditor.FileDocumentManager
import com.intellij.openapi.progress.ProgressIndicator
import com.intellij.openapi.progress.ProgressManager
import com.intellij.openapi.progress.Task
import com.intellij.openapi.project.Project
import com.intellij.openapi.ui.Messages
import com.intellij.openapi.vfs.VirtualFile
import com.isl.plugin.ISLFileType
import com.isl.plugin.ISLIcons

/**
 * Action to verify implementation against ISL specification
 */
class VerifyAction : AnAction() {
    
    override fun actionPerformed(e: AnActionEvent) {
        val project = e.project ?: return
        val file = e.getData(CommonDataKeys.VIRTUAL_FILE) ?: return
        
        if (file.fileType != ISLFileType) {
            Messages.showWarningDialog(
                project,
                "Please select an ISL file",
                "Verify Implementation"
            )
            return
        }
        
        ApplicationManager.getApplication().invokeAndWait {
            FileDocumentManager.getInstance().saveAllDocuments()
        }
        
        runVerification(project, file)
    }
    
    private fun runVerification(project: Project, file: VirtualFile) {
        ProgressManager.getInstance().run(object : Task.Backgroundable(
            project,
            "Verifying implementation against ISL spec",
            true
        ) {
            override fun run(indicator: ProgressIndicator) {
                indicator.text = "Running verification..."
                indicator.fraction = 0.0
                
                try {
                    // Run ISL verify command
                    indicator.text = "Checking preconditions..."
                    indicator.fraction = 0.2
                    
                    val result = runIslCli(project, file, "verify")
                    
                    indicator.fraction = 1.0
                    
                    ApplicationManager.getApplication().invokeLater {
                        if (result.success) {
                            showNotification(
                                project,
                                "Verification Passed ✓",
                                result.output,
                                NotificationType.INFORMATION
                            )
                        } else {
                            showNotification(
                                project,
                                "Verification Failed",
                                result.output,
                                NotificationType.WARNING
                            )
                        }
                    }
                } catch (ex: Exception) {
                    ApplicationManager.getApplication().invokeLater {
                        showNotification(
                            project,
                            "Verification Error",
                            ex.message ?: "Unknown error",
                            NotificationType.ERROR
                        )
                    }
                }
            }
        })
    }
    
    override fun update(e: AnActionEvent) {
        val file = e.getData(CommonDataKeys.VIRTUAL_FILE)
        e.presentation.isEnabledAndVisible = file?.fileType == ISLFileType
        e.presentation.icon = ISLIcons.SUCCESS
    }
}

/**
 * Quick verify action from editor context menu
 */
class QuickVerifyAction : AnAction() {
    
    override fun actionPerformed(e: AnActionEvent) {
        val project = e.project ?: return
        val file = e.getData(CommonDataKeys.VIRTUAL_FILE) ?: return
        
        if (file.fileType != ISLFileType) return
        
        ApplicationManager.getApplication().invokeAndWait {
            FileDocumentManager.getInstance().saveAllDocuments()
        }
        
        ProgressManager.getInstance().run(object : Task.Backgroundable(
            project,
            "Quick verification",
            false
        ) {
            override fun run(indicator: ProgressIndicator) {
                try {
                    val result = runIslCli(project, file, "check")
                    
                    ApplicationManager.getApplication().invokeLater {
                        showNotification(
                            project,
                            if (result.success) "Spec Valid ✓" else "Spec Invalid",
                            result.output.take(200),
                            if (result.success) NotificationType.INFORMATION else NotificationType.WARNING
                        )
                    }
                } catch (ex: Exception) {
                    ApplicationManager.getApplication().invokeLater {
                        showNotification(
                            project,
                            "Check Failed",
                            ex.message ?: "Unknown error",
                            NotificationType.ERROR
                        )
                    }
                }
            }
        })
    }
    
    override fun update(e: AnActionEvent) {
        val file = e.getData(CommonDataKeys.VIRTUAL_FILE)
        e.presentation.isEnabledAndVisible = file?.fileType == ISLFileType
    }
}

/**
 * Check specification action
 */
class CheckSpecAction : AnAction() {
    
    override fun actionPerformed(e: AnActionEvent) {
        val project = e.project ?: return
        val file = e.getData(CommonDataKeys.VIRTUAL_FILE) ?: return
        
        if (file.fileType != ISLFileType) return
        
        ApplicationManager.getApplication().invokeAndWait {
            FileDocumentManager.getInstance().saveAllDocuments()
        }
        
        ProgressManager.getInstance().run(object : Task.Backgroundable(
            project,
            "Checking ISL specification",
            true
        ) {
            override fun run(indicator: ProgressIndicator) {
                indicator.text = "Parsing specification..."
                
                try {
                    val result = runIslCli(project, file, "check", "--verbose")
                    
                    ApplicationManager.getApplication().invokeLater {
                        if (result.success) {
                            showNotification(
                                project,
                                "Specification Valid",
                                result.output,
                                NotificationType.INFORMATION
                            )
                        } else {
                            showNotification(
                                project,
                                "Specification Errors",
                                result.output,
                                NotificationType.ERROR
                            )
                        }
                    }
                } catch (ex: Exception) {
                    ApplicationManager.getApplication().invokeLater {
                        showNotification(
                            project,
                            "Check Failed",
                            ex.message ?: "Unknown error",
                            NotificationType.ERROR
                        )
                    }
                }
            }
        })
    }
    
    override fun update(e: AnActionEvent) {
        val file = e.getData(CommonDataKeys.VIRTUAL_FILE)
        e.presentation.isEnabledAndVisible = file?.fileType == ISLFileType
    }
}

/**
 * Run chaos tests action
 */
class RunChaosAction : AnAction() {
    
    override fun actionPerformed(e: AnActionEvent) {
        val project = e.project ?: return
        val file = e.getData(CommonDataKeys.VIRTUAL_FILE) ?: return
        
        if (file.fileType != ISLFileType) return
        
        ApplicationManager.getApplication().invokeAndWait {
            FileDocumentManager.getInstance().saveAllDocuments()
        }
        
        ProgressManager.getInstance().run(object : Task.Backgroundable(
            project,
            "Running chaos tests",
            true
        ) {
            override fun run(indicator: ProgressIndicator) {
                indicator.text = "Running chaos scenarios..."
                
                try {
                    val result = runIslCli(project, file, "chaos", "--iterations", "100")
                    
                    ApplicationManager.getApplication().invokeLater {
                        showNotification(
                            project,
                            if (result.success) "Chaos Tests Passed" else "Chaos Tests Found Issues",
                            result.output,
                            if (result.success) NotificationType.INFORMATION else NotificationType.WARNING
                        )
                    }
                } catch (ex: Exception) {
                    ApplicationManager.getApplication().invokeLater {
                        showNotification(
                            project,
                            "Chaos Tests Failed",
                            ex.message ?: "Unknown error",
                            NotificationType.ERROR
                        )
                    }
                }
            }
        })
    }
    
    override fun update(e: AnActionEvent) {
        val file = e.getData(CommonDataKeys.VIRTUAL_FILE)
        e.presentation.isEnabledAndVisible = file?.fileType == ISLFileType
    }
}

/**
 * View coverage action
 */
class ViewCoverageAction : AnAction() {
    
    override fun actionPerformed(e: AnActionEvent) {
        val project = e.project ?: return
        
        Messages.showInfoMessage(
            project,
            "Coverage viewer will be available in a future release.",
            "View Spec Coverage"
        )
    }
}

/**
 * Go to implementation action
 */
class GoToImplementationAction : AnAction() {
    
    override fun actionPerformed(e: AnActionEvent) {
        val project = e.project ?: return
        
        Messages.showInfoMessage(
            project,
            "Go to implementation will be available in a future release.",
            "Go to Implementation"
        )
    }
    
    override fun update(e: AnActionEvent) {
        val file = e.getData(CommonDataKeys.VIRTUAL_FILE)
        e.presentation.isEnabledAndVisible = file?.fileType == ISLFileType
    }
}
