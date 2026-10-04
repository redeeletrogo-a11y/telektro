import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { settleRefunds } from "@/lib/eletroposto";

export const dynamic = "force-dynamic";

// Varredura: expira pagamentos, fecha recargas terminadas e devolve sobras. Protegida por CRON_SECRET (Authorization: Bearer ...).
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return NextResponse.json({ error: "not_configured" }, { status: 503 });
  const given = Buffer.from(request.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${secret}`);
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try {
    return NextResponse.json({ ok: true, settled: await settleRefunds() });
  } catch {
    return NextResponse.json({ error: "sweep_failed" }, { status: 500 });
  }
}
