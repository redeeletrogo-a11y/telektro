import QRCode from "qrcode";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { serviceClient } from "@/lib/pix";
import { getPointInfo, isValidCode } from "@/lib/eletroposto";
import { SITE_URL } from "@/lib/site";
import { PrintButton } from "./print-button";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Placa do carregador", robots: { index: false, follow: false } };

// Placa para imprimir e colar no carregador. So o dono/admin da conta enxerga (o QR em si e publico).
export default async function PlacaPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  if (!isValidCode(code)) notFound();
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: point } = await serviceClient().from("eletroposto_points").select("organization_id").eq("public_code", code).maybeSingle();
  if (!point) notFound();
  const { data: membership } = await supabase.from("memberships").select("role").eq("organization_id", point.organization_id).eq("user_id", user.id).maybeSingle();
  if (!membership || !["owner", "admin"].includes(membership.role)) notFound();
  const info = await getPointInfo(code);
  const url = `${SITE_URL}/carregar/${code}`;
  const qr = await QRCode.toDataURL(url, { width: 900, margin: 1, errorCorrectionLevel: "M" });
  const price = info?.pricePerKwh ? info.pricePerKwh.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : null;
  return <main className="placa-page">
    <style>{`
      .placa-page { min-height: 100vh; background: #eef1f2; display: grid; justify-items: center; gap: 16px; padding: 20px 12px 40px; font-family: system-ui, -apple-system, Segoe UI, sans-serif; color: #12262e; }
      .placa-tools { display: flex; gap: 10px; flex-wrap: wrap; justify-content: center; }
      .placa-btn, .placa-link { min-height: 44px; padding: 0 18px; border-radius: 10px; border: 1px solid #0f7a6a; background: #0f7a6a; color: #fff; font: inherit; font-weight: 650; display: inline-flex; align-items: center; text-decoration: none; cursor: pointer; }
      .placa-link { background: #fff; color: #0f7a6a; }
      .placa-sheet { width: min(100%, 560px); aspect-ratio: 148 / 210; background: #fff; border-radius: 14px; box-shadow: 0 6px 24px rgb(0 0 0 / 12%); padding: 6% 7%; display: grid; grid-template-rows: auto auto 1fr auto auto; gap: 3%; text-align: center; }
      .placa-brand { font-weight: 800; letter-spacing: 0.18em; color: #0f7a6a; font-size: clamp(14px, 3.4vw, 20px); }
      .placa-title { margin: 0; font-size: clamp(22px, 6vw, 34px); line-height: 1.1; }
      .placa-sub { margin: 4px 0 0; color: #4b5d66; font-size: clamp(12px, 3vw, 16px); }
      .placa-qr { display: grid; place-items: center; }
      .placa-qr img { width: 100%; max-width: 78%; height: auto; image-rendering: pixelated; }
      .placa-steps { margin: 0; padding: 0; list-style: none; display: grid; gap: 6px; font-size: clamp(12px, 3.2vw, 16px); text-align: left; }
      .placa-steps b { display: inline-grid; place-items: center; width: 1.6em; height: 1.6em; border-radius: 50%; background: #0f7a6a; color: #fff; margin-right: 8px; font-size: 0.9em; }
      .placa-foot { font-size: clamp(11px, 2.8vw, 14px); color: #4b5d66; }
      .placa-price { font-weight: 750; color: #12262e; }
      @media print { .placa-page { background: #fff; padding: 0; } .placa-tools { display: none; } .placa-sheet { box-shadow: none; border-radius: 0; width: 148mm; height: 210mm; aspect-ratio: auto; } @page { size: A5; margin: 0; } }
    `}</style>
    <div className="placa-tools"><PrintButton/><Link className="placa-link" href="/">Voltar ao painel</Link></div>
    <section className="placa-sheet" aria-label="Placa do carregador">
      <div className="placa-brand">TELEKTRO</div>
      <div><h1 className="placa-title">Recarga sem app</h1><p className="placa-sub">{info ? `${info.siteName} · ${info.chargerName}` : ""}</p></div>
      <div className="placa-qr"><img src={qr} alt="QR Code para pagar e liberar a recarga"/></div>
      <ol className="placa-steps"><li><b>1</b>Escaneie o QR com a câmera do celular</li><li><b>2</b>Escolha o valor e pague com Pix ou cartão</li><li><b>3</b>Conecte o carro: a recarga libera sozinha</li></ol>
      <div className="placa-foot">{price ? <span className="placa-price">{price} por kWh · </span> : null}Você paga só o que consumir, a sobra volta pra você.<br/>{url.replace("https://", "")}</div>
    </section>
  </main>;
}
