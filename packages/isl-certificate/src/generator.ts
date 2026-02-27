/**
 * ISL Certificate Generator
 *
 * Generates trust artifacts at the end of pipeline runs.
 */

import { randomUUID } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { ISLCertificate, CertificateInput } from './types.js';
import { sha256, hmacSha256, getSignableContent } from './hash.js';

const PROMPT_PREVIEW_LENGTH = 100;

/** Hash file content (reads from disk if content not provided) */
async function hashFile(
  projectRoot: string,
  filePath: string,
  content?: string
): Promise<string> {
  if (content !== undefined) {
    return sha256(content);
  }
  const fullPath = join(projectRoot, filePath);
  const data = await readFile(fullPath, 'utf-8');
  return sha256(data);
}

/**
 * Generate ISL Certificate from pipeline result
 *
 * @param input - Certificate input data from pipeline
 * @param options - Generation options
 * @returns The signed certificate
 */
export async function generateCertificate(
  input: CertificateInput,
  options: {
    projectRoot: string;
    apiKey?: string;
  }
): Promise<ISLCertificate> {
  const promptHash = sha256(input.prompt);
  const promptPreview =
    input.prompt.length > PROMPT_PREVIEW_LENGTH
      ? input.prompt.slice(0, PROMPT_PREVIEW_LENGTH) + '...'
      : input.prompt;

  const islSpecHash = sha256(input.islSpec.content);

  const generatedFiles = await Promise.all(
    input.generatedFiles.map(async (f) => ({
      path: f.path,
      hash: await hashFile(options.projectRoot, f.path, f.content),
      tier: f.tier,
      specCoverage: f.specCoverage,
    }))
  );

  const certWithoutSig: Omit<ISLCertificate, 'signature'> = {
    version: '1.0',
    id: randomUUID(),
    timestamp: new Date().toISOString(),
    prompt: { hash: promptHash, preview: promptPreview },
    islSpec: {
      hash: islSpecHash,
      version: input.islSpec.version,
      constructCount: input.islSpec.constructCount,
    },
    generatedFiles,
    verification: {
      verdict: input.verification.verdict,
      trustScore: input.verification.trustScore,
      evidenceCount: input.verification.evidenceCount,
      testsRun: input.verification.testsRun,
      testsPassed: input.verification.testsPassed,
      securityChecks: input.verification.securityChecks ?? [],
    },
    model: input.model,
    pipeline: input.pipeline,
  };

  const signable = getSignableContent(certWithoutSig as unknown as Record<string, unknown>);
  const secret = options.apiKey ?? process.env['ISL_API_KEY'] ?? process.env['SHIPGATE_API_KEY'] ?? 'no-key';
  const signature = hmacSha256(signable, secret);

  return { ...certWithoutSig, signature };
}

/** Default certificate filename in project root */
export const CERTIFICATE_FILENAME = '.isl-certificate.json';

/**
 * Generate and save certificate to project root
 *
 * @returns Path to saved certificate
 */
export async function generateAndSaveCertificate(
  input: CertificateInput,
  options: {
    projectRoot: string;
    apiKey?: string;
    outputPath?: string;
  }
): Promise<{ certificate: ISLCertificate; path: string }> {
  const certificate = await generateCertificate(input, options);
  const outputPath = options.outputPath ?? join(options.projectRoot, CERTIFICATE_FILENAME);
  await writeFile(outputPath, JSON.stringify(certificate, null, 2), 'utf-8');
  return { certificate, path: outputPath };
}
