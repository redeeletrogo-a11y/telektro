import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";
import { GUIAS } from "@/lib/guias";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: `${SITE_URL}/`, changeFrequency: "weekly", priority: 1 },
    { url: `${SITE_URL}/eletroposto`, changeFrequency: "monthly", priority: 0.8 },
    { url: `${SITE_URL}/condominio`, changeFrequency: "monthly", priority: 0.8 },
    { url: `${SITE_URL}/parceiro`, changeFrequency: "monthly", priority: 0.8 },
    { url: `${SITE_URL}/indique`, changeFrequency: "monthly", priority: 0.5 },
    { url: `${SITE_URL}/guias`, changeFrequency: "weekly", priority: 0.7 },
    { url: `${SITE_URL}/privacidade`, changeFrequency: "yearly", priority: 0.3 },
    { url: `${SITE_URL}/termos`, changeFrequency: "yearly", priority: 0.3 },
    ...GUIAS.map((g) => ({ url: `${SITE_URL}/guias/${g.slug}`, changeFrequency: "monthly" as const, priority: 0.6 })),
  ];
}
