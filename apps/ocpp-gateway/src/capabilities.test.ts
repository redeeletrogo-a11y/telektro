import { describe, expect, it } from "vitest";
import { capabilityFromCommandResult, mergeCapability, readAuthorizeRemoteTxRequests, readSupportedFeatureProfiles, reportsSmartCharging } from "./capabilities.js";

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

  it("reads SupportedFeatureProfiles and detects SmartCharging support", () => {
    const full = readSupportedFeatureProfiles({ configurationKey: [{ key: "SupportedFeatureProfiles", value: "Core,FirmwareManagement,SmartCharging" }] });
    expect(full).toBe("Core,FirmwareManagement,SmartCharging");
    expect(reportsSmartCharging(full!)).toBe(true);
    expect(reportsSmartCharging("Core,FirmwareManagement")).toBe(false);
    expect(reportsSmartCharging("Core, SmartCharging ")).toBe(true);
    expect(readSupportedFeatureProfiles({ unknownKey: ["SupportedFeatureProfiles"] })).toBeNull();
    expect(readSupportedFeatureProfiles({ configurationKey: [{ key: "SupportedFeatureProfiles", value: "  " }] })).toBeNull();
  });

  it("preserves observed capability fields while adding new evidence", () => {
    expect(mergeCapability({ remoteStart: { state: "SUPPORTED" } }, "rfid", { state: "SUPPORTED" }))
      .toEqual({ remoteStart: { state: "SUPPORTED" }, rfid: { state: "SUPPORTED" } });
  });
});
