import { createHash } from "node:crypto";
import { eletropostoAccessToken, mpFetch } from "@/lib/billing";

const epFetch = (path: string, init?: RequestInit) => mpFetch(path, init, eletropostoAccessToken());
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
  const fresh = charger.online && charger.last_heartbeat_at && new Date(charger.last_heartbeat_at).getTime() > now - 75_000;
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

// Dados extras recomendados pelo Mercado Pago (qualidade da integracao): item e nome do pagador melhoram a aprovacao e a antifraude.
function mpPayerAndItems(name: string, email: string, amount: number, place: string) {
  const parts = name.trim().split(/\s+/);
  const firstName = parts[0] ?? "";
  const lastName = parts.length > 1 ? parts.slice(1).join(" ") : parts[0] ?? "";
  return {
    payer: { email: process.env.MERCADOPAGO_PAYER_EMAIL_OVERRIDE || email, first_name: firstName.slice(0, 60), last_name: lastName.slice(0, 60) },
    additional_info: { items: [{ id: "recarga-eletroposto", title: "Recarga eletroposto", description: `Recarga eletroposto ${place}`.slice(0, 200), category_id: "services", quantity: 1, unit_price: amount }] },
  };
}

export type CreateResult = { token: string } | { error: string };
export type CardInput = { token: string; paymentMethodId: string; issuerId: string | null; deviceId: string | null };
const cardTokenPattern = /^[A-Za-z0-9_-]{16,128}$/;
const cardMethodPattern = /^[a-z0-9_]{2,30}$/;

// Cria o pagamento (valida no banco) e o Pix no Mercado Pago. O valor vem do banco, nunca do navegador depois de validado.
export async function createEletropostoPayment(args: { code: string; name: string; email: string; phone: string; amount: number; ipHash: string; origin: string; card?: CardInput }): Promise<CreateResult> {
  const method = args.card ? "card" : "pix";
  if (args.card && (!cardTokenPattern.test(args.card.token) || !cardMethodPattern.test(args.card.paymentMethodId))) return { error: "Dados do cartão inválidos. Tente de novo." };
  const supabase = serviceClient();
  // Janela de frescor do heartbeat mais curta que a do banco (180 s): evita aceitar Pix com carregador recém-caído.
  const pre = await getPointInfo(args.code).catch(() => null);
  if (pre && !pre.available && pre.reason) return { error: pre.reason };
  const { data, error } = await supabase.rpc("eletroposto_create_payment", { p_code: args.code, p_name: args.name, p_email: args.email, p_phone: args.phone, p_amount: args.amount, p_ip_hash: args.ipHash, ...(method === "card" ? { p_method: "card" } : {}) });
  if (error) {
    const key = Object.keys(createErrorMessages).find((k) => error.message?.includes(k));
    return { error: key ? createErrorMessages[key] : "Não foi possível iniciar o pagamento agora." };
  }
  const row = Array.isArray(data) ? data[0] : data;
  const paymentId = String(row?.payment_id ?? "");
  const token = String(row?.public_token ?? "");
  if (!uuidPattern.test(paymentId) || !tokenPattern.test(token)) return { error: "Não foi possível iniciar o pagamento agora." };
  if (args.card) return createCardReservation(paymentId, token, { ...args, card: args.card, place: pre?.siteName || pre?.chargerName || "Telektro" });
  try {
    const { data: stored } = await supabase.from("eletroposto_payments").select("cap_amount, expires_at").eq("id", paymentId).single();
    const bypass = process.env.VERCEL_AUTOMATION_BYPASS_SECRET;
    const notificationUrl = new URL("/api/billing/mercadopago/webhook", args.origin);
    if (bypass) notificationUrl.searchParams.set("x-vercel-protection-bypass", bypass);
    const payment = await epFetch("/v1/payments", {
      method: "POST",
      headers: { "X-Idempotency-Key": paymentId },
      body: JSON.stringify({
        transaction_amount: Number(stored!.cap_amount),
        description: "Telektro - recarga de veículo elétrico (valor máximo, sobra devolvida)",
        payment_method_id: "pix",
        external_reference: `${EP_REF_PREFIX}${paymentId}`,
        notification_url: notificationUrl.toString(),
        date_of_expiration: new Date(stored!.expires_at).toISOString().replace("Z", "+00:00"),
        ...mpPayerAndItems(args.name, args.email, Number(stored!.cap_amount), pre?.siteName || pre?.chargerName || "Telektro"),
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

// Cartao: reserva o valor maximo (capture=false, 1x). So a reserva autorizada libera a recarga; no fim captura-se SO o consumo.
async function createCardReservation(paymentId: string, token: string, args: { name: string; email: string; origin: string; card: CardInput; place: string }): Promise<CreateResult> {
  const supabase = serviceClient();
  const fail = async (message: string): Promise<CreateResult> => {
    await supabase.from("eletroposto_payments").update({ status: "expired", updated_at: new Date().toISOString() }).eq("id", paymentId).eq("status", "awaiting_payment");
    return { error: message };
  };
  try {
    const { data: stored } = await supabase.from("eletroposto_payments").select("cap_amount").eq("id", paymentId).single();
    const bypass = process.env.VERCEL_AUTOMATION_BYPASS_SECRET;
    const notificationUrl = new URL("/api/billing/mercadopago/webhook", args.origin);
    if (bypass) notificationUrl.searchParams.set("x-vercel-protection-bypass", bypass);
    const headers: Record<string, string> = { "X-Idempotency-Key": `ep-card-${paymentId}` };
    if (args.card.deviceId && /^[A-Za-z0-9_-]{8,128}$/.test(args.card.deviceId)) headers["X-meli-session-id"] = args.card.deviceId;
    const payment = await epFetch("/v1/payments", {
      method: "POST",
      headers,
      body: JSON.stringify({
        transaction_amount: Number(stored!.cap_amount),
        capture: false,
        installments: 1,
        token: args.card.token,
        payment_method_id: args.card.paymentMethodId,
        ...(args.card.issuerId && /^[0-9]{1,10}$/.test(args.card.issuerId) ? { issuer_id: Number(args.card.issuerId) } : {}),
        description: "Telektro - recarga de veículo elétrico (reserva do valor máximo, cobra só o consumo)",
        statement_descriptor: "TELEKTRO",
        external_reference: `${EP_REF_PREFIX}${paymentId}`,
        notification_url: notificationUrl.toString(),
        binary_mode: true,
        ...mpPayerAndItems(args.name, args.email, Number(stored!.cap_amount), args.place),
      }),
    });
    if (!payment?.id) throw new Error("card_no_id");
    const card = payment.card ?? {};
    const { error: updateError } = await supabase.from("eletroposto_payments").update({
      mp_payment_id: String(payment.id), card_last4: /^[0-9]{4}$/.test(String(card.last_four_digits ?? "")) ? String(card.last_four_digits) : null,
      card_brand: String(payment.payment_method_id ?? "").slice(0, 30) || null, updated_at: new Date().toISOString(),
    }).eq("id", paymentId).eq("status", "awaiting_payment");
    if (updateError) throw new Error("update_failed");
    if (payment.status === "rejected") return await fail("O cartão foi recusado. Confira os dados ou tente outro cartão.");
    // Reserva autorizada: libera a recarga agora (mesmo caminho do Pix). Pendente: o webhook/pagina concluem depois.
    if (payment.status === "authorized") await applyEletropostoPayment(String(payment.id));
    return { token };
  } catch {
    return await fail("Não foi possível reservar o valor no cartão agora. Tente de novo ou use o Pix.");
  }
}

// Chamado pelo webhook do Mercado Pago. Retorna null se NAO for um pagamento de eletroposto (sem tocar no banco),
// para o fluxo de mensalidade continuar igual. O pagamento e sempre relido no Mercado Pago (nunca confia no corpo da notificacao).
export async function applyEletropostoPayment(paymentId: string): Promise<string | null> {
  let payment;
  try { payment = await epFetch(`/v1/payments/${encodeURIComponent(paymentId)}`); }
  catch (error) {
    // Pagamento de outra aplicacao do Mercado Pago (ex.: mensalidade): nao e do eletroposto, segue o outro fluxo.
    if (error instanceof Error && ["mercadopago_404", "mercadopago_403", "mercadopago_401"].includes(error.message) && eletropostoAccessToken() !== (process.env.MERCADOPAGO_ACCESS_TOKEN ?? "")) return null;
    throw error;
  }
  const reference = String(payment.external_reference ?? "");
  if (!reference.startsWith(EP_REF_PREFIX)) return null;
  const id = reference.slice(EP_REF_PREFIX.length);
  if (!uuidPattern.test(id)) return "ignored";
  const supabase = serviceClient();
  const { data: row } = await supabase.from("eletroposto_payments").select("id, mp_payment_id, cap_amount, status, payment_method").eq("id", id).maybeSingle();
  if (!row || row.mp_payment_id !== String(payment.id)) return "ignored";
  const isCard = row.payment_method === "card";
  if (isCard === (payment.payment_method_id === "pix")) return "ignored";
  if (isCard && payment.status === "charged_back") {
    await supabase.from("eletroposto_payments").update({ needs_attention: true, attention_reason: "chargeback", updated_at: new Date().toISOString() }).eq("id", id);
    return "chargeback";
  }
  // Pix paga = approved. Cartao com reserva = authorized (capture=false); approved so aparece se alguem capturou por fora.
  const paidStatus = isCard ? ["authorized", "approved"].includes(String(payment.status)) : payment.status === "approved";
  if (!paidStatus) {
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
  let query = supabase.from("eletroposto_payments").select("id, mp_payment_id, cap_amount, charged_amount, refund_amount, paid_at, payment_method, fee_pct").eq("status", "settling").limit(25);
  if (onlyId) query = query.eq("id", onlyId);
  const { data: rows } = await query;
  let done = 0;
  for (const row of rows ?? []) {
    const refund = Math.round(Number(row.refund_amount ?? 0) * 100) / 100;
    const charged = Math.round(Number(row.charged_amount ?? 0) * 100) / 100;
    const nowIso = new Date().toISOString();
    // Taxa da plataforma: snapshot do percentual do ponto sobre o valor efetivamente cobrado.
    const feeAmount = row.fee_pct === null || row.fee_pct === undefined ? null : Math.round(charged * Number(row.fee_pct)) / 100;
    if (row.payment_method === "card") {
      // Cartao: captura so o consumo (parcial) ou cancela a reserva se nada foi consumido. Sem reembolso, a sobra volta ao limite.
      try {
        if (charged > 0) {
          await epFetch(`/v1/payments/${encodeURIComponent(String(row.mp_payment_id))}`, { method: "PUT", headers: { "X-Idempotency-Key": `ep-capture-${row.id}` }, body: JSON.stringify({ transaction_amount: charged, capture: true }) });
        } else {
          await epFetch(`/v1/payments/${encodeURIComponent(String(row.mp_payment_id))}`, { method: "PUT", headers: { "X-Idempotency-Key": `ep-cancel-${row.id}` }, body: JSON.stringify({ status: "cancelled" }) });
        }
        await supabase.from("eletroposto_payments").update({ status: "settled", fee_amount: feeAmount, settled_at: nowIso, last_error: null, needs_attention: false, attention_reason: null, updated_at: nowIso }).eq("id", row.id).eq("status", "settling");
        done += 1;
      } catch (caught) {
        // A reserva vale 5 dias: a proxima visita/varredura tenta de novo e o dono ve o alerta.
        await supabase.from("eletroposto_payments").update({ last_error: caught instanceof Error ? caught.message.slice(0, 120) : "capture_failed", needs_attention: true, attention_reason: "card_capture_failed", updated_at: nowIso }).eq("id", row.id);
      }
      continue;
    }
    if (refund <= 0) {
      await supabase.from("eletroposto_payments").update({ status: "settled", fee_amount: feeAmount, settled_at: nowIso, updated_at: nowIso }).eq("id", row.id).eq("status", "settling");
      done += 1;
      continue;
    }
    // O Mercado Pago recusa reembolso de Pix logo apos a aprovacao; espera ~60 s antes da 1a tentativa (a proxima visita/varredura tenta).
    if (row.paid_at && Date.now() - new Date(String(row.paid_at)).getTime() < 60_000) continue;
    try {
      const full = refund >= Number(row.cap_amount);
      const result = await epFetch(`/v1/payments/${encodeURIComponent(String(row.mp_payment_id))}/refunds`, {
        method: "POST",
        headers: { "X-Idempotency-Key": `ep-refund-${row.id}` },
        body: JSON.stringify(full ? {} : { amount: refund }),
      });
      await supabase.from("eletroposto_payments").update({ status: "settled", fee_amount: feeAmount, refund_id: result?.id ? String(result.id) : null, settled_at: nowIso, last_error: null, needs_attention: false, attention_reason: null, updated_at: nowIso }).eq("id", row.id).eq("status", "settling");
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
  method: "pix" | "card"; cardLast4: string | null; cardBrand: string | null;
};

export async function getPublicStatus(token: string, advance = true): Promise<PublicStatus | null> {
  if (!tokenPattern.test(token)) return null;
  const supabase = serviceClient();
  const base = await supabase.from("eletroposto_payments").select("id, status, mp_payment_id").eq("public_token", token).maybeSingle();
  if (!base.data) return null;
  // Rede de seguranca: se o webhook atrasou ou nao chegou, releia o Pix no Mercado Pago (idempotente; so enquanto aguarda pagamento).
  if (advance && base.data.status === "awaiting_payment" && base.data.mp_payment_id) { try { await applyEletropostoPayment(String(base.data.mp_payment_id)); } catch { /* o webhook ainda pode concluir */ } }
  if (advance) { try { await settleRefunds(base.data.id); } catch { /* o estado atual ainda e mostrado */ } }
  const { data: p } = await supabase.from("eletroposto_payments").select("status, cap_amount, price_per_kwh, session_fee, energy_wh, charged_amount, refund_amount, refund_reason, qr_code, qr_code_base64, expires_at, charger_id, session_id, payment_method, card_last4, card_brand").eq("id", base.data.id).single();
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
    method: p.payment_method === "card" ? "card" : "pix", cardLast4: p.card_last4 ?? null, cardBrand: p.card_brand ?? null,
  };
}

export async function requestStop(token: string): Promise<string> {
  if (!tokenPattern.test(token)) return "not_charging";
  const { data } = await serviceClient().rpc("eletroposto_request_stop", { p_token: token });
  return String(data ?? "not_charging");
}
