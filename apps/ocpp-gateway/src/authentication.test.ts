import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { verifyOcppBasicAuth } from "./authentication.js";

const chargePointId = "TELEKTRO-EVSE-001";
const password = "sample-random-device-secret";
const hash = createHash("sha256").update(password).digest("hex");
const basic = (username: string, secret: string) => `Basic ${Buffer.from(`${username}:${secret}`).toString("base64")}`;

describe("OCPP device authentication", () => {
  it("accepts a provisioned charge point credential", () => {
    expect(verifyOcppBasicAuth(chargePointId, basic(chargePointId, password), hash)).toBe(true);
  });

  it("rejects a wrong password or a username that differs from the charge point ID", () => {
    expect(verifyOcppBasicAuth(chargePointId, basic(chargePointId, "wrong"), hash)).toBe(false);
    expect(verifyOcppBasicAuth(chargePointId, basic("OTHER-EVSE", password), hash)).toBe(false);
  });

  it("rejects absent, malformed, and invalid stored credentials", () => {
    expect(verifyOcppBasicAuth(chargePointId, undefined, hash)).toBe(false);
    expect(verifyOcppBasicAuth(chargePointId, "Bearer token", hash)).toBe(false);
    expect(verifyOcppBasicAuth(chargePointId, basic(chargePointId, password), "invalid")).toBe(false);
  });
});
