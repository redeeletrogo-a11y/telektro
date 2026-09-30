export type OperationEvent = "StartTransaction" | "StopTransaction";
export type OperationCommandStatus = "pending" | "sent" | "accepted" | "rejected" | "timeout" | "failed" | "unknown" | "confirmed" | "operation_timeout";
export type TerminalOperationCommandStatus = Exclude<OperationCommandStatus, "pending" | "sent" | "operation_timeout">;

export function commandStatusForResult(
  action: string,
  result: Record<string, unknown>,
  forcedStatus?: "failed" | "timeout" | "unknown",
): TerminalOperationCommandStatus {
  if (forcedStatus) return forcedStatus;
  if (action === "GetConfiguration") return Array.isArray(result.configurationKey) ? "confirmed" : "failed";
  if (result.code === "NotSupported") return "failed";
  if (result.status === "Accepted") return "accepted";
  if (result.status === "Rejected") return "rejected";
  return "failed";
}

export function operationEventStatus(action: string, event: OperationEvent): OperationCommandStatus | null {
  if (action === "RemoteStartTransaction" && event === "StartTransaction") return "confirmed";
  if (action === "RemoteStopTransaction" && event === "StopTransaction") return "confirmed";
  return null;
}

export function isOpenOperation(status: string) {
  return ["pending", "sent", "accepted", "unknown"].includes(status);
}

export function operationConfirmationTimeoutStatus() {
  return "operation_timeout" as const;
}
