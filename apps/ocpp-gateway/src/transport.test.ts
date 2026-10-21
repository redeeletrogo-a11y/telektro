import { describe, expect, it } from "vitest";
import { requestTransport, transportAllowed } from "./transport.js";

describe("requestTransport", () => {
  it("treats https on 443 as wss", () => {
    expect(requestTransport({ "x-forwarded-proto": "https", "fly-forwarded-port": "443" })).toBe("wss");
    expect(requestTransport({ "x-forwarded-proto": "https" })).toBe("wss");
  });
  it("fails closed to ws for http, port 80, missing or odd headers", () => {
    expect(requestTransport({ "x-forwarded-proto": "http", "fly-forwarded-port": "80" })).toBe("ws");
    expect(requestTransport({ "x-forwarded-proto": "https", "fly-forwarded-port": "80" })).toBe("ws");
    expect(requestTransport({})).toBe("ws");
    expect(requestTransport({ "x-forwarded-proto": "" })).toBe("ws");
  });
});

describe("transportAllowed", () => {
  it("always allows wss", () => {
    expect(transportAllowed("wss", false)).toBe(true);
    expect(transportAllowed("wss", undefined)).toBe(true);
  });
  it("allows ws only with the explicit per-charger flag", () => {
    expect(transportAllowed("ws", false)).toBe(false);
    expect(transportAllowed("ws", null)).toBe(false);
    expect(transportAllowed("ws", undefined)).toBe(false);
    expect(transportAllowed("ws", true)).toBe(true);
  });
});
