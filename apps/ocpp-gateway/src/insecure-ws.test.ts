import { describe, expect, it } from "vitest";
import { verifyOcppBasicAuth } from "./authentication.js";
import { createHash } from "node:crypto";

describe("insecure ws endpoint keeps credential auth", () => {
  const hash = createHash("sha256").update("secret", "utf8").digest("hex");
  it("rejects a missing or wrong credential", () => {
    expect(verifyOcppBasicAuth("CP1", undefined, hash)).toBe(false);
    expect(verifyOcppBasicAuth("CP1", `Basic ${Buffer.from("CP1:wrong").toString("base64")}`, hash)).toBe(false);
  });
  it("accepts the right credential", () => {
    expect(verifyOcppBasicAuth("CP1", `Basic ${Buffer.from("CP1:secret").toString("base64")}`, hash)).toBe(true);
  });
});
