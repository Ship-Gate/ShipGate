/**
 * Auth Detector
 * 
 * Detects authentication patterns and libraries in the workspace.
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import type { AuthApproach, Confidence } from '../contextTypes.js';

export interface AuthDetection {
  approach: AuthApproach;
  confidence: Confidence;
  source: string;
}

/**
 * Auth library detection patterns
 */
const AUTH_PATTERNS: Record<AuthApproach, { packages: string[]; configs: string[]; patterns: RegExp[] }> = {
  nextauth: {
    packages: ['next-auth', '@auth/core'],
    configs: [],
    patterns: [/NextAuth|getServerSession|useSession/],
  },
  clerk: {
    packages: ['@clerk/nextjs', '@clerk/clerk-sdk-node'],
    configs: [],
    patterns: [/ClerkProvider|useAuth|currentUser/],
  },
  auth0: {
    packages: ['@auth0/nextjs-auth0', 'auth0'],
    configs: [],
    patterns: [/Auth0Provider|useUser/],
  },
  supabase: {
    packages: ['@supabase/supabase-js', '@supabase/auth-helpers-nextjs'],
    configs: [],
    patterns: [/createClient.*supabase|supabase\.auth/],
  },
  firebase: {
    packages: ['firebase', 'firebase-admin'],
    configs: ['firebase.json', '.firebaserc'],
    patterns: [/firebase\.auth|getAuth|signInWith/],
  },
  passport: {
    packages: ['passport'],
    configs: [],
    patterns: [/passport\.use|passport\.authenticate/],
  },
  lucia: {
    packages: ['lucia', 'lucia-auth'],
    configs: [],
    patterns: [/Lucia|validateSession/],
  },
  jwt: {
    packages: ['jsonwebtoken', 'jose'],
    configs: [],
    patterns: [/jwt\.sign|jwt\.verify|SignJWT/],
  },
  session: {
    packages: ['express-session', 'cookie-session'],
    configs: [],
    patterns: [/session\(\s*\{|req\.session/],
  },
  oauth: {
    packages: ['passport-oauth2', 'simple-oauth2', 'oauth'],
    configs: [],
    patterns: [/OAuth2|oauth2Client|getAccessToken/],
  },
  unknown: {
    packages: [],
    configs: [],
    patterns: [],
  },
};

/**
 * Detects authentication approaches in the workspace
 */
export async function detectAuth(workspacePath: string): Promise<AuthDetection[]> {
  const detected: AuthDetection[] = [];

  // Check package.json
  try {
    const packageJsonPath = path.join(workspacePath, 'package.json');
    const packageJsonContent = await fs.readFile(packageJsonPath, 'utf-8');
    const packageJson = JSON.parse(packageJsonContent);
    
    const allDeps = {
      ...packageJson.dependencies,
      ...packageJson.devDependencies,
    };

    for (const [approach, patterns] of Object.entries(AUTH_PATTERNS)) {
      if (approach === 'unknown') continue;

      for (const pkg of patterns.packages) {
        if (allDeps[pkg]) {
          detected.push({
            approach: approach as AuthApproach,
            confidence: 'high',
            source: `package.json (${pkg})`,
          });
          break;
        }
      }
    }
  } catch {
    // No package.json
  }

  // Check for config files
  for (const [approach, patterns] of Object.entries(AUTH_PATTERNS)) {
    if (approach === 'unknown') continue;

    for (const config of patterns.configs) {
      try {
        await fs.access(path.join(workspacePath, config));
        if (!detected.some(d => d.approach === approach)) {
          detected.push({
            approach: approach as AuthApproach,
            confidence: 'high',
            source: config,
          });
        }
        break;
      } catch {
        // Config not found
      }
    }
  }

  return detected;
}

/**
 * Scans files for auth-related patterns
 * This is more expensive and should be used selectively
 */
export async function scanForAuthPatterns(
  workspacePath: string,
  filePaths: string[]
): Promise<AuthDetection[]> {
  const detected: AuthDetection[] = [];
  const seenApproaches = new Set<AuthApproach>();

  for (const filePath of filePaths) {
    try {
      const content = await fs.readFile(path.join(workspacePath, filePath), 'utf-8');
      
      for (const [approach, patterns] of Object.entries(AUTH_PATTERNS)) {
        if (approach === 'unknown' || seenApproaches.has(approach as AuthApproach)) continue;

        for (const pattern of patterns.patterns) {
          if (pattern.test(content)) {
            detected.push({
              approach: approach as AuthApproach,
              confidence: 'medium',
              source: `Pattern in ${filePath}`,
            });
            seenApproaches.add(approach as AuthApproach);
            break;
          }
        }
      }
    } catch {
      // File not readable
    }
  }

  return detected;
}
