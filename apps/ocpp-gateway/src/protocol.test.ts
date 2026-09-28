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
