// ============================================================================
// Layout Components — Sidebar, Header, Shell
// ============================================================================

import type { ScreenDecl } from '@isl-lang/parser';
import { toKebab, toPascal } from '../utils.js';

export interface NavItem {
  label: string;
  href: string;
  icon?: string;
}

export function emitSidebar(navItems: NavItem[]): string {
  const items = navItems
    .map(
      (item) => `        <Link
          href="${item.href}"
          className="flex items-center gap-3 rounded-lg px-3 py-2 text-muted-foreground transition-all hover:bg-primary/10 hover:text-primary"
        >
          <span className="text-lg">${item.icon ?? '•'}</span>
          ${item.label}
        </Link>`
    )
    .join('\n');

  return `"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";

export interface SidebarProps {
  className?: string;
  collapsed?: boolean;
}

export function Sidebar({ className, collapsed }: SidebarProps) {
  return (
    <aside
      className={cn(
        "flex h-full flex-col border-r bg-card transition-all duration-300",
        collapsed ? "w-16" : "w-64",
        className
      )}
    >
      <nav className="flex flex-1 flex-col gap-1 p-2">
${items}
      </nav>
    </aside>
  );
}
`;
}

export function emitHeader(appName: string): string {
  return `"use client";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

export interface HeaderProps {
  className?: string;
  appName?: string;
  breadcrumbs?: { label: string; href?: string }[];
}

export function Header({ className, appName = "App", breadcrumbs = [] }: HeaderProps) {
  return (
    <header
      className={cn(
        "flex h-14 items-center gap-4 border-b bg-background px-4",
        className
      )}
    >
      <div className="flex flex-1 items-center gap-2">
        {breadcrumbs.length > 0 ? (
          <nav className="flex items-center gap-2 text-sm text-muted-foreground">
            {breadcrumbs.map((b, i) => (
              <span key={i}>
                {b.href ? (
                  <a href={b.href} className="hover:text-foreground">
                    {b.label}
                  </a>
                ) : (
                  <span className="text-foreground">{b.label}</span>
                )}
                {i < breadcrumbs.length - 1 && (
                  <span className="mx-2">/</span>
                )}
              </span>
            ))}
          </nav>
        ) : (
          <span className="font-semibold">{appName}</span>
        )}
      </div>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className="relative h-8 w-8 rounded-full">
            <Avatar className="h-8 w-8">
              <AvatarFallback>U</AvatarFallback>
            </Avatar>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel>Account</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem>Profile</DropdownMenuItem>
          <DropdownMenuItem>Settings</DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem className="text-destructive">
            Log out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}
`;
}

export function emitShell(appName: string, navItems: NavItem[]): string {
  return `"use client";

import { useState } from "react";
import { Sidebar } from "./Sidebar";
import { Header } from "./Header";
import { cn } from "@/lib/utils";

export interface ShellProps {
  children: React.ReactNode;
  className?: string;
  breadcrumbs?: { label: string; href?: string }[];
}

export function Shell({ children, className, breadcrumbs }: ShellProps) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  return (
    <div className="flex h-screen w-full overflow-hidden">
      <div
        className={cn(
          "hidden border-r bg-card transition-all duration-300 md:flex",
          sidebarCollapsed ? "w-16" : "w-64"
        )}
      >
        <Sidebar collapsed={sidebarCollapsed} />
      </div>
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header appName="${appName}" breadcrumbs={breadcrumbs} />
        <main className="flex-1 overflow-auto p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}
`;
}

/** Extract nav items from screens or fallback to entities */
export function screensToNavItems(
  screens: ScreenDecl[],
  entities: { name: { name: string } }[]
): NavItem[] {
  if (screens.length > 0) {
    const items: NavItem[] = [];
    for (const s of screens) {
      const route = s.route?.value ?? `/${toKebab(s.name.name)}`;
      const label = s.description?.value ?? toPascal(s.name.name);
      const fromNav = (s.navigation ?? []).map((n) => {
        const targetVal =
          n.target && typeof n.target === 'object' && 'value' in n.target
            ? (n.target as { value: string }).value
            : n.target && typeof n.target === 'object' && 'name' in n.target
              ? (n.target as { name: string }).name
              : route;
        return { label: n.label.value, href: `/${toKebab(targetVal)}` };
      });
      items.push(...(fromNav.length > 0 ? fromNav : [{ label, href: route }]));
    }
    return items;
  }
  return entities.map((e) => ({
    label: toPascal(e.name.name) + 's',
    href: `/${toKebab(e.name.name)}`,
  }));
}
