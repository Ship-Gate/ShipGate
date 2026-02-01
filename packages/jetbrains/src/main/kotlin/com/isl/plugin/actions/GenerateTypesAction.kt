package com.isl.plugin.actions

import com.intellij.notification.NotificationGroupManager
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
import java.io.BufferedReader
import java.io.File
import java.io.InputStreamReader

/**
 * Action to generate TypeScript/Python types from ISL specification
 */
class GenerateTypesAction : AnAction() {
    
    override fun actionPerformed(e: AnActionEvent) {
        val project = e.project ?: return
        val file = e.getData(CommonDataKeys.VIRTUAL_FILE) ?: return
        
        if (file.fileType != ISLFileType) {
            Messages.showWarningDialog(
                project,
                "Please select an ISL file",
                "Generate Types"
            )
            return
        }
        
        // Save the file first
        ApplicationManager.getApplication().invokeAndWait {
            FileDocumentManager.getInstance().saveAllDocuments()
        }
        
        // Ask for output format
        val formats = arrayOf("TypeScript", "Python", "Both")
        val choice = Messages.showChooseDialog(
            project,
            "Select output format",
            "Generate Types",
            null,
            formats,
            formats[0]
        )
        
        if (choice < 0) return
        
        val format = when (choice) {
            0 -> "typescript"
            1 -> "python"
            else -> "all"
        }
        
        // Run generation
        ProgressManager.getInstance().run(object : Task.Backgroundable(
            project,
            "Generating types from ISL",
            true
        ) {
            override fun run(indicator: ProgressIndicator) {
                indicator.text = "Generating $format types..."
                
                try {
                    val result = runIslCli(project, file, "generate", "types", "--format", format)
                    
                    ApplicationManager.getApplication().invokeLater {
                        if (result.success) {
                            showNotification(
                                project,
                                "Types generated successfully",
                                result.output,
                                NotificationType.INFORMATION
                            )
                        } else {
                            showNotification(
                                project,
                                "Type generation failed",
                                result.output,
                                NotificationType.ERROR
                            )
                        }
                    }
                } catch (ex: Exception) {
                    ApplicationManager.getApplication().invokeLater {
                        showNotification(
                            project,
                            "Type generation failed",
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
 * Action to generate tests from ISL specification
 */
class GenerateTestsAction : AnAction() {
    
    override fun actionPerformed(e: AnActionEvent) {
        val project = e.project ?: return
        val file = e.getData(CommonDataKeys.VIRTUAL_FILE) ?: return
        
        if (file.fileType != ISLFileType) {
            Messages.showWarningDialog(
                project,
                "Please select an ISL file",
                "Generate Tests"
            )
            return
        }
        
        ApplicationManager.getApplication().invokeAndWait {
            FileDocumentManager.getInstance().saveAllDocuments()
        }
        
        // Ask for test framework
        val frameworks = arrayOf("Vitest", "Jest", "PyTest")
        val choice = Messages.showChooseDialog(
            project,
            "Select test framework",
            "Generate Tests",
            null,
            frameworks,
            frameworks[0]
        )
        
        if (choice < 0) return
        
        val framework = frameworks[choice].lowercase()
        
        ProgressManager.getInstance().run(object : Task.Backgroundable(
            project,
            "Generating tests from ISL",
            true
        ) {
            override fun run(indicator: ProgressIndicator) {
                indicator.text = "Generating $framework tests..."
                
                try {
                    val result = runIslCli(project, file, "generate", "tests", "--framework", framework)
                    
                    ApplicationManager.getApplication().invokeLater {
                        if (result.success) {
                            showNotification(
                                project,
                                "Tests generated successfully",
                                result.output,
                                NotificationType.INFORMATION
                            )
                        } else {
                            showNotification(
                                project,
                                "Test generation failed",
                                result.output,
                                NotificationType.ERROR
                            )
                        }
                    }
                } catch (ex: Exception) {
                    ApplicationManager.getApplication().invokeLater {
                        showNotification(
                            project,
                            "Test generation failed",
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
 * Action to generate documentation from ISL specification
 */
class GenerateDocsAction : AnAction() {
    
    override fun actionPerformed(e: AnActionEvent) {
        val project = e.project ?: return
        val file = e.getData(CommonDataKeys.VIRTUAL_FILE) ?: return
        
        if (file.fileType != ISLFileType) {
            Messages.showWarningDialog(
                project,
                "Please select an ISL file",
                "Generate Documentation"
            )
            return
        }
        
        ApplicationManager.getApplication().invokeAndWait {
            FileDocumentManager.getInstance().saveAllDocuments()
        }
        
        ProgressManager.getInstance().run(object : Task.Backgroundable(
            project,
            "Generating documentation from ISL",
            true
        ) {
            override fun run(indicator: ProgressIndicator) {
                indicator.text = "Generating documentation..."
                
                try {
                    val result = runIslCli(project, file, "generate", "docs")
                    
                    ApplicationManager.getApplication().invokeLater {
                        if (result.success) {
                            showNotification(
                                project,
                                "Documentation generated successfully",
                                result.output,
                                NotificationType.INFORMATION
                            )
                        } else {
                            showNotification(
                                project,
                                "Documentation generation failed",
                                result.output,
                                NotificationType.ERROR
                            )
                        }
                    }
                } catch (ex: Exception) {
                    ApplicationManager.getApplication().invokeLater {
                        showNotification(
                            project,
                            "Documentation generation failed",
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
 * Action to generate OpenAPI spec from ISL
 */
class GenerateOpenAPIAction : AnAction() {
    
    override fun actionPerformed(e: AnActionEvent) {
        val project = e.project ?: return
        val file = e.getData(CommonDataKeys.VIRTUAL_FILE) ?: return
        
        if (file.fileType != ISLFileType) return
        
        ApplicationManager.getApplication().invokeAndWait {
            FileDocumentManager.getInstance().saveAllDocuments()
        }
        
        ProgressManager.getInstance().run(object : Task.Backgroundable(
            project,
            "Generating OpenAPI spec from ISL",
            true
        ) {
            override fun run(indicator: ProgressIndicator) {
                indicator.text = "Generating OpenAPI specification..."
                
                try {
                    val result = runIslCli(project, file, "generate", "openapi")
                    
                    ApplicationManager.getApplication().invokeLater {
                        if (result.success) {
                            showNotification(
                                project,
                                "OpenAPI spec generated successfully",
                                result.output,
                                NotificationType.INFORMATION
                            )
                        } else {
                            showNotification(
                                project,
                                "OpenAPI generation failed",
                                result.output,
                                NotificationType.ERROR
                            )
                        }
                    }
                } catch (ex: Exception) {
                    ApplicationManager.getApplication().invokeLater {
                        showNotification(
                            project,
                            "OpenAPI generation failed",
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
 * CLI execution result
 */
data class CliResult(
    val success: Boolean,
    val output: String
)

/**
 * Run ISL CLI command
 */
fun runIslCli(project: Project, file: VirtualFile, vararg args: String): CliResult {
    val projectPath = project.basePath ?: return CliResult(false, "No project path")
    val filePath = file.path
    
    // Try npx isl first, fallback to global isl
    val commands = listOf(
        listOf("npx", "isl", *args, filePath),
        listOf("isl", *args, filePath)
    )
    
    for (command in commands) {
        try {
            val processBuilder = ProcessBuilder(command)
                .directory(File(projectPath))
                .redirectErrorStream(true)
            
            val process = processBuilder.start()
            val output = BufferedReader(InputStreamReader(process.inputStream))
                .readText()
            
            val exitCode = process.waitFor()
            
            if (exitCode == 0 || output.isNotBlank()) {
                return CliResult(exitCode == 0, output)
            }
        } catch (e: Exception) {
            // Try next command
            continue
        }
    }
    
    return CliResult(
        false,
        "ISL CLI not found. Install with: npm install -g @intentos/isl-cli"
    )
}

/**
 * Show notification
 */
fun showNotification(
    project: Project,
    title: String,
    content: String,
    type: NotificationType
) {
    NotificationGroupManager.getInstance()
        .getNotificationGroup("ISL Notifications")
        .createNotification(title, content, type)
        .notify(project)
}
