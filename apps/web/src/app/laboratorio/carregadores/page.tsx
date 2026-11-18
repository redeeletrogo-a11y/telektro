import type { Metadata } from "next";
import { ChargerLab } from "@/components/charger-lab";
export const metadata: Metadata = {
  title: "Laboratório de carregadores",
  robots: { index: false, follow: false },
  alternates: { canonical: "/laboratorio/carregadores" },
};
export default function Page() {
  return <ChargerLab />;
}
