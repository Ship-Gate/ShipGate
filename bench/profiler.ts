/**
 * Node.js CPU Profiling Hooks
 * 
 * Provides on-demand CPU profiling capabilities for performance analysis.
 * 
 * Usage:
 *   import { startProfiling, stopProfiling } from './bench/profiler';
 *   
 *   startProfiling('my-profile');
 *   // ... code to profile ...
 *   const profile = stopProfiling('my-profile');
 *   // Profile saved to .profiles/my-profile.cpuprofile
 */

import { writeFileSync, mkdirSync } from 'fs';
import { join, resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { Session } from 'inspector';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const PROFILES_DIR = join(ROOT, '.profiles');

// Ensure profiles directory exists
mkdirSync(PROFILES_DIR, { recursive: true });

interface ProfileSession {
  session: Session;
  name: string;
  startTime: number;
}

const activeProfiles = new Map<string, ProfileSession>();

/**
 * Start CPU profiling
 * @param name Profile name (will be saved as {name}.cpuprofile)
 */
export function startProfiling(name: string): void {
  if (activeProfiles.has(name)) {
    throw new Error(`Profile "${name}" is already active`);
  }
  
  try {
    const session = new Session();
    session.connect();
    
    session.post('Profiler.enable', () => {});
    session.post('Profiler.start', () => {});
    
    activeProfiles.set(name, {
      session,
      name,
      startTime: Date.now(),
    });
    
    console.log(`[Profiler] Started CPU profiling: ${name}`);
  } catch (error) {
    console.warn(`[Profiler] Failed to start profiling: ${error instanceof Error ? error.message : String(error)}`);
    // Profiling may not be available in all environments
  }
}

/**
 * Stop CPU profiling and save to file
 * @param name Profile name
 * @returns Path to saved profile file (async)
 */
export async function stopProfiling(name: string): Promise<string | null> {
  const profileSession = activeProfiles.get(name);
  if (!profileSession) {
    throw new Error(`No active profile found: ${name}`);
  }
  
  try {
    const { session } = profileSession;
    
    return new Promise<string | null>((resolve) => {
      session.post('Profiler.stop', (err: Error | null, params: { profile: unknown }) => {
        if (err) {
          console.error(`[Profiler] Failed to stop profiling: ${err.message}`);
          activeProfiles.delete(name);
          resolve(null);
          return;
        }
        
        const profilePath = join(PROFILES_DIR, `${name}.cpuprofile`);
        writeFileSync(profilePath, JSON.stringify(params.profile, null, 2));
        
        session.disconnect();
        activeProfiles.delete(name);
        
        const duration = Date.now() - profileSession.startTime;
        console.log(`[Profiler] Stopped CPU profiling: ${name} (${duration}ms)`);
        console.log(`[Profiler] Profile saved to: ${profilePath}`);
        
        resolve(profilePath);
      });
    });
  } catch (error) {
    console.error(`[Profiler] Error stopping profile: ${error instanceof Error ? error.message : String(error)}`);
    activeProfiles.delete(name);
    return null;
  }
}

/**
 * Stop all active profiles
 */
export async function stopAllProfiles(): Promise<void> {
  const names = Array.from(activeProfiles.keys());
  for (const name of names) {
    await stopProfiling(name);
  }
}

/**
 * Check if profiling is available
 */
export function isProfilingAvailable(): boolean {
  try {
    const session = new Session();
    session.connect();
    session.disconnect();
    return true;
  } catch {
    return false;
  }
}

/**
 * Profile a function execution
 */
export async function profileFunction<T>(
  name: string,
  fn: () => Promise<T> | T
): Promise<{ result: T; profilePath: string | null }> {
  const wasProfiling = isProfilingAvailable();
  
  if (wasProfiling) {
    startProfiling(name);
  }
  
  try {
    const result = await fn();
    const profilePath = wasProfiling ? await stopProfiling(name) : null;
    return { result, profilePath };
  } catch (error) {
    if (wasProfiling && activeProfiles.has(name)) {
      await stopProfiling(name);
    }
    throw error;
  }
}
