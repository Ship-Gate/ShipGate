/**
 * Webhook Detector V2
 *
 * Detection of webhook handlers and related security patterns.
 */

import type {
  DetectorResult,
  DetectedCandidate,
  RiskFlag,
  FrameworkHint,
  AuditOptionsV2,
} from '../types.js';

/**
 * Webhook patterns to detect
 */
const WEBHOOK_PATTERNS = {
  // Stripe webhooks
  stripe: {
    pattern: /(?:stripe\.webhooks\.constructEvent|Stripe\.Webhook|webhook.*stripe|stripe.*webhook)/gi,
    confidence: 0.95,
    provider: 'stripe',
  },
  // Generic webhook handlers
  webhookHandler: {
    pattern: /(?:webhook[_-]?handler|handleWebhook|processWebhook|onWebhook)/gi,
    confidence: 0.85,
    provider: 'generic',
  },
  // Webhook routes (by path)
  webhookRoute: {
    pattern: /['"`]\/(?:api\/)?webhooks?(?:\/\w+)?['"`]/gi,
    confidence: 0.8,
    provider: 'generic',
  },
  // GitHub webhooks
  github: {
    pattern: /(?:github.*webhook|webhook.*github|x-hub-signature|x-github-event)/gi,
    confidence: 0.9,
    provider: 'github',
  },
  // Slack webhooks
  slack: {
    pattern: /(?:slack.*webhook|webhook.*slack|slack-signature|x-slack-signature)/gi,
    confidence: 0.9,
    provider: 'slack',
  },
  // Twilio webhooks
  twilio: {
    pattern: /(?:twilio.*webhook|webhook.*twilio|validateRequest|x-twilio-signature)/gi,
    confidence: 0.9,
    provider: 'twilio',
  },
  // SendGrid webhooks
  sendgrid: {
    pattern: /(?:sendgrid.*webhook|webhook.*sendgrid|EventWebhook)/gi,
    confidence: 0.9,
    provider: 'sendgrid',
  },
  // Clerk webhooks
  clerk: {
    pattern: /(?:clerk.*webhook|webhook.*clerk|svix|Webhook\.verify)/gi,
    confidence: 0.9,
    provider: 'clerk',
  },
};

/**
 * Signature verification patterns
 */
const SIGNATURE_PATTERNS = [
  /constructEvent/i,
  /verifySignature/i,
  /validateSignature/i,
  /x-hub-signature/i,
  /x-slack-signature/i,
  /x-twilio-signature/i,
  /svix/i,
  /Webhook\.verify/i,
  /crypto\.timingSafeEqual/i,
  /hmac/i,
];

/**
 * Detect webhooks in file content
 */
export function detectWebhooks(
  content: string,
  filePath: string,
  options: AuditOptionsV2
): DetectorResult {
  const candidates: DetectedCandidate[] = [];
  const riskFlags: RiskFlag[] = [];
  const frameworkHints: FrameworkHint[] = [];
  const lines = content.split('\n');

  // Track detected lines to avoid duplicates
  const detectedLines: Set<number> = new Set();

  for (const [patternName, patternConfig] of Object.entries(WEBHOOK_PATTERNS)) {
    const { pattern, confidence, provider } = patternConfig;
    pattern.lastIndex = 0;

    let match: RegExpExecArray | null;
    while ((match = pattern.exec(content)) !== null) {
      const line = getLineNumber(content, match.index);

      // Skip if confidence below threshold or already detected
      if (confidence < (options.minConfidence ?? 0.4)) continue;
      if (detectedLines.has(line)) continue;

      detectedLines.add(line);

      const candidate: DetectedCandidate = {
        id: `webhook-${filePath.replace(/[^a-zA-Z0-9]/g, '-')}-${line}`,
        category: 'webhook',
        name: `Webhook: ${provider}`,
        filePath,
        line,
        endLine: findHandlerEnd(lines, line - 1),
        snippet: options.includeSnippets
          ? extractSnippet(lines, line - 1, options.maxSnippetLines ?? 10)
          : undefined,
        confidence,
        functionName: extractFunctionName(lines, line - 1),
        metadata: {
          provider,
          patternType: patternName,
          matchedText: match[0],
        },
      };

      candidates.push(candidate);

      // Check for webhook-related risks
      const contextContent = extractContext(lines, line - 1, 40);
      const webhookRisks = detectWebhookRisks(
        contextContent,
        candidate,
        filePath,
        line,
        provider
      );
      riskFlags.push(...webhookRisks);
    }
  }

  return {
    candidates,
    riskFlags,
    frameworkHints,
  };
}

/**
 * Detect webhook-related risk flags
 */
function detectWebhookRisks(
  contextContent: string,
  candidate: DetectedCandidate,
  filePath: string,
  line: number,
  provider: string
): RiskFlag[] {
  const risks: RiskFlag[] = [];

  // Check for missing signature verification
  const hasSignatureCheck = SIGNATURE_PATTERNS.some(p => p.test(contextContent));

  if (!hasSignatureCheck) {
    risks.push({
      id: `risk-webhook-no-signature-${candidate.id}`,
      category: 'webhook-without-signature',
      severity: 'critical',
      description: `Webhook handler ${candidate.name} has no visible signature verification`,
      filePath,
      line,
      suggestion: `Add signature verification for ${provider} webhooks to prevent spoofed requests`,
      relatedCandidates: [candidate.id],
    });
  }

  // Check for missing idempotency handling
  const hasIdempotency =
    /(?:idempotent|idempotency|processedEvents|eventId|dedup)/i.test(contextContent);

  if (!hasIdempotency && provider !== 'generic') {
    risks.push({
      id: `risk-webhook-no-idempotency-${candidate.id}`,
      category: 'other',
      severity: 'info',
      description: `Webhook handler ${candidate.name} may not handle duplicate events`,
      filePath,
      line,
      suggestion: 'Consider tracking processed event IDs to handle webhook retries safely',
      relatedCandidates: [candidate.id],
    });
  }

  return risks;
}

/**
 * Get line number from character index
 */
function getLineNumber(content: string, index: number): number {
  return content.substring(0, index).split('\n').length;
}

/**
 * Find end of webhook handler
 */
function findHandlerEnd(lines: string[], startLineIndex: number): number {
  let braceCount = 0;
  let foundStart = false;

  for (let i = startLineIndex; i < Math.min(lines.length, startLineIndex + 100); i++) {
    const line = lines[i] || '';
    for (const char of line) {
      if (char === '{') {
        braceCount++;
        foundStart = true;
      } else if (char === '}') {
        braceCount--;
        if (foundStart && braceCount === 0) {
          return i + 1;
        }
      }
    }
  }

  return Math.min(startLineIndex + 50, lines.length);
}

/**
 * Extract function name near a line
 */
function extractFunctionName(lines: string[], lineIndex: number): string | undefined {
  for (let i = lineIndex; i >= Math.max(0, lineIndex - 10); i--) {
    const line = lines[i] || '';
    const match = line.match(/(?:function|const|let|async function|async)\s+(\w+)/);
    if (match) {
      return match[1];
    }
    const methodMatch = line.match(/^\s*(?:async\s+)?(\w+)\s*\([^)]*\)\s*(?::\s*\w+)?\s*\{?$/);
    if (methodMatch && !['if', 'for', 'while', 'switch'].includes(methodMatch[1] || '')) {
      return methodMatch[1];
    }
  }
  return undefined;
}

/**
 * Extract code snippet
 */
function extractSnippet(
  lines: string[],
  startLineIndex: number,
  maxLines: number
): string {
  const endIndex = Math.min(startLineIndex + maxLines, lines.length);
  return lines.slice(startLineIndex, endIndex).join('\n');
}

/**
 * Extract context around a line
 */
function extractContext(
  lines: string[],
  lineIndex: number,
  contextSize: number
): string {
  const start = Math.max(0, lineIndex - 5);
  const end = Math.min(lines.length, lineIndex + contextSize);
  return lines.slice(start, end).join('\n');
}

/**
 * Check if a file is likely to contain webhook handlers
 */
export function isWebhookFile(filePath: string): boolean {
  const webhookPatterns = [/webhook/i, /hook/i, /callback/i, /event/i];

  return webhookPatterns.some(p => p.test(filePath));
}
