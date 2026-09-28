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
    "Finishing", "Reserved", "Unavailable", "Faulted", "Unknown",
  ]),
  timestamp: z.string().datetime({ offset: true }).optional(),
}).passthrough();

export const StartTransactionSchema = z.object({
  connectorId: z.number().int().positive(),
  idTag: z.string().min(1).max(20),
  meterStart: z.number().int().nonnegative(),
  timestamp: z.string().datetime({ offset: true }),
}).passthrough();

export const StopTransactionSchema = z.object({
  transactionId: z.number().int().positive(),
  meterStop: z.number().int().nonnegative(),
  timestamp: z.string().datetime({ offset: true }),
  reason: z.string().max(50).optional(),
  idTag: z.string().max(20).optional(),
}).passthrough();

const SampledValueSchema = z.object({
  value: z.string().min(1).max(100),
  context: z.string().max(50).optional(),
  measurand: z.string().max(100).optional(),
  phase: z.string().max(20).optional(),
  unit: z.string().max(20).optional(),
}).passthrough();

export const MeterValuesSchema = z.object({
  connectorId: z.number().int().nonnegative(),
  transactionId: z.number().int().positive().optional(),
  meterValue: z.array(z.object({
    timestamp: z.string().datetime({ offset: true }),
    sampledValue: z.array(SampledValueSchema).min(1),
  }).passthrough()).min(1),
}).passthrough();

export const AuthorizeSchema = z.object({ idTag: z.string().min(1).max(20) }).passthrough();

export const RemoteStartTransactionConfirmationSchema = z.object({ status: z.enum(["Accepted", "Rejected"]) }).passthrough();
export const RemoteStopTransactionConfirmationSchema = z.object({ status: z.enum(["Accepted", "Rejected"]) }).passthrough();

export const OcppMessageSchema = z.union([
  OcppFrameSchema,
  z.tuple([z.literal(3), z.string().min(1).max(64), z.record(z.string(), z.unknown())]),
  z.tuple([z.literal(4), z.string().min(1).max(64), z.string().min(1).max(50), z.string().max(500), z.record(z.string(), z.unknown())]),
]);

export type OcppCall = z.infer<typeof OcppFrameSchema>;

export function parseOcppCall(raw: string): OcppCall {
  let value: unknown;
  try { value = JSON.parse(raw); }
  catch { throw new Error("Invalid JSON frame"); }
  return OcppFrameSchema.parse(value);
}

export function parseOcppMessage(raw: string) {
  let value: unknown;
  try { value = JSON.parse(raw); }
  catch { throw new Error("Invalid JSON frame"); }
  return OcppMessageSchema.parse(value);
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
