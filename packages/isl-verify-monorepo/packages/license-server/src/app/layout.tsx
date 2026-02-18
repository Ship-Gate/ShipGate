import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Shipgate - Formal Verification for TypeScript & JavaScript',
  description: 'Prove your code is correct before deployment with automated formal verification',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
