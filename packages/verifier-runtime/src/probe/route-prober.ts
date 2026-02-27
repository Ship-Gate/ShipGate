/**
 * Route Prober
 *
 * Playwright-based (and fetch-based) endpoint probing. Discovers routes
 * from the Truthpack route index, hits them with safe methods, and collects
 * response metadata for claim generation.
 *
 * Two modes:
 *   1. **fetch mode** (default) — uses native fetch for API routes.
 *   2. **browser mode** — uses Playwright for UI routes to detect
 *      fake-success patterns in rendered DOM.
 */

import type {
  TruthpackRoute,
  RouteProbeResult,
  ProbeStatus,
} from './types.js';

// ── Public API ─────────────────────────────────────────────────────────────

export interface ProbeRoutesOptions {
  baseUrl: string;
  timeoutMs: number;
  concurrency: number;
  headers: Record<string, string>;
  authToken?: string;
  skipAuthRoutes: boolean;
  browserProbe: boolean;
  verbose: boolean;
}

/**
 * Probe a batch of routes and return results.
 */
export async function probeRoutes(
  routes: TruthpackRoute[],
  options: ProbeRoutesOptions,
): Promise<RouteProbeResult[]> {
  const results: RouteProbeResult[] = [];
  const batches = chunk(routes, options.concurrency);

  for (const batch of batches) {
    const batchResults = await Promise.all(
      batch.map((route) => probeSingleRoute(route, options)),
    );
    results.push(...batchResults);
  }

  return results;
}

/**
 * Probe a single route via fetch.
 */
export async function probeSingleRoute(
  route: TruthpackRoute,
  options: ProbeRoutesOptions,
): Promise<RouteProbeResult> {
  // Skip auth routes if configured
  if (options.skipAuthRoutes && route.auth?.required && !options.authToken) {
    return {
      route,
      status: 'skip',
      fakeSuccessDetected: false,
      fakeSuccessSignals: [],
      error: 'Auth required but no token provided; skipped',
    };
  }

  // Only probe with safe methods
  const method = toSafeMethod(route.method);
  const url = buildUrl(options.baseUrl, route.path);

  const headers: Record<string, string> = {
    'User-Agent': 'ShipGate-Runtime-Verifier/1.0',
    Accept: 'application/json, text/html, */*',
    ...options.headers,
  };

  if (options.authToken && route.auth?.required) {
    headers['Authorization'] = `Bearer ${options.authToken}`;
  }

  const startTime = performance.now();

  try {
    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      options.timeoutMs,
    );

    const response = await fetch(url, {
      method,
      headers,
      signal: controller.signal,
      redirect: 'follow',
    });

    clearTimeout(timeout);

    const responseTimeMs = performance.now() - startTime;
    const contentType = response.headers.get('content-type') ?? '';
    const bodyText = await safeReadBody(response);
    const bodySnippet = bodyText.slice(0, 500);

    // Detect fake success patterns in the response
    const fakeSignals = detectFakeSuccessInResponse(
      response.status,
      contentType,
      bodyText,
    );

    const status = classifyProbeStatus(
      response.status,
      route,
      fakeSignals.length > 0,
    );

    if (options.verbose) {
      process.stderr.write(
        `  [probe] ${method} ${route.path} -> ${response.status} (${responseTimeMs.toFixed(0)}ms) ${status}\n`,
      );
    }

    return {
      route,
      status,
      httpStatus: response.status,
      responseTimeMs,
      contentType,
      bodySnippet,
      fakeSuccessDetected: fakeSignals.length > 0,
      fakeSuccessSignals: fakeSignals,
    };
  } catch (err) {
    const responseTimeMs = performance.now() - startTime;
    const message = err instanceof Error ? err.message : String(err);

    if (options.verbose) {
      process.stderr.write(
        `  [probe] ${method} ${route.path} -> ERROR: ${message}\n`,
      );
    }

    return {
      route,
      status: 'fail',
      responseTimeMs,
      fakeSuccessDetected: false,
      fakeSuccessSignals: [],
      error: message,
    };
  }
}

/**
 * Probe UI routes using Playwright (optional — requires playwright installed).
 */
export async function probeBrowserRoute(
  route: TruthpackRoute,
  options: ProbeRoutesOptions,
): Promise<RouteProbeResult> {
  try {
    // Dynamic import so Playwright is optional
    const pw = await import('playwright');
    const browser = await pw.chromium.launch({ headless: true });

    try {
      const context = await browser.newContext({
        userAgent: 'ShipGate-Runtime-Verifier/1.0',
        extraHTTPHeaders: options.headers,
      });
      const page = await context.newPage();
      const url = buildUrl(options.baseUrl, route.path);

      const startTime = performance.now();
      const response = await page.goto(url, {
        timeout: options.timeoutMs,
        waitUntil: 'networkidle',
      });
      const responseTimeMs = performance.now() - startTime;

      const httpStatus = response?.status() ?? 0;
      const bodyText = await page.content();
      const bodySnippet = bodyText.slice(0, 500);

      // DOM-level fake-success detection
      const fakeSignals = await detectFakeSuccessInDOM(page);

      const status = classifyProbeStatus(
        httpStatus,
        route,
        fakeSignals.length > 0,
      );

      await browser.close();

      return {
        route,
        status,
        httpStatus,
        responseTimeMs,
        contentType: 'text/html',
        bodySnippet,
        fakeSuccessDetected: fakeSignals.length > 0,
        fakeSuccessSignals: fakeSignals,
      };
    } catch (innerErr) {
      await browser.close();
      throw innerErr;
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);

    // Graceful fallback when Playwright is not installed
    if (
      message.includes('Cannot find module') ||
      message.includes('MODULE_NOT_FOUND')
    ) {
      return {
        route,
        status: 'skip',
        fakeSuccessDetected: false,
        fakeSuccessSignals: [],
        error: 'Playwright not installed; browser probing skipped',
      };
    }

    return {
      route,
      status: 'fail',
      fakeSuccessDetected: false,
      fakeSuccessSignals: [],
      error: message,
    };
  }
}

// ── Fake-Success Detection ─────────────────────────────────────────────────

/**
 * Detect fake-success patterns in HTTP response bodies.
 *
 * These are indicators that the server returns 200 OK but the feature
 * is stubbed, mocked, or otherwise non-functional.
 */
function detectFakeSuccessInResponse(
  httpStatus: number,
  contentType: string,
  body: string,
): string[] {
  const signals: string[] = [];

  if (httpStatus < 200 || httpStatus >= 300) return signals;

  const lowerBody = body.toLowerCase();

  // Empty or trivial JSON body
  if (
    contentType.includes('application/json') &&
    (body.trim() === '{}' || body.trim() === '[]' || body.trim() === 'null')
  ) {
    signals.push('empty_json_body');
  }

  // "Not implemented" / TODO patterns
  const stubPatterns = [
    'not implemented',
    'todo',
    'coming soon',
    'placeholder',
    'mock',
    'stub',
    'fake',
    'dummy',
    'sample data',
    'lorem ipsum',
    'example.com',
    'test@test',
  ];
  for (const pattern of stubPatterns) {
    if (lowerBody.includes(pattern)) {
      signals.push(`stub_pattern:${pattern}`);
    }
  }

  // Hardcoded success with no real data
  if (lowerBody.includes('"success":true') || lowerBody.includes('"ok":true')) {
    try {
      const parsed = JSON.parse(body);
      const keys = Object.keys(parsed);
      if (keys.length <= 2 && (keys.includes('success') || keys.includes('ok'))) {
        signals.push('success_flag_only');
      }
    } catch {
      // Not valid JSON, skip
    }
  }

  // HTML pages that return 200 but show error content
  if (contentType.includes('text/html')) {
    const errorPatterns = [
      'page not found',
      '404',
      'error occurred',
      'something went wrong',
      'under construction',
      'maintenance mode',
    ];
    for (const pattern of errorPatterns) {
      if (lowerBody.includes(pattern)) {
        signals.push(`html_error_content:${pattern}`);
      }
    }
  }

  return signals;
}

/**
 * Detect fake-success patterns in a Playwright page DOM.
 */
async function detectFakeSuccessInDOM(
  page: { evaluate: (fn: () => unknown) => Promise<unknown> },
): Promise<string[]> {
  try {
    const signals = (await page.evaluate(() => {
      const found: string[] = [];
      const body = document.body?.innerText?.toLowerCase() ?? '';

      // Check for spinner/loading states still visible
      const spinners = document.querySelectorAll(
        '[class*="spinner"], [class*="loading"], [class*="skeleton"]',
      );
      if (spinners.length > 0) {
        found.push('loading_state_visible');
      }

      // Check for "coming soon" / placeholder text
      if (body.includes('coming soon') || body.includes('under construction')) {
        found.push('placeholder_content');
      }

      // Check for empty data tables
      const tables = document.querySelectorAll('table tbody');
      for (const tbody of tables) {
        if (tbody.children.length === 0) {
          found.push('empty_data_table');
        }
      }

      // Check for error boundaries
      const errorBoundaries = document.querySelectorAll(
        '[class*="error"], [class*="Error"], [role="alert"]',
      );
      if (errorBoundaries.length > 0) {
        found.push('error_boundary_visible');
      }

      return found;
    })) as string[];

    return signals;
  } catch {
    return [];
  }
}

// ── Helpers ────────────────────────────────────────────────────────────────

function toSafeMethod(method: string): string {
  const upper = method.toUpperCase();
  switch (upper) {
    case 'POST':
    case 'PUT':
    case 'PATCH':
    case 'DELETE':
      return 'OPTIONS';
    default:
      return upper;
  }
}

function buildUrl(baseUrl: string, routePath: string): string {
  const base = baseUrl.replace(/\/+$/, '');
  const p = routePath.startsWith('/') ? routePath : `/${routePath}`;
  return `${base}${p}`;
}

function classifyProbeStatus(
  httpStatus: number,
  route: TruthpackRoute,
  hasFakeSignals: boolean,
): ProbeStatus {
  if (hasFakeSignals) return 'warn';
  if (httpStatus >= 200 && httpStatus < 400) return 'pass';
  if (httpStatus === 401 || httpStatus === 403) {
    return route.auth?.required ? 'pass' : 'warn';
  }
  if (httpStatus === 404) return 'fail';
  if (httpStatus === 405) return 'pass'; // Method not allowed is OK for OPTIONS probe
  if (httpStatus >= 500) return 'fail';
  return 'warn';
}

async function safeReadBody(response: Response): Promise<string> {
  try {
    return await response.text();
  } catch {
    return '';
  }
}

function chunk<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}
