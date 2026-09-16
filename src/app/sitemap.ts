import type { MetadataRoute } from "next";

const BASE = process.env.BASE_URL || "https://smaridhi.vercel.app";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  return [
    { url: BASE, lastModified: now, changeFrequency: "weekly", priority: 1 },
    { url: `${BASE}/plans`, lastModified: now, changeFrequency: "weekly", priority: 0.9 },
    { url: `${BASE}/signup`, lastModified: now, changeFrequency: "monthly", priority: 0.8 },
    { url: `${BASE}/login`, lastModified: now, changeFrequency: "monthly", priority: 0.6 },
  ];
}