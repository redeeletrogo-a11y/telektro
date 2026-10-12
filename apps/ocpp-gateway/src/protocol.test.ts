import { describe, expect, it } from "vitest";
import { parseOcppCall, responseFor } from "./protocol.js";

describe("OCPP 1.6J foundation", () => {
  it("parses a CALL frame", () => {
    expect(parseOcppCall('[2,"msg-1","Heartbeat",{}]')).toEqual([2, "msg-1", "Heartbeat", {}]);
  });

  it("returns accepted boot data with the configured heartbeat interval", () => {
    expect(responseFor("BootNotification", { chargePointVendor: "ACME", chargePointModel: "Wallbox" }, new Date("2026-09-28T12:00:00Z")))
      .toEqual({ status: "Accepted", currentTime: "2026-09-28T12:00:00.000Z", interval: 60 });
  });

  it("rejects malformed and unsupported actions", () => {
    expect(() => parseOcppCall('[2,"x","Heartbeat",null]')).toThrow();
    expect(() => responseFor("RemoteStartTransaction", {})).toThrow("Unsupported action");
  });
});

import { StopTransactionSchema } from "./protocol.js";

describe("StopTransaction tolerance", () => {
  it("accepts a spec-conformant payload", () => {
    expect(StopTransactionSchema.parse({ transactionId: 7, meterStop: 12000, timestamp: "2026-10-12T12:30:00Z" }).transactionId).toBe(7);
  });
  it("accepts firmware variants: no UTC offset, decimal meter, string id, long reason and idTag", () => {
    const parsed = StopTransactionSchema.parse({ transactionId: "42", meterStop: 1234.5, timestamp: "2026-10-12T12:30:00", reason: "x".repeat(80), idTag: "y".repeat(32) });
    expect(parsed.transactionId).toBe(42);
  });
  it("still rejects garbage", () => {
    expect(() => StopTransactionSchema.parse({ transactionId: -1, meterStop: 5, timestamp: "2026-10-12T12:30:00Z" })).toThrow();
    expect(() => StopTransactionSchema.parse({ transactionId: 1, meterStop: -5, timestamp: "2026-10-12T12:30:00Z" })).toThrow();
    expect(() => StopTransactionSchema.parse({ transactionId: 1, meterStop: 5, timestamp: "not a date" })).toThrow();
  });
});
