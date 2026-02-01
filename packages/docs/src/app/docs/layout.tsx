import { TableOfContents } from "@/components/docs/toc";

export default function DocsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex">
      <div className="flex-1 min-w-0">
        <div className="max-w-4xl mx-auto py-8 px-6 lg:px-8">
          <article className="prose prose-gray dark:prose-invert max-w-none">
            {children}
          </article>
        </div>
      </div>
      <TableOfContents />
    </div>
  );
}
