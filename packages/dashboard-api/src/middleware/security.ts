import type { Request, Response, NextFunction } from 'express';

/**
 * Security headers middleware
 * Sets CSP, HSTS, X-Frame-Options, and other security headers
 */
export function securityHeaders(req: Request, res: Response, next: NextFunction): void {
  // Content Security Policy
  const cspDirectives = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval'", // Adjust based on your needs
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: https:",
    "font-src 'self' data:",
    "connect-src 'self'",
    "frame-ancestors 'none'",
  ].join('; ');

  res.setHeader('Content-Security-Policy', cspDirectives);

  // HTTP Strict Transport Security (HSTS)
  // Only set in production with HTTPS
  if (process.env['NODE_ENV'] === 'production') {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
  }

  // Prevent clickjacking
  res.setHeader('X-Frame-Options', 'DENY');

  // Prevent MIME type sniffing
  res.setHeader('X-Content-Type-Options', 'nosniff');

  // Enable XSS protection (legacy, but still useful)
  res.setHeader('X-XSS-Protection', '1; mode=block');

  // Referrer Policy
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

  // Permissions Policy (formerly Feature-Policy)
  res.setHeader(
    'Permissions-Policy',
    'geolocation=(), microphone=(), camera=(), payment=(), usb=(), magnetometer=(), gyroscope=()',
  );

  // Remove X-Powered-By header
  res.removeHeader('X-Powered-By');

  next();
}
