import { createHash } from "node:crypto";
import { mpFetch } from "@/lib/billing";
import { serviceClient } from "@/lib/pix";

// Eletroposto pre-pago por QR (piloto). Toda a regra de dinheiro fica no banco (migration 202610030020) e aqui,
// sempre no servidor. O navegador nunca recebe chaves nem decide valores.
const tokenPattern = /^[0-9a-f]{48}$/;
const codePattern = /^[a-z0-9]{8,32}$/;
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const EP_REF_PREFIX = "ep:";
export const isValidToken = (value: string) => tokenPattern.test(value);
export const isValidCode = (value: string) => codePattern.test(value);

export function hashIp(ip: string) {
  return createHash("sha256").update(`${process.env.EPOSTO_IP_SALT ?? "telektro"}:${ip}`).digest("hex").slice(0, 32);
}

// Valor em reais com no maximo 2 casas. Aceita "25", "25,5", "25.50". Retorna null se invalido.
export function parseAmount(raw: string): number | null {
  const text = raw.trim().replace(",", ".");
  if (!/^\d{1,4}(\.\d{1,2})?$/.test(text)) return null;
  const value = Number(text);
  return Number.isFinite(value) && value > 0 ? Math.round(value * 100) / 100 : null;
}

export type PointInfo = {
  code: string; chargerName: string; siteName: string; connectorId: number; minAmount: number; maxAmount: number;
  pricePerKwh: number | null; sessionFee: number; available: boolean; reason: string | null;
};

// Dados publicos do ponto (so o necessario para a tela do QR).
export async function getPointInfo(code: string): Promise<PointInfo | null> {
  if (!codePattern.test(code)) return null;
  const supabase = serviceClient();
  const { data: point } = await supabase.from("eletroposto_points").select("public_code, organization_id, charger_id, connector_id, min_amount, max_amount, enabled").eq("public_code", code).eq("enabled", true).maybeSingle();
  if (!point) return null;
  const { data: charger } = await supabase.from("chargers").select("id, site_id, charge_point_id, status, online, last_heartbeat_at, removed_at").eq("id", point.charger_id).maybeSingle();
  if (!charger || charger.removed_at) return null;
  const [{ data: site }, { data: connector }, { data: tariffs }, { data: org }] = await Promise.all([
    supabase.from("sites").select("name").eq("id", charger.site_id).maybeSingle(),
    supabase.from("connectors").select("status").eq("charger_id", charger.id).eq("connector_id", point.connector_id).maybeSingle(),
    supabase.from("tariffs").select("price_per_kwh, session_fee, site_id, valid_from, valid_until").eq("organization_id", point.organization_id).eq("active", true).eq("currency", "BRL").gt("price_per_kwh", 0).order("valid_from", { ascending: false }),
    supabase.from("organizations").select("account_type").eq("id", point.organization_id).maybeSingle(),
  ]);
  if (org?.account_type !== "eletroposto") return null;
  const now = Date.now();
  const valid = (tariffs ?? []).filter((t) => new Date(t.valid_from).getTime() <= now && (!t.valid_until || new Date(t.valid_until).getTime() > now) && (t.site_id === null || t.site_id === charger.site_id));
  const tariff = valid.find((t) => t.site_id === charger.site_id) ?? valid[0] ?? null;
  const fresh = charger.online && charger.last_heartbeat_at && new Date(charger.last_heartbeat_at).getTime() > now - 180_000;
  const status = String(connector?.status ?? charger.status);
  let reason: string | null = null;
  if (!tariff) reason = "Este ponto ainda não tem tarifa definida.";
  else if (!fresh) reason = "O carregador está sem comunicação no momento. Tente novamente em instantes.";
  else if (!["Available", "Preparing"].includes(status)) reason = status === "Charging" ? "Este carregador está em uso." : "Este conector não está disponível agora.";
  return {
    code, chargerName: charger.charge_point_id, siteName: site?.name ?? "", connectorId: point.connector_id,
    minAmount: Number(point.min_amount), maxAmount: Number(point.max_amount),
    pricePerKwh: tariff ? Number(tariff.price_per_kwh) : null, sessionFee: tariff ? Number(tariff.session_fee) : 0,
    available: reason === null, reason,
  };
}

export const createErrorMessages: Record<string, string> = {
  POINT_NOT_FOUND: "Ponto de recarga não encontrado.",
  AMOUNT_INVALID: "Valor fora do permitido para este ponto.",
  REGISTRATION_INVALID: "Confira seu nome e e-mail.",
  RATE_LIMITED: "Muitas tentativas seguidas. Aguarde alguns minutos.",
  CHARGER_OFFLINE: "O carregador está sem comunicação no momento. Tente novamente em instantes.",
  CONNECTOR_UNAVAILABLE: "Este conector não está disponível. Conecte o carro e tente de novo.",
  CONNECTOR_BUSY: "Este conector já está em uso.",
  NO_TARIFF: "Este ponto ainda não tem tarifa definida.",
};

export type CreateResult = { token: string } | { error: string };

// Cria o pagamento (valida no banco) e o Pix no Mercado Pago. O valor vem do banco, nunca do navegador depois de validado.
export async function createEletropostoPayment(args: { code: string; name: string; email: string; phone: string; amount: number; ipHash: string; origin: string }): Promise<CreateResult> {
  const supabase = serviceClient();
  const { data, error } = await supabase.rpc("eletroposto_create_payment", { p_code: args.code, p_name: args.name, p_email: args.email, p_phone: args.phone, p_amount: args.amount, p_ip_hash: args.ipHash });
  if (error) {
    const key = Object.keys(createErrorMessages).find((k) => error.message?.includes(k));
    return { error: key ? createErrorMessages[key] : "Não foi possível iniciar o pagamento agora." };
  }
  const row = Array.isArray(data) ? data[0] : data;
  const paymentId = String(row?.payment_id ?? "");
  const token = String(row?.public_token ?? "");
  if (!uuidPattern.test(paymentId) || !tokenPattern.test(token)) return { error: "Não foi possível iniciar o pagamento agora." };
  try {
    const { data: stored } = await supabase.from("eletroposto_payments").select("cap_amount, expires_at").eq("id", paymentId).single();
    const bypass = process.env.VERCEL_AUTOMATION_BYPASS_SECRET;
    const notificationUrl = new URL("/api/billing/mercadopago/webhook", args.origin);
    if (bypass) notificationUrl.searchParams.set("x-vercel-protection-bypass", bypass);
    const payment = await mpFetch("/v1/payments", {
      method: "POST",
      headers: { "X-Idempotency-Key": paymentId },
      body: JSON.stringify({
        transaction_amount: Number(stored!.cap_amount),
        description: "Telektro - recarga de veículo elétrico (valor máximo, sobra devolvida)",
        payment_method_id: "pix",
        external_reference: `${EP_REF_PREFIX}${paymentId}`,
        notification_url: notificationUrl.toString(),
        date_of_expiration: new Date(stored!.expires_at).toISOString().replace("Z", "+00:00"),
        payer: { email: process.env.MERCADOPAGO_PAYER_EMAIL_OVERRIDE || args.email },
      }),
    });
    const tx = payment?.point_of_interaction?.transaction_data ?? {};
    if (!payment.id || !tx.qr_code) throw new Error("pix_no_qr");
    const { error: updateError } = await supabase.from("eletroposto_payments").update({ mp_payment_id: String(payment.id), qr_code: String(tx.qr_code), qr_code_base64: tx.qr_code_base64 ? String(tx.qr_code_base64) : null, updated_at: new Date().toISOString() }).eq("id", paymentId).eq("status", "awaiting_payment");
    if (updateError) throw new Error("update_failed");
    return { token };
  } catch {
    await supabase.from("eletroposto_payments").update({ status: "expired", updated_at: new Date().toISOString() }).eq("id", paymentId).eq("status", "awaiting_payment");
    return { error: "Não foi possível gerar o Pix agora. Tente novamente em instantes." };
  }
}

// Chamado pelo webhook do Mercado Pago. Retorna null se NAO for um pagamento de eletroposto (sem tocar no banco),
// para o fluxo de mensalidade continuar igual. O pagamento e sempre relido no Mercado Pago (nunca confia no corpo da notificacao).
export async function applyEletropostoPayment(paymentId: string): Promise<string | null> {
  const payment = await mpFetch(`/v1/payments/${encodeURIComponent(paymentId)}`);
  const reference = String(payment.external_reference ?? "");
  if (!reference.startsWith(EP_REF_PREFIX)) return null;
  const id = reference.slice(EP_REF_PREFIX.length);
  if (!uuidPattern.test(id) || payment.payment_method_id !== "pix") return "ignored";
  const supabase = serviceClient();
  const { data: row } = await supabase.from("eletroposto_payments").select("id, mp_payment_id, cap_amount, status").eq("id", id).maybeSingle();
  if (!row || row.mp_payment_id !== String(payment.id)) return "ignored";
  if (payment.status !== "approved") {
    if (["cancelled", "expired", "rejected"].includes(String(payment.status))) await supabase.from("eletroposto_payments").update({ status: "expired", updated_at: new Date().toISOString() }).eq("id", id).eq("status", "awaiting_payment");
    return "pending";
  }
  // Valor e moeda precisam bater com o que foi cobrado; senao nada e liberado.
  if (Number(payment.transaction_amount) !== Number(row.cap_amount) || (payment.currency_id && payment.currency_id !== "BRL")) return "ignored";
  const { data: outcome, error } = await supabase.rpc("eletroposto_mark_paid", { p_id: id, p_mp_payment_id: String(payment.id), p_amount: Number(row.cap_amount) });
  if (error) throw new Error("mark_paid_failed");
  await settleRefunds(id);
  return String(outcome);
}

// Avanca estados (tempo/fim da sessao) e devolve a sobra. Seguro de repetir: idempotente no banco e no Mercado Pago.
export async function settleRefunds(onlyId?: string): Promise<number> {
  const supabase = serviceClient();
  await supabase.rpc("eletroposto_advance", { p_id: onlyId ?? null });
  let query = supabase.from("eletroposto_payments").select("id, mp_payment_id, cap_amount, charged_amount, refund_amount").eq("status", "settling").limit(25);
  if (onlyId) query = query.eq("id", onlyId);
  const { data: rows } = await query;
  let done = 0;
  for (const row of rows ?? []) {
    const refund = Math.round(Number(row.refund_amount ?? 0) * 100) / 100;
    const nowIso = new Date().toISOString();
    if (refund <= 0) {
      await supabase.from("eletroposto_payments").update({ status: "settled", settled_at: nowIso, updated_at: nowIso }).eq("id", row.id).eq("status", "settling");
      done += 1;
      continue;
    }
    try {
      const full = refund >= Number(row.cap_amount);
      const result = await mpFetch(`/v1/payments/${encodeURIComponent(String(row.mp_payment_id))}/refunds`, {
        method: "POST",
        headers: { "X-Idempotency-Key": `ep-refund-${row.id}` },
        body: JSON.stringify(full ? {} : { amount: refund }),
      });
      await supabase.from("eletroposto_payments").update({ status: "settled", refund_id: result?.id ? String(result.id) : null, settled_at: nowIso, last_error: null, updated_at: nowIso }).eq("id", row.id).eq("status", "settling");
      done += 1;
    } catch (caught) {
      // Fica em "settling" e a proxima varredura tenta de novo; o dono ve o alerta.
      await supabase.from("eletroposto_payments").update({ last_error: caught instanceof Error ? caught.message.slice(0, 120) : "refund_failed", needs_attention: true, attention_reason: "refund_failed", updated_at: nowIso }).eq("id", row.id);
    }
  }
  return done;
}

export type PublicStatus = {
  status: string; cap: number; kwh: number | null; spent: number | null; charged: number | null; refund: number | null;
  qrCode: string | null; qrBase64: string | null; expiresAt: string | null; reason: string | null; canStop: boolean; chargerName: string; pricePerKwh: number;
};

export async function getPublicStatus(token: string, advance = true): Promise<PublicStatus | null> {
  if (!tokenPattern.test(token)) return null;
  const supabase = serviceClient();
  const base = await supabase.from("eletroposto_payments").select("id").eq("public_token", token).maybeSingle();
  if (!base.data) return null;
  if (advance) { try { await settleRefunds(base.data.id); } catch { /* o estado atual ainda e mostrado */ } }
  const { data: p } = await supabase.from("eletroposto_payments").select("status, cap_amount, price_per_kwh, session_fee, energy_wh, charged_amount, refund_amount, refund_reason, qr_code, qr_code_base64, expires_at, charger_id, session_id").eq("id", base.data.id).single();
  if (!p) return null;
  const { data: charger } = await supabase.from("chargers").select("charge_point_id").eq("id", p.charger_id).maybeSingle();
  const kwh = p.energy_wh === null ? null : Number(p.energy_wh) / 1000;
  const spent = kwh === null ? null : Math.min(Number(p.cap_amount), Math.round((kwh * Number(p.price_per_kwh) + (kwh > 0 ? Number(p.session_fee) : 0)) * 100) / 100);
  return {
    status: p.status, cap: Number(p.cap_amount), kwh, spent,
    charged: p.charged_amount === null ? null : Number(p.charged_amount), refund: p.refund_amount === null ? null : Number(p.refund_amount),
    qrCode: p.status === "awaiting_payment" ? p.qr_code : null, qrBase64: p.status === "awaiting_payment" ? p.qr_code_base64 : null,
    expiresAt: p.expires_at, reason: p.refund_reason, canStop: p.status === "charging" && Boolean(p.session_id),
    chargerName: charger?.charge_point_id ?? "", pricePerKwh: Number(p.price_per_kwh),
  };
}

export async function requestStop(token: string): Promise<string> {
  if (!tokenPattern.test(token)) return "not_charging";
  const { data } = await serviceClient().rpc("eletroposto_request_stop", { p_token: token });
  return String(data ?? "not_charging");
}
