"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { eletropostoAccessToken } from "@/lib/billing";
import { createEletropostoPayment, getPublicStatus, hashIp, isValidCode, isValidToken, parseAmount, requestStop, type PublicStatus } from "@/lib/eletroposto";

export type StartState = { error?: string };

export async function startEletropostoPayment(code: string, _previous: StartState, formData: FormData): Promise<StartState> {
  void _previous;
  if (!isValidCode(code)) return { error: "Ponto de recarga inválido." };
  if (!formData.get("consent")) return { error: "Aceite os termos para continuar." };
  const amount = parseAmount(String(formData.get("amount") ?? ""));
  if (amount === null) return { error: "Informe um valor válido em reais." };
  const name = String(formData.get("name") ?? "").trim().slice(0, 120);
  const email = String(formData.get("email") ?? "").trim().slice(0, 200);
  const phone = String(formData.get("phone") ?? "").trim().slice(0, 30);
  if (!eletropostoAccessToken()) return { error: "Pagamento online indisponível no momento." };
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host");
  if (!host) return { error: "Não foi possível iniciar o pagamento." };
  const ip = (requestHeaders.get("x-forwarded-for") ?? "").split(",")[0].trim() || "unknown";
  const result = await createEletropostoPayment({ code, name, email, phone, amount, ipHash: hashIp(ip), origin: `https://${host}` });
  if ("error" in result) return { error: result.error };
  redirect(`/carregar/pagamento/${result.token}`);
}

export async function eletropostoStatus(token: string): Promise<PublicStatus | null> {
  if (!isValidToken(token)) return null;
  return getPublicStatus(token);
}

export async function eletropostoStop(token: string): Promise<{ result: string }> {
  if (!isValidToken(token)) return { result: "not_charging" };
  return { result: await requestStop(token) };
}
