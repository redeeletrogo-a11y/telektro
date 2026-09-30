import { describe, expect, it } from "vitest";
import { capabilityFromCommandResult, mergeCapability, readAuthorizeRemoteTxRequests } from "./capabilities.js";

describe("observed OCPP capabilities", () => {
  it("marks support only from accepted remote command results", () => {
    expect(capabilityFromCommandResult({ status: "Accepted" }).state).toBe("SUPPORTED");
    expect(capabilityFromCommandResult({ code: "NotSupported" }).state).toBe("UNSUPPORTED");
    expect(capabilityFromCommandResult({ status: "Rejected" }).state).toBe("UNKNOWN");
  });

  it("reads AuthorizeRemoteTxRequests only when the charger reports a boolean value", () => {
    expect(readAuthorizeRemoteTxRequests({ configurationKey: [{ key: "AuthorizeRemoteTxRequests", value: "true" }] })).toBe(true);
    expect(readAuthorizeRemoteTxRequests({ configurationKey: [{ key: "AuthorizeRemoteTxRequests", value: "false" }] })).toBe(false);
    expect(readAuthorizeRemoteTxRequests({ unknownKey: ["AuthorizeRemoteTxRequests"] })).toBeNull();
  });

  it("preserves observed capability fields while adding new evidence", () => {
    expect(mergeCapability({ remoteStart: { state: "SUPPORTED" } }, "rfid", { state: "SUPPORTED" }))
      .toEqual({ remoteStart: { state: "SUPPORTED" }, rfid: { state: "SUPPORTED" } });
  });
});
