import type { MetadataRoute } from "next";

const BASE = process.env.BASE_URL || "https://smaridhi.vercel.app";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/dashboard", "/verify", "/api/"],
      },
    ],
    sitemap: `${BASE}/sitemap.xml`,
  };
}