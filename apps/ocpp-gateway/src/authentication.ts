import { createHash, timingSafeEqual } from "node:crypto";

export function verifyOcppBasicAuth(chargePointId: string, authorization: string | undefined, storedHash: string): boolean {
  if (!authorization || !/^[a-f0-9]{64}$/.test(storedHash)) return false;
  const match = /^Basic ([A-Za-z0-9+/]+={0,2})$/.exec(authorization);
  if (!match) return false;

  let decoded: string;
  try { decoded = Buffer.from(match[1], "base64").toString("utf8"); }
  catch { return false; }
  const separator = decoded.indexOf(":");
  if (separator < 1 || decoded.slice(0, separator) !== chargePointId) return false;

  const candidate = createHash("sha256").update(decoded.slice(separator + 1), "utf8").digest();
  const expected = Buffer.from(storedHash, "hex");
  return candidate.length === expected.length && timingSafeEqual(candidate, expected);
}
