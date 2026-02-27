import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Trace Viewer - IntentOS',
  description: 'Visual debugger for verification traces and proof bundles',
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
