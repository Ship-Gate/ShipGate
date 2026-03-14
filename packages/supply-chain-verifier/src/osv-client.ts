export type Ecosystem = 'npm' | 'PyPI' | 'Go' | 'crates.io';

export interface PackageQuery {
  name: string;
  version: string;
  ecosystem: Ecosystem;
}

export interface OSVSeverity {
  type: string;
  score: string;
}

export interface OSVAffectedRange {
  type: string;
  events: Array<{ introduced?: string; fixed?: string; last_affected?: string }>;
}

export interface OSVAffectedPackage {
  package: { name: string; ecosystem: string; purl?: string };
  ranges?: OSVAffectedRange[];
  versions?: string[];
}

export interface OSVReference {
  type: string;
  url: string;
}

export interface OSVVulnerability {
  id: string;
  summary: string;
  details: string;
  aliases: string[];
  severity: OSVSeverity[];
  affected: OSVAffectedPackage[];
  references: OSVReference[];
}

interface OSVBatchQuery {
  queries: Array<{
    package: { name: string; version: string; ecosystem: string };
  }>;
}

interface OSVBatchResponseEntry {
  vulns?: OSVVulnerability[];
}

interface OSVBatchResponse {
  results: OSVBatchResponseEntry[];
}

const OSV_BATCH_ENDPOINT = 'https://api.osv.dev/v1/querybatch';
const MAX_BATCH_SIZE = 1000;
const MAX_RETRIES = 3;
const RETRY_BASE_DELAY_MS = 1000;

export class OSVClient {
  private readonly endpoint: string;

  constructor(endpoint?: string) {
    this.endpoint = endpoint ?? OSV_BATCH_ENDPOINT;
  }

  async queryBatch(packages: PackageQuery[]): Promise<OSVVulnerability[]> {
    if (packages.length === 0) return [];

    const chunks = this.chunkArray(packages, MAX_BATCH_SIZE);
    const allVulns: OSVVulnerability[] = [];
    const seenIds = new Set<string>();

    for (const chunk of chunks) {
      const vulns = await this.queryChunk(chunk);
      for (const v of vulns) {
        if (!seenIds.has(v.id)) {
          seenIds.add(v.id);
          allVulns.push(v);
        }
      }
    }

    return allVulns;
  }

  private async queryChunk(packages: PackageQuery[]): Promise<OSVVulnerability[]> {
    const body: OSVBatchQuery = {
      queries: packages.map((p) => ({
        package: { name: p.name, version: p.version, ecosystem: p.ecosystem },
      })),
    };

    let lastError: Error | undefined;

    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      try {
        const response = await fetch(this.endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });

        if (response.status === 429) {
          const retryAfter = response.headers.get('Retry-After');
          const delayMs = retryAfter
            ? parseInt(retryAfter, 10) * 1000
            : RETRY_BASE_DELAY_MS * Math.pow(2, attempt);
          await this.sleep(delayMs);
          continue;
        }

        if (!response.ok) {
          throw new Error(`OSV API returned ${response.status}: ${response.statusText}`);
        }

        const data = (await response.json()) as OSVBatchResponse;
        return this.extractVulnerabilities(data);
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));
        if (attempt < MAX_RETRIES - 1) {
          await this.sleep(RETRY_BASE_DELAY_MS * Math.pow(2, attempt));
        }
      }
    }

    throw lastError ?? new Error('OSV API request failed after retries');
  }

  private extractVulnerabilities(data: OSVBatchResponse): OSVVulnerability[] {
    const vulns: OSVVulnerability[] = [];
    const seenIds = new Set<string>();

    for (const entry of data.results) {
      if (entry.vulns) {
        for (const v of entry.vulns) {
          if (!seenIds.has(v.id)) {
            seenIds.add(v.id);
            vulns.push({
              id: v.id,
              summary: v.summary ?? '',
              details: v.details ?? '',
              aliases: v.aliases ?? [],
              severity: v.severity ?? [],
              affected: v.affected ?? [],
              references: v.references ?? [],
            });
          }
        }
      }
    }

    return vulns;
  }

  private chunkArray<T>(arr: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < arr.length; i += size) {
      chunks.push(arr.slice(i, i + size));
    }
    return chunks;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
