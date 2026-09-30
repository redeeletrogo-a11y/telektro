import { describe, expect, it } from "vitest";
import { commandStatusForResult, isOpenOperation, operationConfirmationTimeoutStatus, operationEventStatus } from "./operation-state.js";

describe("remote charging operation states", () => {
  it("keeps an accepted RemoteStart waiting for StartTransaction", () => {
    expect(commandStatusForResult("RemoteStartTransaction", { status: "Accepted" })).toBe("accepted");
    expect(operationEventStatus("RemoteStartTransaction", "StartTransaction")).toBe("confirmed");
  });

  it("records a charger rejection without creating a started state", () => {
    expect(commandStatusForResult("RemoteStartTransaction", { status: "Rejected" })).toBe("rejected");
  });

  it("does not mistake an OCPP NotSupported CALLERROR for a successful request", () => {
    expect(commandStatusForResult("RemoteStartTransaction", { code: "NotSupported" })).toBe("failed");
  });

  it("marks an accepted request as timed out if no transaction event arrives", () => {
    expect(operationConfirmationTimeoutStatus()).toBe("operation_timeout");
  });

  it("identifies accepted or uncertain starts as open and prevents a duplicate request", () => {
    expect(isOpenOperation("accepted")).toBe(true);
    expect(isOpenOperation("unknown")).toBe(true);
    expect(isOpenOperation("confirmed")).toBe(false);
  });

  it("marks a valid GetConfiguration response complete without changing charger settings", () => {
    expect(commandStatusForResult("GetConfiguration", { configurationKey: [{ key: "AuthorizeRemoteTxRequests", value: "false" }] })).toBe("confirmed");
    expect(commandStatusForResult("GetConfiguration", { code: "NotSupported" })).toBe("failed");
  });

  it("confirms a remote stop only when StopTransaction arrives", () => {
    expect(commandStatusForResult("RemoteStopTransaction", { status: "Accepted" })).toBe("accepted");
    expect(operationEventStatus("RemoteStopTransaction", "StopTransaction")).toBe("confirmed");
  });

  it("does not confirm a start from a stop event or a stop from a start event", () => {
    expect(operationEventStatus("RemoteStartTransaction", "StopTransaction")).toBeNull();
    expect(operationEventStatus("RemoteStopTransaction", "StartTransaction")).toBeNull();
  });
});
