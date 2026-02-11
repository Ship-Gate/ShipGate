import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: '5280 Remodeling | Denver Handyman & Home Remodeling',
  description:
    'Professional handyman and home remodeling services in the Denver metro area. Kitchen, bathroom, deck, flooring, and general repairs.',
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
