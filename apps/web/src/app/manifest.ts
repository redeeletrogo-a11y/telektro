import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "Telektro — Operação de recarga",
    short_name: "Telektro",
    description: "Acompanhe e gerencie carregadores de veículos elétricos.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#f5f8f7",
    theme_color: "#0f776c",
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "maskable" },
    ],
  };
}
