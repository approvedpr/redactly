import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "Redactly - Private PDF Redaction Tool",
    template: "%s | Redactly",
  },
  description:
    "Redactly helps you redact sensitive information, reorder pages, and export clean, flattened PDFs directly in your browser.",
  applicationName: "Redactly",
  keywords: [
    "PDF redaction",
    "PDF editor",
    "redact PDF",
    "remove sensitive information",
    "browser PDF tool",
  ],
  openGraph: {
    title: "Redactly - Private PDF Redaction Tool",
    description:
      "Redact sensitive information, reorder pages, and export clean, flattened PDFs directly in your browser.",
    siteName: "Redactly",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "Redactly - Private PDF Redaction Tool",
    description:
      "Redact sensitive information, reorder pages, and export clean, flattened PDFs directly in your browser.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-background text-foreground">
        {children}
      </body>
    </html>
  );
}
