import type { Metadata, Viewport } from "next";
import { PwaInstallButton } from "@/components/pwa-install-button";
import "./globals.css";

export const metadata: Metadata = {
  applicationName: "Telektro",
  title: "Telektro — Operação de recarga",
  description: "Plataforma de operação de infraestrutura de recarga elétrica.",
  appleWebApp: { capable: true, statusBarStyle: "default", title: "Telektro" },
};

export const viewport: Viewport = { themeColor: "#0f776c", viewportFit: "cover" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="pt-BR"><body><PwaInstallButton/>{children}</body></html>;
}
