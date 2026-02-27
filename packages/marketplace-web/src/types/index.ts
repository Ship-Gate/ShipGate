export interface Intent {
  name: string;
  version: string;
  description: string;
  author: string;
  repository?: string;
  license: string;
  trustScore: number;
  verified: boolean;
  downloads: number;
  weeklyDownloads: number;
  createdAt: string;
  updatedAt: string;
  tags: string[];
  category: IntentCategory;
  readme?: string;
  versions: IntentVersion[];
  dependencies: string[];
  preconditions: ContractClause[];
  postconditions: ContractClause[];
  invariants: ContractClause[];
}

export interface IntentVersion {
  version: string;
  publishedAt: string;
  trustScore: number;
  downloads: number;
  changelog?: string;
}

export interface ContractClause {
  name: string;
  expression: string;
  description?: string;
}

export type IntentCategory =
  | "auth"
  | "data"
  | "payment"
  | "crypto"
  | "ai"
  | "storage"
  | "network"
  | "utility"
  | "security"
  | "other";

export interface SearchFilters {
  query: string;
  category?: IntentCategory;
  minTrustScore?: number;
  verified?: boolean;
  sortBy: "downloads" | "trust" | "updated" | "created";
  sortOrder: "asc" | "desc";
}

export interface SearchResult {
  intents: Intent[];
  total: number;
  page: number;
  pageSize: number;
}

export const CATEGORIES: { value: IntentCategory; label: string; icon: string }[] = [
  { value: "auth", label: "Authentication", icon: "Shield" },
  { value: "data", label: "Data Validation", icon: "Database" },
  { value: "payment", label: "Payments", icon: "CreditCard" },
  { value: "crypto", label: "Cryptography", icon: "Lock" },
  { value: "ai", label: "AI/ML", icon: "Brain" },
  { value: "storage", label: "Storage", icon: "HardDrive" },
  { value: "network", label: "Networking", icon: "Globe" },
  { value: "utility", label: "Utilities", icon: "Wrench" },
  { value: "security", label: "Security", icon: "ShieldCheck" },
  { value: "other", label: "Other", icon: "Package" },
];
