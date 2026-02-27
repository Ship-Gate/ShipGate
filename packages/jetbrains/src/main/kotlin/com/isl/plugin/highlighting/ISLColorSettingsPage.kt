package com.isl.plugin.highlighting

import com.intellij.openapi.editor.colors.TextAttributesKey
import com.intellij.openapi.fileTypes.SyntaxHighlighter
import com.intellij.openapi.options.colors.AttributesDescriptor
import com.intellij.openapi.options.colors.ColorDescriptor
import com.intellij.openapi.options.colors.ColorSettingsPage
import com.isl.plugin.ISLIcons
import javax.swing.Icon

/**
 * Color Settings Page for ISL
 */
class ISLColorSettingsPage : ColorSettingsPage {
    
    companion object {
        private val DESCRIPTORS = arrayOf(
            AttributesDescriptor("Keyword", ISLSyntaxHighlighter.KEYWORD),
            AttributesDescriptor("Type", ISLSyntaxHighlighter.TYPE),
            AttributesDescriptor("Annotation", ISLSyntaxHighlighter.ANNOTATION),
            AttributesDescriptor("String", ISLSyntaxHighlighter.STRING),
            AttributesDescriptor("Number", ISLSyntaxHighlighter.NUMBER),
            AttributesDescriptor("Duration", ISLSyntaxHighlighter.DURATION),
            AttributesDescriptor("Comment", ISLSyntaxHighlighter.COMMENT),
            AttributesDescriptor("Operator", ISLSyntaxHighlighter.OPERATOR),
            AttributesDescriptor("Braces", ISLSyntaxHighlighter.BRACE),
            AttributesDescriptor("Brackets", ISLSyntaxHighlighter.BRACKET),
            AttributesDescriptor("Parentheses", ISLSyntaxHighlighter.PAREN),
            AttributesDescriptor("Identifier", ISLSyntaxHighlighter.IDENTIFIER),
            AttributesDescriptor("Field", ISLSyntaxHighlighter.FIELD),
            AttributesDescriptor("Constant", ISLSyntaxHighlighter.CONSTANT),
            AttributesDescriptor("Bad character", ISLSyntaxHighlighter.BAD_CHARACTER),
        )
    }
    
    override fun getIcon(): Icon = ISLIcons.FILE
    
    override fun getHighlighter(): SyntaxHighlighter = ISLSyntaxHighlighter()
    
    override fun getDemoText(): String = """
# User Authentication Domain
domain UserAuthentication {
  version: "1.0.0"

  type Email = String { format: "email", max_length: 254 }

  enum UserStatus {
    ACTIVE
    INACTIVE
    LOCKED
  }

  entity User {
    id: UUID [immutable, unique]
    email: Email [unique, indexed]
    status: UserStatus [indexed]
    created_at: Timestamp [immutable]
    failed_attempts: Int [default: 0]
  }

  behavior Login {
    description: "Authenticate a user"

    actors {
      Anonymous {
        for: authentication
      }
    }

    input {
      email: Email
      password: String [sensitive]
    }

    output {
      success: Session

      errors {
        INVALID_CREDENTIALS {
          when: "Email or password is incorrect"
          retriable: true
          retry_after: 1s
        }
      }
    }

    preconditions {
      email.is_valid_format
      password.length >= 8
    }

    postconditions {
      success implies {
        - Session.exists(result.id)
        - User.last_login == now()
      }
    }

    temporal {
      - within 500ms (p50): response returned
      - within 2s (p99): response returned
    }

    security {
      - rate_limit 100 per hour per ip_address
    }
  }
}
    """.trimIndent()
    
    override fun getAdditionalHighlightingTagToDescriptorMap(): Map<String, TextAttributesKey>? = null
    
    override fun getAttributeDescriptors(): Array<AttributesDescriptor> = DESCRIPTORS
    
    override fun getColorDescriptors(): Array<ColorDescriptor> = ColorDescriptor.EMPTY_ARRAY
    
    override fun getDisplayName(): String = "ISL"
}
