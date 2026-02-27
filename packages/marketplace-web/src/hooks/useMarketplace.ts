"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import type { Intent, SearchFilters, SearchResult, IntentCategory } from "@/types";

// Mock data - replace with actual API calls
const MOCK_INTENTS: Intent[] = [
  {
    name: "auth-jwt",
    version: "2.1.0",
    description: "JWT authentication with automatic token refresh, secure storage, and role-based access control.",
    author: "intentos-team",
    repository: "https://github.com/intentos/auth-jwt",
    license: "MIT",
    trustScore: 98,
    verified: true,
    downloads: 245000,
    weeklyDownloads: 12500,
    createdAt: "2024-01-15T00:00:00Z",
    updatedAt: "2025-01-20T00:00:00Z",
    tags: ["authentication", "jwt", "security", "tokens"],
    category: "auth",
    versions: [
      { version: "2.1.0", publishedAt: "2025-01-20T00:00:00Z", trustScore: 98, downloads: 45000 },
      { version: "2.0.0", publishedAt: "2024-09-15T00:00:00Z", trustScore: 96, downloads: 120000 },
    ],
    dependencies: [],
    preconditions: [
      { name: "valid_credentials", expression: "credentials.username.length > 0 && credentials.password.length >= 8" },
    ],
    postconditions: [
      { name: "token_issued", expression: "result.token != null && result.expiresAt > now()" },
    ],
    invariants: [
      { name: "token_secure", expression: "token.algorithm in ['RS256', 'ES256']" },
    ],
  },
  {
    name: "payment-stripe",
    version: "3.0.2",
    description: "Stripe payment processing with intent verification, webhook handling, and automatic retries.",
    author: "stripe-verified",
    repository: "https://github.com/intentos/payment-stripe",
    license: "MIT",
    trustScore: 99,
    verified: true,
    downloads: 189000,
    weeklyDownloads: 9800,
    createdAt: "2024-02-01T00:00:00Z",
    updatedAt: "2025-01-18T00:00:00Z",
    tags: ["payments", "stripe", "checkout", "subscriptions"],
    category: "payment",
    versions: [
      { version: "3.0.2", publishedAt: "2025-01-18T00:00:00Z", trustScore: 99, downloads: 35000 },
    ],
    dependencies: [],
    preconditions: [
      { name: "valid_amount", expression: "amount > 0 && amount <= MAX_AMOUNT" },
    ],
    postconditions: [
      { name: "payment_processed", expression: "result.status in ['succeeded', 'pending']" },
    ],
    invariants: [],
  },
  {
    name: "data-validate",
    version: "1.5.0",
    description: "Schema-based data validation with custom rules, async validation, and detailed error messages.",
    author: "data-tools",
    repository: "https://github.com/intentos/data-validate",
    license: "MIT",
    trustScore: 94,
    verified: true,
    downloads: 156000,
    weeklyDownloads: 8200,
    createdAt: "2024-03-10T00:00:00Z",
    updatedAt: "2025-01-15T00:00:00Z",
    tags: ["validation", "schema", "forms", "data"],
    category: "data",
    versions: [
      { version: "1.5.0", publishedAt: "2025-01-15T00:00:00Z", trustScore: 94, downloads: 28000 },
    ],
    dependencies: [],
    preconditions: [
      { name: "schema_valid", expression: "schema != null && schema.type != null" },
    ],
    postconditions: [
      { name: "validation_complete", expression: "result.valid == true || result.errors.length > 0" },
    ],
    invariants: [],
  },
  {
    name: "crypto-encrypt",
    version: "2.0.0",
    description: "AES-256-GCM encryption with secure key derivation, authenticated encryption, and streaming support.",
    author: "security-core",
    license: "Apache-2.0",
    trustScore: 97,
    verified: true,
    downloads: 134000,
    weeklyDownloads: 7100,
    createdAt: "2024-04-05T00:00:00Z",
    updatedAt: "2025-01-10T00:00:00Z",
    tags: ["encryption", "aes", "security", "cryptography"],
    category: "crypto",
    versions: [
      { version: "2.0.0", publishedAt: "2025-01-10T00:00:00Z", trustScore: 97, downloads: 22000 },
    ],
    dependencies: [],
    preconditions: [
      { name: "key_valid", expression: "key.length == 32" },
    ],
    postconditions: [
      { name: "encrypted", expression: "result.ciphertext != plaintext && result.tag != null" },
    ],
    invariants: [
      { name: "key_never_logged", expression: "!logs.contains(key)" },
    ],
  },
  {
    name: "ai-openai",
    version: "1.2.0",
    description: "OpenAI API integration with rate limiting, caching, token counting, and streaming responses.",
    author: "ai-tools",
    license: "MIT",
    trustScore: 91,
    verified: false,
    downloads: 98000,
    weeklyDownloads: 6500,
    createdAt: "2024-05-20T00:00:00Z",
    updatedAt: "2025-01-05T00:00:00Z",
    tags: ["ai", "openai", "gpt", "llm", "chat"],
    category: "ai",
    versions: [
      { version: "1.2.0", publishedAt: "2025-01-05T00:00:00Z", trustScore: 91, downloads: 18000 },
    ],
    dependencies: [],
    preconditions: [
      { name: "api_key_set", expression: "config.apiKey != null" },
    ],
    postconditions: [
      { name: "response_valid", expression: "result.choices.length > 0" },
    ],
    invariants: [],
  },
  {
    name: "storage-s3",
    version: "2.3.1",
    description: "AWS S3 storage with multipart uploads, presigned URLs, and automatic retry logic.",
    author: "aws-verified",
    license: "MIT",
    trustScore: 96,
    verified: true,
    downloads: 112000,
    weeklyDownloads: 5900,
    createdAt: "2024-02-28T00:00:00Z",
    updatedAt: "2025-01-12T00:00:00Z",
    tags: ["storage", "s3", "aws", "cloud", "files"],
    category: "storage",
    versions: [
      { version: "2.3.1", publishedAt: "2025-01-12T00:00:00Z", trustScore: 96, downloads: 19000 },
    ],
    dependencies: [],
    preconditions: [
      { name: "bucket_exists", expression: "await bucketExists(config.bucket)" },
    ],
    postconditions: [
      { name: "file_uploaded", expression: "result.etag != null && result.location != null" },
    ],
    invariants: [],
  },
  {
    name: "rate-limiter",
    version: "1.0.0",
    description: "Token bucket rate limiting with Redis support, sliding windows, and distributed coordination.",
    author: "infra-tools",
    license: "MIT",
    trustScore: 88,
    verified: false,
    downloads: 67000,
    weeklyDownloads: 4200,
    createdAt: "2024-06-15T00:00:00Z",
    updatedAt: "2024-12-20T00:00:00Z",
    tags: ["rate-limit", "redis", "api", "throttle"],
    category: "network",
    versions: [
      { version: "1.0.0", publishedAt: "2024-12-20T00:00:00Z", trustScore: 88, downloads: 12000 },
    ],
    dependencies: [],
    preconditions: [
      { name: "limit_positive", expression: "config.limit > 0 && config.window > 0" },
    ],
    postconditions: [
      { name: "decision_made", expression: "result.allowed == true || result.retryAfter > 0" },
    ],
    invariants: [],
  },
  {
    name: "hash-password",
    version: "1.1.0",
    description: "Argon2id password hashing with automatic salt generation and timing-safe comparison.",
    author: "security-core",
    license: "MIT",
    trustScore: 99,
    verified: true,
    downloads: 178000,
    weeklyDownloads: 8900,
    createdAt: "2024-01-20T00:00:00Z",
    updatedAt: "2025-01-08T00:00:00Z",
    tags: ["password", "hash", "argon2", "security"],
    category: "security",
    versions: [
      { version: "1.1.0", publishedAt: "2025-01-08T00:00:00Z", trustScore: 99, downloads: 45000 },
    ],
    dependencies: [],
    preconditions: [
      { name: "password_not_empty", expression: "password.length > 0" },
    ],
    postconditions: [
      { name: "hash_generated", expression: "result.hash.startsWith('$argon2id$')" },
    ],
    invariants: [
      { name: "plaintext_not_stored", expression: "!memory.contains(password)" },
    ],
  },
];

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "/api";

export function useMarketplace() {
  const [intents, setIntents] = useState<Intent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Simulate API call
    const timer = setTimeout(() => {
      setIntents(MOCK_INTENTS);
      setLoading(false);
    }, 500);

    return () => clearTimeout(timer);
  }, []);

  const trending = useMemo(
    () => [...intents].sort((a, b) => b.weeklyDownloads - a.weeklyDownloads).slice(0, 6),
    [intents]
  );

  const featured = useMemo(
    () => intents.filter((i) => i.verified && i.trustScore >= 95).slice(0, 3),
    [intents]
  );

  const categories = useMemo(() => {
    const grouped = new Map<IntentCategory, Intent[]>();
    for (const intent of intents) {
      const list = grouped.get(intent.category) || [];
      list.push(intent);
      grouped.set(intent.category, list);
    }
    return grouped;
  }, [intents]);

  return { intents, trending, featured, categories, loading, error };
}

export function useIntent(name: string) {
  const [intent, setIntent] = useState<Intent | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      const found = MOCK_INTENTS.find((i) => i.name === name);
      if (found) {
        setIntent(found);
      } else {
        setError("Intent not found");
      }
      setLoading(false);
    }, 300);

    return () => clearTimeout(timer);
  }, [name]);

  return { intent, loading, error };
}

export function useSearch(initialFilters?: Partial<SearchFilters>) {
  const [filters, setFilters] = useState<SearchFilters>({
    query: "",
    sortBy: "downloads",
    sortOrder: "desc",
    ...initialFilters,
  });
  const [results, setResults] = useState<SearchResult>({
    intents: [],
    total: 0,
    page: 1,
    pageSize: 20,
  });
  const [loading, setLoading] = useState(false);

  const search = useCallback(async (newFilters?: Partial<SearchFilters>) => {
    const merged = { ...filters, ...newFilters };
    setFilters(merged);
    setLoading(true);

    // Simulate API call with filtering
    await new Promise((resolve) => setTimeout(resolve, 300));

    let filtered = [...MOCK_INTENTS];

    // Text search
    if (merged.query) {
      const q = merged.query.toLowerCase();
      filtered = filtered.filter(
        (i) =>
          i.name.toLowerCase().includes(q) ||
          i.description.toLowerCase().includes(q) ||
          i.tags.some((t) => t.toLowerCase().includes(q))
      );
    }

    // Category filter
    if (merged.category) {
      filtered = filtered.filter((i) => i.category === merged.category);
    }

    // Trust score filter
    if (merged.minTrustScore) {
      filtered = filtered.filter((i) => i.trustScore >= merged.minTrustScore!);
    }

    // Verified filter
    if (merged.verified) {
      filtered = filtered.filter((i) => i.verified);
    }

    // Sorting
    filtered.sort((a, b) => {
      let cmp = 0;
      switch (merged.sortBy) {
        case "downloads":
          cmp = a.downloads - b.downloads;
          break;
        case "trust":
          cmp = a.trustScore - b.trustScore;
          break;
        case "updated":
          cmp = new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime();
          break;
        case "created":
          cmp = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
          break;
      }
      return merged.sortOrder === "desc" ? -cmp : cmp;
    });

    setResults({
      intents: filtered,
      total: filtered.length,
      page: 1,
      pageSize: 20,
    });
    setLoading(false);
  }, [filters]);

  return { filters, results, loading, search, setFilters };
}
