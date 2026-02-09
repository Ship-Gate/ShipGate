/**
 * Tests for Environment Variable Filter
 */

import { describe, it, expect } from 'vitest';
import { EnvFilter, createEnvFilter } from './env-filter.js';

describe('EnvFilter', () => {
  it('should filter environment variables based on allowlist', () => {
    const filter = createEnvFilter({
      allowedEnvVars: ['PATH', 'HOME'],
    });
    
    const env = {
      PATH: '/usr/bin',
      HOME: '/home/user',
      SECRET_KEY: 'secret123',
      API_KEY: 'key123',
    };
    
    const filtered = filter.filter(env);
    expect(filtered.PATH).toBe('/usr/bin');
    expect(filtered.HOME).toBe('/home/user');
    expect(filtered.SECRET_KEY).toBeUndefined();
    expect(filtered.API_KEY).toBeUndefined();
  });

  it('should mask disallowed env vars when maskDisallowed is true', () => {
    const filter = createEnvFilter({
      allowedEnvVars: ['PATH'],
      maskDisallowed: true,
    });
    
    const env = {
      PATH: '/usr/bin',
      SECRET_KEY: 'secret123',
    };
    
    const filtered = filter.filter(env);
    expect(filtered.PATH).toBe('/usr/bin');
    expect(filtered.SECRET_KEY).toBe('***');
  });

  it('should check if env var is allowed', () => {
    const filter = createEnvFilter({
      allowedEnvVars: ['PATH', 'HOME'],
    });
    
    expect(filter.isAllowed('PATH')).toBe(true);
    expect(filter.isAllowed('HOME')).toBe(true);
    expect(filter.isAllowed('SECRET_KEY')).toBe(false);
  });

  it('should allow adding env vars to allowlist', () => {
    const filter = createEnvFilter({
      allowedEnvVars: ['PATH'],
    });
    
    filter.addAllowed('CUSTOM_VAR');
    expect(filter.isAllowed('CUSTOM_VAR')).toBe(true);
  });

  it('should allow removing env vars from allowlist', () => {
    const filter = createEnvFilter({
      allowedEnvVars: ['PATH', 'HOME'],
    });
    
    filter.removeAllowed('HOME');
    expect(filter.isAllowed('HOME')).toBe(false);
    expect(filter.isAllowed('PATH')).toBe(true);
  });

  it('should return all allowed env vars', () => {
    const filter = createEnvFilter({
      allowedEnvVars: ['PATH', 'HOME', 'USER'],
    });
    
    const allowed = filter.getAllowed();
    expect(allowed).toContain('PATH');
    expect(allowed).toContain('HOME');
    expect(allowed).toContain('USER');
  });
});
