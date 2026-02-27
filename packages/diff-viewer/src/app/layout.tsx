import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'ISL Diff Viewer',
  description: 'Visual diff viewer for ISL specification changes',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
