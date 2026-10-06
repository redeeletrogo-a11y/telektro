import type { Metadata, Viewport } from "next";
import { PwaInstallButton } from "@/components/pwa-install-button";
import { GOOGLE_ADS_ID, GOOGLE_ADS_SNIPPET } from "@/lib/ads";
import { SITE_DESCRIPTION, SITE_TITLE, SITE_URL } from "@/lib/site";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  applicationName: "Telektro",
  title: { default: SITE_TITLE, template: "%s | Telektro" },
  description: SITE_DESCRIPTION,
  keywords: ["eletroposto", "gestão de carregador elétrico", "carregador de carro elétrico", "recarga de veículo elétrico", "OCPP 1.6J", "carregador elétrico condomínio", "gestão de eletroposto"],
  alternates: { canonical: "/" },
  robots: { index: true, follow: true },
  openGraph: { type: "website", locale: "pt_BR", url: "/", siteName: "Telektro", title: SITE_TITLE, description: SITE_DESCRIPTION },
  twitter: { card: "summary_large_image", title: SITE_TITLE, description: SITE_DESCRIPTION },
  verification: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION ? { google: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION } : undefined,
  appleWebApp: { capable: true, statusBarStyle: "default", title: "Telektro" },
};

export const viewport: Viewport = { themeColor: "#0f776c", viewportFit: "cover" };

const THEME_SCRIPT = `try{var t=localStorage.getItem("telektro-theme");if(t!=="dark"&&t!=="light")t="light";document.documentElement.dataset.theme=t}catch(e){document.documentElement.dataset.theme="light"}`;

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="pt-BR" suppressHydrationWarning><head><script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }}/><script async src={`https://www.googletagmanager.com/gtag/js?id=${GOOGLE_ADS_ID}`}/><script dangerouslySetInnerHTML={{ __html: GOOGLE_ADS_SNIPPET }}/></head><body><PwaInstallButton/>{children}</body></html>;
}
