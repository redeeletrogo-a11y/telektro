import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { eletropostoAccessToken } from "@/lib/billing";
import { serviceClient } from "@/lib/pix";

const MP_AUTH_URL = "https://auth.mercadopago.com/authorization";
const MP_TOKEN_URL = "https://api.mercadopago.com/oauth/token";
const STATE_TTL_MS = 15 * 60_000;
const REFRESH_BEFORE_MS = 24 * 3600_000;

const base64Url = (value: Buffer | string) => Buffer.from(value).toString("base64url");
const fromBase64Url = (value: string) => Buffer.from(value, "base64url");

function oauthSecret() {
  const secret = process.env.MERCADOPAGO_OAUTH_TOKEN_SECRET;
  if (!secret || secret.length < 32) throw new Error("mercadopago_oauth_secret_missing");
  return createHash("sha256").update(secret).digest();
}

function encryptSecret(value: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", oauthSecret(), iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  return ["v1", iv.toString("base64url"), cipher.getAuthTag().toString("base64url"), encrypted.toString("base64url")].join(".");
}

function decryptSecret(value: string) {
  const [version, iv, tag, encrypted] = value.split(".");
  if (version !== "v1" || !iv || !tag || !encrypted) throw new Error("mercadopago_oauth_secret_invalid");
  const decipher = createDecipheriv("aes-256-gcm", oauthSecret(), fromBase64Url(iv));
  decipher.setAuthTag(fromBase64Url(tag));
  return Buffer.concat([decipher.update(fromBase64Url(encrypted)), decipher.final()]).toString("utf8");
}

function signature(payload: string) {
  return createHmac("sha256", oauthSecret()).update(payload).digest("base64url");
}

export function mercadoPagoOAuthConfigured() {
  return Boolean(process.env.MERCADOPAGO_MARKETPLACE_CLIENT_ID && process.env.MERCADOPAGO_MARKETPLACE_CLIENT_SECRET && (process.env.MERCADOPAGO_OAUTH_TOKEN_SECRET ?? "").length >= 32);
}

export function createMercadoPagoState(organizationId: string) {
  const payload = base64Url(JSON.stringify({ v: 1, org: organizationId, nonce: randomBytes(12).toString("base64url"), exp: Date.now() + STATE_TTL_MS }));
  return `${payload}.${signature(payload)}`;
}

export function readMercadoPagoState(state: string) {
  const [payload, received] = state.split(".");
  if (!payload || !received) return null;
  const expected = Buffer.from(signature(payload), "utf8");
  const given = Buffer.from(received, "utf8");
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
  try {
    const data = JSON.parse(fromBase64Url(payload).toString("utf8")) as { v?: number; org?: string; exp?: number };
    if (data.v !== 1 || !data.org || typeof data.exp !== "number" || data.exp < Date.now()) return null;
    return data.org;
  } catch {
    return null;
  }
}

export function mercadoPagoAuthorizationUrl(redirectUri: string, state: string) {
  const clientId = process.env.MERCADOPAGO_MARKETPLACE_CLIENT_ID;
  if (!clientId) throw new Error("mercadopago_oauth_not_configured");
  const url = new URL(MP_AUTH_URL);
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("platform_id", "mp");
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("state", state);
  return url.toString();
}

type OAuthTokenResponse = {
  access_token?: unknown;
  public_key?: unknown;
  refresh_token?: unknown;
  user_id?: unknown;
  token_type?: unknown;
  expires_in?: unknown;
  scope?: unknown;
};

async function oauthTokenRequest(body: Record<string, string>) {
  const clientId = process.env.MERCADOPAGO_MARKETPLACE_CLIENT_ID;
  const clientSecret = process.env.MERCADOPAGO_MARKETPLACE_CLIENT_SECRET;
  if (!clientId || !clientSecret) throw new Error("mercadopago_oauth_not_configured");
  const response = await fetch(MP_TOKEN_URL, {
    method: "POST",
    headers: { accept: "application/json", "content-type": "application/json" },
    body: JSON.stringify({ client_id: clientId, client_secret: clientSecret, ...body }),
    cache: "no-store",
  });
  const data = await response.json().catch(() => ({})) as OAuthTokenResponse & { message?: string; error?: string };
  if (!response.ok) throw new Error(`mercadopago_oauth_${response.status}`);
  return data;
}

function validTokenResponse(data: OAuthTokenResponse) {
  return typeof data.access_token === "string" && data.access_token.length > 20
    && typeof data.refresh_token === "string" && data.refresh_token.length > 10
    && typeof data.public_key === "string" && data.public_key.length > 10
    && (typeof data.user_id === "string" || typeof data.user_id === "number")
    && typeof data.expires_in === "number" && data.expires_in > 60;
}

export async function exchangeMercadoPagoCode(code: string, redirectUri: string) {
  const data = await oauthTokenRequest({ grant_type: "authorization_code", code, redirect_uri: redirectUri, test_token: "false" });
  if (!validTokenResponse(data)) throw new Error("mercadopago_oauth_invalid_response");
  return data as Required<Pick<OAuthTokenResponse, "access_token" | "public_key" | "refresh_token" | "user_id" | "expires_in">> & OAuthTokenResponse;
}

async function refreshMercadoPagoToken(refreshToken: string) {
  const data = await oauthTokenRequest({ grant_type: "refresh_token", refresh_token: refreshToken, test_token: "false" });
  if (!validTokenResponse(data)) throw new Error("mercadopago_oauth_invalid_response");
  return data as Required<Pick<OAuthTokenResponse, "access_token" | "public_key" | "refresh_token" | "user_id" | "expires_in">> & OAuthTokenResponse;
}

export type MercadoPagoConnectionRow = {
  organization_id: string;
  mp_user_id: string;
  public_key: string;
  access_token_encrypted: string;
  refresh_token_encrypted: string;
  token_scope: string | null;
  token_type: string | null;
  expires_at: string;
  connected_by: string;
  connected_at: string;
  updated_at: string;
  disconnected_at: string | null;
  disconnected_by: string | null;
  last_error: string | null;
};

export async function getMercadoPagoConnectionRow(organizationId: string, includeDisconnected = false) {
  let query = serviceClient().from("eletroposto_mp_connections").select("organization_id,mp_user_id,public_key,access_token_encrypted,refresh_token_encrypted,token_scope,token_type,expires_at,connected_by,connected_at,updated_at,disconnected_at,disconnected_by,last_error")
    .eq("organization_id", organizationId);
  if (!includeDisconnected) query = query.is("disconnected_at", null);
  const { data, error } = await query.maybeSingle();
  if (error) throw new Error(error.code === "42P01" ? "mercadopago_oauth_migration_missing" : "mercadopago_oauth_connection_read_failed");
  return (data ?? null) as MercadoPagoConnectionRow | null;
}

export async function saveMercadoPagoConnection(organizationId: string, userId: string, token: Awaited<ReturnType<typeof exchangeMercadoPagoCode>>) {
  const now = new Date();
  const row = {
    organization_id: organizationId,
    mp_user_id: String(token.user_id),
    public_key: String(token.public_key),
    access_token_encrypted: encryptSecret(String(token.access_token)),
    refresh_token_encrypted: encryptSecret(String(token.refresh_token)),
    token_scope: typeof token.scope === "string" ? token.scope.slice(0, 200) : null,
    token_type: typeof token.token_type === "string" ? token.token_type.slice(0, 30) : null,
    expires_at: new Date(now.getTime() + Number(token.expires_in) * 1000).toISOString(),
    connected_by: userId,
    connected_at: now.toISOString(),
    updated_at: now.toISOString(),
    disconnected_at: null,
    disconnected_by: null,
    last_error: null,
  };
  const client = serviceClient();
  const { error } = await client.from("eletroposto_mp_connections").upsert(row, { onConflict: "organization_id" });
  if (error) throw new Error(error.code === "42P01" ? "mercadopago_oauth_migration_missing" : "mercadopago_oauth_connection_save_failed");
  await client.from("eletroposto_mp_connection_events").insert({ organization_id: organizationId, event: "connected", actor_id: userId, metadata: { mp_user_id_suffix: String(token.user_id).slice(-4) } });
}

export async function disconnectMercadoPagoConnection(organizationId: string, userId: string) {
  const client = serviceClient();
  const now = new Date().toISOString();
  const { error } = await client.from("eletroposto_mp_connections").update({ disconnected_at: now, disconnected_by: userId, updated_at: now, last_error: null })
    .eq("organization_id", organizationId).is("disconnected_at", null);
  if (error) throw new Error("mercadopago_oauth_disconnect_failed");
  await client.from("eletroposto_mp_connection_events").insert({ organization_id: organizationId, event: "disconnected", actor_id: userId });
}

export type MercadoPagoPaymentCredentials =
  | { mode: "platform"; accessToken: string; publicKey: string | null; sellerUserId: null }
  | { mode: "seller"; accessToken: string; publicKey: string; sellerUserId: string };

export async function getMercadoPagoPaymentCredentials(organizationId: string, includeDisconnected = false): Promise<MercadoPagoPaymentCredentials> {
  const connection = await getMercadoPagoConnectionRow(organizationId, includeDisconnected);
  if (!connection) {
    return {
      mode: "platform",
      accessToken: eletropostoAccessToken(),
      publicKey: process.env.NEXT_PUBLIC_MERCADOPAGO_ELETROPOSTO_PUBLIC_KEY ?? null,
      sellerUserId: null,
    };
  }

  let accessToken = decryptSecret(connection.access_token_encrypted);
  let publicKey = connection.public_key;
  if (new Date(connection.expires_at).getTime() - Date.now() < REFRESH_BEFORE_MS) {
    try {
      const refreshed = await refreshMercadoPagoToken(decryptSecret(connection.refresh_token_encrypted));
      accessToken = String(refreshed.access_token);
      publicKey = String(refreshed.public_key);
      const now = new Date();
      const { error } = await serviceClient().from("eletroposto_mp_connections").update({
        mp_user_id: String(refreshed.user_id), public_key: publicKey,
        access_token_encrypted: encryptSecret(accessToken), refresh_token_encrypted: encryptSecret(String(refreshed.refresh_token)),
        token_scope: typeof refreshed.scope === "string" ? refreshed.scope.slice(0, 200) : null,
        token_type: typeof refreshed.token_type === "string" ? refreshed.token_type.slice(0, 30) : null,
        expires_at: new Date(now.getTime() + Number(refreshed.expires_in) * 1000).toISOString(), updated_at: now.toISOString(), last_error: null,
      }).eq("organization_id", organizationId);
      if (error) throw new Error("refresh_save_failed");
      await serviceClient().from("eletroposto_mp_connection_events").insert({ organization_id: organizationId, event: "refreshed", metadata: { mp_user_id_suffix: String(refreshed.user_id).slice(-4) } });
    } catch (error) {
      const message = error instanceof Error ? error.message.slice(0, 120) : "refresh_failed";
      await serviceClient().from("eletroposto_mp_connections").update({ last_error: message, updated_at: new Date().toISOString() }).eq("organization_id", organizationId);
      await serviceClient().from("eletroposto_mp_connection_events").insert({ organization_id: organizationId, event: "refresh_failed", metadata: { reason: message } });
      throw new Error("mercadopago_seller_token_refresh_failed");
    }
  }
  return { mode: "seller", accessToken, publicKey, sellerUserId: String(connection.mp_user_id) };
}

export async function getMercadoPagoCardPublicKey(_organizationId: string) {
  // Split 1:1: o frontend usa sempre a public key da aplicacao integradora; so o backend usa o access token do seller.
  void _organizationId;
  return process.env.NEXT_PUBLIC_MERCADOPAGO_ELETROPOSTO_PUBLIC_KEY ?? null;
}

export function applicationFeeAmount(amount: number, feePct: number | null | undefined) {
  if (feePct === null || feePct === undefined || !Number.isFinite(feePct) || feePct <= 0) return null;
  const fee = Math.round(amount * feePct) / 100;
  return fee > 0 && fee <= amount ? Math.round(fee * 100) / 100 : null;
}
