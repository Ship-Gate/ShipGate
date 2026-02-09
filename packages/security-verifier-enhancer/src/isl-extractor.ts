/**
 * ISL Auth Requirement Extractor
 * Extracts authentication and authorization requirements from ISL files
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import type { ISLAuthRequirement } from './types.js';

/**
 * Extract auth requirements from ISL file content
 */
export async function extractISLAuthRequirements(
  filePath: string,
  content: string
): Promise<ISLAuthRequirement[]> {
  const requirements: ISLAuthRequirement[] = [];
  const lines = content.split('\n');

  // Pattern 1: security { requires auth }
  const securityRequiresPattern = /security\s*\{[^}]*requires\s+(auth|role|permission)[^}]*\}/gis;
  let match: RegExpExecArray | null;
  
  while ((match = securityRequiresPattern.exec(content)) !== null) {
    const line = getLineNumber(content, match.index);
    const securityBlock = match[0];
    
    // Extract behavior name (look backwards for behavior declaration)
    const behaviorName = extractBehaviorName(content, match.index);
    
    // Parse requires clause
    const requiresMatch = securityBlock.match(/requires\s+(auth|role|permission)\s*([^}]*)/i);
    if (requiresMatch) {
      const reqType = requiresMatch[1]?.toLowerCase();
      const reqDetails = requiresMatch[2] || '';
      
      if (reqType === 'auth') {
        requirements.push({
          behaviorName: behaviorName || 'unknown',
          requirementType: 'auth',
          islFilePath: filePath,
          line,
          confidence: 0.9,
        });
      } else if (reqType === 'role') {
        // Extract roles: requires role ADMIN, EDITOR
        const roles = extractRoles(reqDetails);
        requirements.push({
          behaviorName: behaviorName || 'unknown',
          requirementType: 'role',
          requiredRoles: roles,
          islFilePath: filePath,
          line,
          confidence: 0.85,
        });
      } else if (reqType === 'permission') {
        // Extract permissions: requires permission read:users, write:users
        const permissions = extractPermissions(reqDetails);
        requirements.push({
          behaviorName: behaviorName || 'unknown',
          requirementType: 'permission',
          requiredPermissions: permissions,
          islFilePath: filePath,
          line,
          confidence: 0.85,
        });
      }
    }
  }

  // Pattern 2: preconditions with auth checks
  // pre { User.exists(actor_id) && User.lookup(actor_id).role == ADMIN }
  const preconditionsPattern = /pre\s*\{[^}]*\}/gis;
  while ((match = preconditionsPattern.exec(content)) !== null) {
    const line = getLineNumber(content, match.index);
    const preBlock = match[0];
    
    // Check for role checks in preconditions
    const roleCheckMatch = preBlock.match(/\.role\s*(?:==|in|>=|>)\s*(\w+)/i);
    if (roleCheckMatch) {
      const behaviorName = extractBehaviorName(content, match.index);
      const role = roleCheckMatch[1];
      
      // Check if this is already captured in security block
      const alreadyCaptured = requirements.some(
        r => r.behaviorName === behaviorName && r.line === line
      );
      
      if (!alreadyCaptured) {
        requirements.push({
          behaviorName: behaviorName || 'unknown',
          requirementType: 'role',
          requiredRoles: [role],
          islFilePath: filePath,
          line,
          confidence: 0.7, // Lower confidence for implicit role checks
        });
      }
    }
  }

  // Pattern 3: Check for public endpoints (no security block, no auth in pre)
  // If a behavior has no security requirements, mark as public
  const behaviorPattern = /behavior\s+(\w+)\s*\{[^}]*\}/gis;
  const behaviors = new Set<string>();
  while ((match = behaviorPattern.exec(content)) !== null) {
    behaviors.add(match[1]!);
  }

  // Mark behaviors without auth requirements as public
  for (const behaviorName of behaviors) {
    const hasAuthRequirement = requirements.some(r => r.behaviorName === behaviorName);
    if (!hasAuthRequirement) {
      const behaviorLine = findBehaviorLine(content, behaviorName);
      requirements.push({
        behaviorName,
        requirementType: 'public',
        islFilePath: filePath,
        line: behaviorLine,
        confidence: 0.6, // Lower confidence - might be missing spec
      });
    }
  }

  return requirements;
}

/**
 * Extract behavior name from content before a given index
 */
function extractBehaviorName(content: string, index: number): string | null {
  const beforeIndex = content.substring(0, index);
  const behaviorMatch = beforeIndex.match(/behavior\s+(\w+)/g);
  if (behaviorMatch && behaviorMatch.length > 0) {
    const lastMatch = behaviorMatch[behaviorMatch.length - 1];
    const nameMatch = lastMatch.match(/behavior\s+(\w+)/);
    return nameMatch?.[1] || null;
  }
  return null;
}

/**
 * Extract roles from requires clause
 */
function extractRoles(details: string): string[] {
  // Match: ADMIN, EDITOR, SUPER_ADMIN
  const roleMatches = details.match(/\b([A-Z_]+)\b/g);
  return roleMatches || [];
}

/**
 * Extract permissions from requires clause
 */
function extractPermissions(details: string): string[] {
  // Match: read:users, write:users, admin:*
  const permMatches = details.match(/(\w+:\w+|\w+:\*)/g);
  return permMatches || [];
}

/**
 * Find line number for a behavior
 */
function findBehaviorLine(content: string, behaviorName: string): number {
  const pattern = new RegExp(`behavior\\s+${behaviorName}\\s*\\{`, 'i');
  const match = content.match(pattern);
  if (match && match.index !== undefined) {
    return getLineNumber(content, match.index);
  }
  return 1;
}

/**
 * Get line number from character index
 */
function getLineNumber(content: string, index: number): number {
  return content.substring(0, index).split('\n').length;
}

/**
 * Extract auth requirements from ISL files in a directory
 */
export async function extractAllISLAuthRequirements(
  workspaceRoot: string,
  islFiles?: string[]
): Promise<ISLAuthRequirement[]> {
  const allRequirements: ISLAuthRequirement[] = [];

  if (islFiles && islFiles.length > 0) {
    // Use provided ISL files
    for (const filePath of islFiles) {
      try {
        const content = await fs.readFile(filePath, 'utf-8');
        const requirements = await extractISLAuthRequirements(filePath, content);
        allRequirements.push(...requirements);
      } catch (error) {
        // Skip files that can't be read
        console.warn(`Could not read ISL file: ${filePath}`, error);
      }
    }
  } else {
    // Find all ISL files
    const islFilesFound = await findISLFiles(workspaceRoot);
    for (const filePath of islFilesFound) {
      try {
        const content = await fs.readFile(filePath, 'utf-8');
        const requirements = await extractISLAuthRequirements(filePath, content);
        allRequirements.push(...requirements);
      } catch (error) {
        // Skip files that can't be read
        console.warn(`Could not read ISL file: ${filePath}`, error);
      }
    }
  }

  return allRequirements;
}

/**
 * Find all ISL files in workspace
 */
async function findISLFiles(root: string): Promise<string[]> {
  const files: string[] = [];
  const ignoreDirs = ['node_modules', '.git', 'dist', 'build', '.next'];

  async function walkDir(dir: string): Promise<void> {
    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        
        if (entry.isDirectory()) {
          if (!ignoreDirs.includes(entry.name)) {
            await walkDir(fullPath);
          }
        } else if (entry.isFile() && entry.name.endsWith('.isl')) {
          files.push(fullPath);
        }
      }
    } catch (error) {
      // Skip directories that can't be read
    }
  }

  await walkDir(root);
  return files;
}
