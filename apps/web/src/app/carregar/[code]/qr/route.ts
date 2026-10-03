import QRCode from "qrcode";
import { NextResponse } from "next/server";
import { isValidCode } from "@/lib/eletroposto";
import { SITE_URL } from "@/lib/site";

export const dynamic = "force-dynamic";

// PNG do QR Code do ponto (para imprimir e colar no carregador). Aponta sempre para o dominio oficial.
export async function GET(_request: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  if (!isValidCode(code)) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const png = await QRCode.toBuffer(`${SITE_URL}/carregar/${code}`, { type: "png", width: 640, margin: 2, errorCorrectionLevel: "M" });
  return new NextResponse(new Uint8Array(png), { headers: { "Content-Type": "image/png", "Cache-Control": "public, max-age=86400" } });
}
