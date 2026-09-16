import type { Metadata, Viewport } from "next";
import "./globals.css";
import { AuthProvider } from "@/components/AuthContext";

const BASE = process.env.BASE_URL || "https://smaridhi.vercel.app";

export const metadata: Metadata = {
  metadataBase: new URL(BASE),
  title: {
    default: "SMRIDHI | Business Compliance & Tax Made Simple",
    template: "%s | SMRIDHI",
  },
  description:
    "SMRIDHI helps Indian businesses manage GST, Income Tax, Accounting, Bookkeeping and ROC compliance with dedicated expert support and WhatsApp-first communication.",
  keywords: [
    "GST registration",
    "GST filing",
    "income tax return",
    "tax filing India",
    "accounting services",
    "bookkeeping",
    "ROC compliance",
    "company registration",
    "CA services Bengaluru",
    "business compliance India",
  ],
  authors: [{ name: "SMRIDHI" }],
  creator: "SMRIDHI",
  publisher: "SMRIDHI",
  robots: { index: true, follow: true },
  alternates: { canonical: BASE },
  openGraph: {
    type: "website",
    locale: "en_IN",
    url: BASE,
    siteName: "SMRIDHI",
    title: "SMRIDHI | Business Compliance & Tax Made Simple",
    description:
      "GST, Income Tax, Accounting, Bookkeeping and ROC compliance handled by professionals. Dedicated support for Indian businesses.",
  },
  twitter: {
    card: "summary",
    title: "SMRIDHI | Business Compliance & Tax Made Simple",
    description:
      "GST, Income Tax, Accounting, Bookkeeping and ROC compliance handled by professionals.",
  },
};

export const viewport: Viewport = {
  themeColor: "#0a3d62",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}