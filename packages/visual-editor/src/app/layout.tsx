import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'ISL Visual Editor',
  description: 'Visual/graphical editor for ISL specifications',
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
