import { z } from "zod";

export const OcppFrameSchema = z.tuple([
  z.literal(2),
  z.string().min(1).max(64),
  z.string().min(1).max(64),
  z.record(z.string(), z.unknown()),
]);

export const BootNotificationSchema = z.object({
  chargePointVendor: z.string().min(1).max(50),
  chargePointModel: z.string().min(1).max(50),
  chargePointSerialNumber: z.string().max(25).optional(),
  firmwareVersion: z.string().max(50).optional(),
}).passthrough();

export const HeartbeatSchema = z.object({}).passthrough();

export const StatusNotificationSchema = z.object({
  connectorId: z.number().int().nonnegative(),
  errorCode: z.string().min(1).max(50),
  status: z.enum([
    "Available", "Preparing", "Charging", "SuspendedEVSE", "SuspendedEV",
    "Finishing", "Reserved", "Unavailable", "Faulted",
  ]),
  timestamp: z.string().datetime({ offset: true }).optional(),
}).passthrough();

export type OcppCall = z.infer<typeof OcppFrameSchema>;

export function parseOcppCall(raw: string): OcppCall {
  let value: unknown;
  try { value = JSON.parse(raw); }
  catch { throw new Error("Invalid JSON frame"); }
  return OcppFrameSchema.parse(value);
}

export function responseFor(action: string, payload: Record<string, unknown>, now = new Date()): Record<string, unknown> {
  if (action === "BootNotification") {
    const parsed = BootNotificationSchema.safeParse(payload);
    if (!parsed.success) throw new Error("Invalid BootNotification payload");
    return { status: "Accepted", currentTime: now.toISOString(), interval: 60 };
  }
  if (action === "Heartbeat") {
    HeartbeatSchema.parse(payload);
    return { currentTime: now.toISOString() };
  }
  if (action === "StatusNotification") {
    StatusNotificationSchema.parse(payload);
    return {};
  }
  throw new Error(`Unsupported action: ${action}`);
}
