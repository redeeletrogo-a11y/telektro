export type CapabilityState = "SUPPORTED" | "UNSUPPORTED" | "UNKNOWN";

export type ChargerCapabilities = {
  remoteStart?: { state: CapabilityState; evidence: string; observedAt: string };
  remoteStop?: { state: CapabilityState; evidence: string; observedAt: string };
  rfid?: { state: CapabilityState; evidence: string; observedAt: string };
  authorizeRemoteTxRequests?: { state: CapabilityState; value: string | null; observedAt: string };
};

export function capabilityFromCommandResult(result: Record<string, unknown>): { state: CapabilityState; evidence: string } {
  if (result.status === "Accepted") return { state: "SUPPORTED", evidence: "Remote command accepted" };
  if (result.code === "NotSupported") return { state: "UNSUPPORTED", evidence: "OCPP CALLERROR NotSupported" };
  return { state: "UNKNOWN", evidence: typeof result.code === "string" ? `OCPP CALLERROR ${result.code}` : "Command rejected; support is not determined" };
}

export function readAuthorizeRemoteTxRequests(payload: Record<string, unknown>) {
  const configurationKey = Array.isArray(payload.configurationKey) ? payload.configurationKey : [];
  const setting = configurationKey.find((entry) => entry && typeof entry === "object" &&
    (entry as Record<string, unknown>).key === "AuthorizeRemoteTxRequests") as Record<string, unknown> | undefined;
  if (!setting || typeof setting.value !== "string") return null;
  const value = setting.value.trim().toLowerCase();
  if (value !== "true" && value !== "false") return null;
  return value === "true";
}

export function mergeCapability<T extends Record<string, unknown>>(
  current: T | null | undefined,
  key: string,
  value: unknown,
): T & Record<string, unknown> {
  return { ...(current ?? {} as T), [key]: value };
}
