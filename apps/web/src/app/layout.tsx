import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Telektro — Operação de recarga",
  description: "Plataforma de operação de infraestrutura de recarga elétrica.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="pt-BR"><body>{children}</body></html>;
}
