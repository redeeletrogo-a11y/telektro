import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";
import { GUIAS } from "@/lib/guias";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: `${SITE_URL}/`, changeFrequency: "weekly", priority: 1 },
    { url: `${SITE_URL}/guias`, changeFrequency: "weekly", priority: 0.7 },
    ...GUIAS.map((g) => ({ url: `${SITE_URL}/guias/${g.slug}`, changeFrequency: "monthly" as const, priority: 0.6 })),
  ];
}
