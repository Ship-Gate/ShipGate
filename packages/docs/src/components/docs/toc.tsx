"use client";

import { useEffect, useState } from "react";
import { clsx } from "clsx";

interface TocItem {
  id: string;
  text: string;
  level: number;
}

interface TableOfContentsProps {
  items?: TocItem[];
}

export function TableOfContents({ items }: TableOfContentsProps) {
  const [headings, setHeadings] = useState<TocItem[]>(items || []);
  const [activeId, setActiveId] = useState<string>("");

  useEffect(() => {
    // If items are not provided, extract headings from the page
    if (!items) {
      const elements = document.querySelectorAll("h2, h3");
      const extractedHeadings: TocItem[] = Array.from(elements).map((el) => ({
        id: el.id,
        text: el.textContent || "",
        level: parseInt(el.tagName[1]),
      }));
      setHeadings(extractedHeadings);
    }
  }, [items]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setActiveId(entry.target.id);
          }
        });
      },
      {
        rootMargin: "-80px 0px -80% 0px",
        threshold: 0,
      }
    );

    headings.forEach((heading) => {
      const element = document.getElementById(heading.id);
      if (element) {
        observer.observe(element);
      }
    });

    return () => observer.disconnect();
  }, [headings]);

  if (headings.length === 0) {
    return null;
  }

  return (
    <div className="hidden xl:block w-56 shrink-0">
      <div className="sticky top-20 max-h-[calc(100vh-5rem)] overflow-y-auto py-6 pr-4">
        <p className="text-sm font-semibold mb-4">On this page</p>
        <nav>
          <ul className="space-y-2 text-sm">
            {headings.map((heading) => (
              <li key={heading.id}>
                <a
                  href={`#${heading.id}`}
                  className={clsx(
                    "block py-1 transition-colors hover:text-foreground",
                    heading.level === 3 && "pl-4",
                    activeId === heading.id
                      ? "text-primary font-medium"
                      : "text-muted-foreground"
                  )}
                >
                  {heading.text}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </div>
  );
}
