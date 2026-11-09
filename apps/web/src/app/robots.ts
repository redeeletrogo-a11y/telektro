import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

const DISALLOW = ["/api/", "/auth/", "/convite/", "/register"];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: "*", allow: "/", disallow: DISALLOW },
      // Crawlers de IA comuns: liberados explicitamente, com as mesmas áreas privadas bloqueadas.
      { userAgent: ["GPTBot", "OAI-SearchBot", "ChatGPT-User", "ClaudeBot", "Claude-User", "Claude-SearchBot", "PerplexityBot", "Perplexity-User", "Google-Extended", "Applebot-Extended", "CCBot"], allow: "/", disallow: DISALLOW },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
