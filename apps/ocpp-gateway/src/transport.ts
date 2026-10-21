import type { IncomingHttpHeaders } from "node:http";

export type OcppTransport = "wss" | "ws";

function first(value: string | string[] | undefined): string {
  const raw = Array.isArray(value) ? value[0] : value;
  return (raw ?? "").split(",")[0]?.trim().toLowerCase() ?? "";
}

// Fly's proxy sets X-Forwarded-Proto (https on port 443, http on port 80) and Fly-Forwarded-Port.
// Fail closed: only an explicit https on 443 counts as encrypted. Anything else is treated as plain ws.
export function requestTransport(headers: IncomingHttpHeaders): OcppTransport {
  const proto = first(headers["x-forwarded-proto"]);
  const forwardedPort = first(headers["fly-forwarded-port"]);
  if (proto !== "https" && proto !== "wss") return "ws";
  if (forwardedPort && forwardedPort !== "443") return "ws";
  return "wss";
}

export function transportAllowed(transport: OcppTransport, allowInsecureWs: boolean | null | undefined): boolean {
  return transport === "wss" || allowInsecureWs === true;
}
