package com.isl.plugin

import com.intellij.openapi.util.IconLoader
import javax.swing.Icon

/**
 * ISL Plugin Icons
 */
object ISLIcons {
    
    @JvmField
    val FILE: Icon = IconLoader.getIcon("/icons/isl.svg", ISLIcons::class.java)
    
    @JvmField
    val DOMAIN: Icon = IconLoader.getIcon("/icons/domain.svg", ISLIcons::class.java)
    
    @JvmField
    val ENTITY: Icon = IconLoader.getIcon("/icons/entity.svg", ISLIcons::class.java)
    
    @JvmField
    val BEHAVIOR: Icon = IconLoader.getIcon("/icons/behavior.svg", ISLIcons::class.java)
    
    @JvmField
    val TYPE: Icon = IconLoader.getIcon("/icons/type.svg", ISLIcons::class.java)
    
    @JvmField
    val ENUM: Icon = IconLoader.getIcon("/icons/enum.svg", ISLIcons::class.java)
    
    @JvmField
    val FIELD: Icon = IconLoader.getIcon("/icons/field.svg", ISLIcons::class.java)
    
    @JvmField
    val ANNOTATION: Icon = IconLoader.getIcon("/icons/annotation.svg", ISLIcons::class.java)
    
    @JvmField
    val INVARIANT: Icon = IconLoader.getIcon("/icons/invariant.svg", ISLIcons::class.java)
    
    @JvmField
    val ERROR: Icon = IconLoader.getIcon("/icons/error.svg", ISLIcons::class.java)
    
    @JvmField
    val SUCCESS: Icon = IconLoader.getIcon("/icons/success.svg", ISLIcons::class.java)
    
    @JvmField
    val WARNING: Icon = IconLoader.getIcon("/icons/warning.svg", ISLIcons::class.java)
}
