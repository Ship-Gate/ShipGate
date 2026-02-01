"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { clsx } from "clsx";
import { ChevronRight, Menu, X } from "lucide-react";
import { useState } from "react";
import { navigation } from "@/lib/navigation";

export function Sidebar() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  // Don't show sidebar on home page or playground
  if (pathname === "/" || pathname === "/playground") {
    return null;
  }

  const sidebarContent = (
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
  );

  return (
    <>
      {/* Mobile sidebar toggle - shown in header area on small screens */}
      <button
        className="lg:hidden fixed bottom-4 right-4 z-40 w-12 h-12 rounded-full bg-primary text-primary-foreground shadow-lg flex items-center justify-center"
        onClick={() => setMobileOpen(!mobileOpen)}
        aria-label="Toggle navigation"
      >
        {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
      </button>

      {/* Mobile sidebar overlay */}
      {mobileOpen && (
        <div
          className="lg:hidden fixed inset-0 z-30 bg-background/80 backdrop-blur-sm"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Mobile sidebar */}
      <aside
        className={clsx(
          "lg:hidden fixed top-16 left-0 bottom-0 z-30 w-72 border-r border-border bg-background transform transition-transform duration-200 ease-in-out overflow-y-auto py-6 px-4",
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {sidebarContent}
      </aside>

      {/* Desktop sidebar */}
      <aside className="hidden lg:block w-64 shrink-0 border-r border-border">
        <div className="sticky top-16 h-[calc(100vh-4rem)] overflow-y-auto py-6 px-4">
          {sidebarContent}
        </div>
      </aside>
    </>
  );
}
