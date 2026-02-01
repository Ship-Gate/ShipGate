import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { Sidebar } from "@/components/Sidebar";
import { Header } from "@/components/Header";
import { ThemeProvider } from "@/components/providers";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });
const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
});

export const metadata: Metadata = {
  title: {
    default: "ISL Documentation - Intent Specification Language",
    template: "%s | ISL Docs",
  },
  description:
    "Specify intent. Verify code. Ship with confidence. ISL is a contract/specification language for validating AI-generated code.",
  keywords: [
    "ISL",
    "Intent Specification Language",
    "behavioral contracts",
    "formal verification",
    "software correctness",
    "AI code validation",
    "VibeCheck",
  ],
  authors: [{ name: "IntentOS Team" }],
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://isl.dev",
    siteName: "ISL Documentation",
    title: "ISL - Intent Specification Language",
    description: "Specify intent. Verify code. Ship with confidence.",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "ISL - Intent Specification Language",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "ISL - Intent Specification Language",
    description: "Specify intent. Verify code. Ship with confidence.",
    images: ["/og-image.png"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${inter.variable} ${jetbrainsMono.variable} font-sans antialiased`}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem
          disableTransitionOnChange
        >
          <div className="min-h-screen bg-background">
            <Header />
            <div className="flex">
              <Sidebar />
              <main className="flex-1 min-w-0">{children}</main>
            </div>
          </div>
        </ThemeProvider>
      </body>
    </html>
  );
}
