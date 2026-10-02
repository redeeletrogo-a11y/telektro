import { ImageResponse } from "next/og";

export const alt = "Telektro: gestão de eletroposto e carregador elétrico";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "center", padding: 80, background: "#0b1f1d", color: "white" }}>
      <div style={{ display: "flex", alignItems: "center", fontSize: 40, fontWeight: 700, letterSpacing: 6, color: "#bcebd1" }}>TELEKTRO</div>
      <div style={{ display: "flex", marginTop: 28, fontSize: 76, fontWeight: 700, lineHeight: 1.1 }}>Gestão de eletroposto e carregador elétrico</div>
      <div style={{ display: "flex", marginTop: 28, fontSize: 34, color: "#9fb8b3" }}>Casa, condomínio e eletroposto. Teste grátis por 7 dias.</div>
    </div>,
    size,
  );
}
