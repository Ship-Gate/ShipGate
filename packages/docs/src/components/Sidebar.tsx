"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { clsx } from "clsx";
import {
  BookOpen,
  Code2,
  Shield,
  Terminal,
  Package,
  ChevronRight,
} from "lucide-react";

interface NavSection {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  items: { href: string; label: string }[];
}

const navigation: NavSection[] = [
  {
    title: "Getting Started",
    icon: BookOpen,
    items: [
      { href: "/docs/getting-started", label: "Introduction" },
      { href: "/docs/getting-started/installation", label: "Installation" },
      { href: "/docs/getting-started/first-spec", label: "Your First Spec" },
      { href: "/docs/getting-started/generate", label: "Code Generation" },
    ],
  },
  {
    title: "Language Reference",
    icon: Code2,
    items: [
      { href: "/docs/language", label: "Overview" },
      { href: "/docs/language/types", label: "Types" },
      { href: "/docs/language/entities", label: "Entities" },
      { href: "/docs/language/behaviors", label: "Behaviors" },
      { href: "/docs/language/scenarios", label: "Scenarios" },
      { href: "/docs/language/invariants", label: "Invariants" },
    ],
  },
  {
    title: "Verification",
    icon: Shield,
    items: [
      { href: "/docs/verification", label: "Overview" },
      { href: "/docs/verification/runtime", label: "Runtime Verification" },
      { href: "/docs/verification/chaos", label: "Chaos Testing" },
      { href: "/docs/verification/temporal", label: "Temporal Properties" },
    ],
  },
  {
    title: "Standard Library",
    icon: Package,
    items: [
      { href: "/docs/stdlib", label: "Overview" },
      { href: "/docs/stdlib/core", label: "Core Types" },
      { href: "/docs/stdlib/auth", label: "Authentication" },
      { href: "/docs/stdlib/payments", label: "Payments" },
    ],
  },
  {
    title: "CLI Reference",
    icon: Terminal,
    items: [
      { href: "/docs/cli", label: "Overview" },
      { href: "/docs/cli/check", label: "isl check" },
      { href: "/docs/cli/generate", label: "isl generate" },
      { href: "/docs/cli/verify", label: "isl verify" },
    ],
  },
];

export function Sidebar() {
  const pathname = usePathname();

  // Don't show sidebar on home page or playground
  if (pathname === "/" || pathname === "/playground") {
    return null;
  }

  return (
    <aside className="hidden lg:block w-64 shrink-0 border-r border-border">
      <div className="sticky top-16 h-[calc(100vh-4rem)] overflow-y-auto py-6 px-4">
        <nav className="space-y-6">
          {navigation.map((section) => (
            <div key={section.title}>
              <div className="flex items-center gap-2 px-3 mb-2">
                <section.icon className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm font-semibold">{section.title}</span>
              </div>
              <ul className="space-y-1">
                {section.items.map((item) => (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className={clsx(
                        "sidebar-link flex items-center gap-2",
                        pathname === item.href && "active"
                      )}
                    >
                      {pathname === item.href && (
                        <ChevronRight className="w-3 h-3" />
                      )}
                      <span>{item.label}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>
      </div>
    </aside>
  );
}
