import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Pricing & Plans",
  description:
    "Simple, transparent pricing for Indian businesses. FREE plan, Starter for individuals & freelancers, Business for MSMEs & startups, and Growth for growing businesses. GST, Income Tax, Accounting and ROC compliance.",
  keywords: [
    "GST filing price",
    "CA fees India",
    "tax filing plans",
    "accounting services pricing",
    "compliance plans India",
    "GST registration cost",
  ],
  alternates: { canonical: "/plans" },
  openGraph: {
    type: "website",
    url: "https://smaridhi.vercel.app/plans",
    title: "Pricing & Plans | SMRIDHI",
    description:
      "GST, Income Tax, Accounting and ROC compliance plans — FREE, Starter, Business and Growth. Transparent annual pricing.",
  },
};

export default function PlansLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}