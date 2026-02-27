package com.isl.plugin

import com.intellij.lang.Commenter

/**
 * ISL Commenter
 */
class ISLCommenter : Commenter {
    
    override fun getLineCommentPrefix(): String = "# "
    
    override fun getBlockCommentPrefix(): String? = null
    
    override fun getBlockCommentSuffix(): String? = null
    
    override fun getCommentedBlockCommentPrefix(): String? = null
    
    override fun getCommentedBlockCommentSuffix(): String? = null
}
