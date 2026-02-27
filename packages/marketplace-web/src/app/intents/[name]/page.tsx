"use client";

import { use } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Download,
  Calendar,
  GitBranch,
  ExternalLink,
  FileText,
  Code,
  History,
  ChevronRight,
} from "lucide-react";
import { TrustBadge, TrustScoreBar } from "@/components/TrustBadge";
import { InstallButton, CopyCommand } from "@/components/InstallButton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useIntent } from "@/hooks/useMarketplace";
import { formatNumber, formatDate, cn } from "@/lib/utils";

interface PageProps {
  params: Promise<{ name: string }>;
}

export default function IntentDetailPage({ params }: PageProps) {
  const { name } = use(params);
  const { intent, loading, error } = useIntent(name);

  if (loading) {
    return (
      <div className="container py-8">
        <div className="animate-pulse space-y-6">
          <div className="h-8 w-32 bg-muted rounded" />
          <div className="h-12 w-64 bg-muted rounded" />
          <div className="h-6 w-full max-w-xl bg-muted rounded" />
          <div className="grid gap-6 lg:grid-cols-3">
            <div className="lg:col-span-2 h-96 bg-muted rounded-xl" />
            <div className="h-64 bg-muted rounded-xl" />
          </div>
        </div>
      </div>
    );
  }

  if (error || !intent) {
    return (
      <div className="container py-8">
        <div className="text-center py-12">
          <h1 className="text-2xl font-bold mb-4">Intent Not Found</h1>
          <p className="text-muted-foreground mb-6">
            The intent "{name}" doesn't exist or has been removed.
          </p>
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-primary hover:underline"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to marketplace
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="container py-8">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-sm text-muted-foreground mb-6">
        <Link href="/" className="hover:text-foreground transition-colors">
          Marketplace
        </Link>
        <ChevronRight className="h-4 w-4" />
        <Link
          href={`/search?category=${intent.category}`}
          className="hover:text-foreground transition-colors capitalize"
        >
          {intent.category}
        </Link>
        <ChevronRight className="h-4 w-4" />
        <span className="text-foreground">{intent.name}</span>
      </nav>

      {/* Header */}
      <div className="flex flex-col lg:flex-row gap-8 mb-8">
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-3xl font-bold">{intent.name}</h1>
            <TrustBadge score={intent.trustScore} verified={intent.verified} size="lg" />
          </div>
          <p className="text-lg text-muted-foreground mb-4">{intent.description}</p>
          <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
            <span className="flex items-center gap-1">
              <GitBranch className="h-4 w-4" />
              v{intent.version}
            </span>
            <span className="flex items-center gap-1">
              <Download className="h-4 w-4" />
              {formatNumber(intent.downloads)} downloads
            </span>
            <span className="flex items-center gap-1">
              <Calendar className="h-4 w-4" />
              Updated {formatDate(intent.updatedAt)}
            </span>
            <span>by {intent.author}</span>
          </div>
        </div>

        {/* Install Card */}
        <div className="w-full lg:w-80 shrink-0">
          <div className="rounded-xl border bg-card p-6 space-y-4">
            <InstallButton intentName={intent.name} version={intent.version} size="lg" />
            <TrustScoreBar score={intent.trustScore} />
            <div className="pt-4 border-t space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">License</span>
                <span className="font-medium">{intent.license}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Weekly downloads</span>
                <span className="font-medium">{formatNumber(intent.weeklyDownloads)}</span>
              </div>
              {intent.repository && (
                <a
                  href={intent.repository}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-primary hover:underline"
                >
                  View repository
                  <ExternalLink className="h-3 w-3" />
                </a>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Tags */}
      <div className="flex flex-wrap gap-2 mb-8">
        {intent.tags.map((tag) => (
          <Link
            key={tag}
            href={`/search?q=${tag}`}
            className="inline-flex items-center rounded-full bg-secondary px-3 py-1 text-sm font-medium text-secondary-foreground hover:bg-secondary/80 transition-colors"
          >
            {tag}
          </Link>
        ))}
      </div>

      {/* Tabs */}
      <Tabs defaultValue="readme" className="space-y-6">
        <TabsList>
          <TabsTrigger value="readme" className="gap-2">
            <FileText className="h-4 w-4" />
            Readme
          </TabsTrigger>
          <TabsTrigger value="contract" className="gap-2">
            <Code className="h-4 w-4" />
            Contract
          </TabsTrigger>
          <TabsTrigger value="versions" className="gap-2">
            <History className="h-4 w-4" />
            Versions
          </TabsTrigger>
        </TabsList>

        <TabsContent value="readme" className="space-y-6">
          <div className="prose prose-neutral dark:prose-invert max-w-none">
            <h2>Installation</h2>
            <CopyCommand command={`isl install ${intent.name}`} />

            <h2>Usage</h2>
            <pre className="bg-muted p-4 rounded-lg overflow-x-auto">
              <code>{`import { ${toPascalCase(intent.name)} } from '@intents/${intent.name}';

// Use the intent in your code
const result = await ${toPascalCase(intent.name)}.execute({
  // your parameters here
});`}</code>
            </pre>

            <h2>About</h2>
            <p>{intent.description}</p>
            <p>
              This intent has been formally verified with a trust score of{" "}
              <strong>{intent.trustScore}%</strong>. It has been downloaded{" "}
              {formatNumber(intent.downloads)} times and is actively maintained.
            </p>
          </div>
        </TabsContent>

        <TabsContent value="contract" className="space-y-6">
          <div className="rounded-xl border bg-card p-6 space-y-6">
            {/* Preconditions */}
            <div>
              <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-blue-500" />
                Preconditions
              </h3>
              {intent.preconditions.length === 0 ? (
                <p className="text-muted-foreground text-sm">No preconditions defined.</p>
              ) : (
                <div className="space-y-2">
                  {intent.preconditions.map((clause, i) => (
                    <div key={i} className="p-3 rounded-lg bg-muted font-mono text-sm">
                      <span className="text-primary">require</span> {clause.name}:{" "}
                      <span className="text-muted-foreground">{clause.expression}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Postconditions */}
            <div>
              <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-green-500" />
                Postconditions
              </h3>
              {intent.postconditions.length === 0 ? (
                <p className="text-muted-foreground text-sm">No postconditions defined.</p>
              ) : (
                <div className="space-y-2">
                  {intent.postconditions.map((clause, i) => (
                    <div key={i} className="p-3 rounded-lg bg-muted font-mono text-sm">
                      <span className="text-trust-verified">ensure</span> {clause.name}:{" "}
                      <span className="text-muted-foreground">{clause.expression}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Invariants */}
            <div>
              <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-purple-500" />
                Invariants
              </h3>
              {intent.invariants.length === 0 ? (
                <p className="text-muted-foreground text-sm">No invariants defined.</p>
              ) : (
                <div className="space-y-2">
                  {intent.invariants.map((clause, i) => (
                    <div key={i} className="p-3 rounded-lg bg-muted font-mono text-sm">
                      <span className="text-primary">invariant</span> {clause.name}:{" "}
                      <span className="text-muted-foreground">{clause.expression}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="versions" className="space-y-4">
          {intent.versions.map((version, i) => (
            <div
              key={version.version}
              className={cn(
                "flex items-center justify-between p-4 rounded-xl border bg-card",
                i === 0 && "border-primary/50"
              )}
            >
              <div className="flex items-center gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">v{version.version}</span>
                    {i === 0 && (
                      <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary text-xs font-medium">
                        Latest
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Published {formatDate(version.publishedAt)}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <TrustBadge score={version.trustScore} size="sm" />
                <span className="text-sm text-muted-foreground">
                  {formatNumber(version.downloads)} downloads
                </span>
                <CopyCommand command={`isl install ${intent.name}@${version.version}`} />
              </div>
            </div>
          ))}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function toPascalCase(str: string): string {
  return str
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join("");
}
