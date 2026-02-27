import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Shipgate Pro',
  description: 'Unlock AI-powered healing and intent building for your codebase.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen">{children}</body>
    </html>
  );
}
