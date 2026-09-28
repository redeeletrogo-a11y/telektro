import { createServer } from "node:http";
import { randomInt, randomUUID, timingSafeEqual } from "node:crypto";
import { WebSocket, WebSocketServer } from "ws";
import { createClient } from "@supabase/supabase-js";
import { ZodError } from "zod";
import { verifyOcppBasicAuth } from "./authentication.js";
import {
  AuthorizeSchema,
  BootNotificationSchema,
  HeartbeatSchema,
  MeterValuesSchema,
  parseOcppMessage,
  responseFor,
  StartTransactionSchema,
  StatusNotificationSchema,
  StopTransactionSchema,
} from "./protocol.js";

type ChargerRecord = {
  id: string;
  organization_id: string;
  site_id: string;
  ocpp_credential_hash: string | null;
};

type PendingCommand = { charger: ChargerRecord; commandId: string; action: string; idTag?: string; timeout: NodeJS.Timeout };
type IdTagGrant = { chargerId: string; expiresAt: number; authorized: boolean };

const port = Number(process.env.OCPP_GATEWAY_PORT ?? 9000);
const developmentToken = process.env.OCPP_DEV_TOKEN;
const connections = new Map<string, WebSocket>();
const socketChargers = new WeakMap<WebSocket, ChargerRecord | null>();
const chargerConnections = new Map<string, { chargePointId: string; websocket: WebSocket }>();
const pendingCommands = new Map<string, PendingCommand>();
const idTagGrants = new Map<string, IdTagGrant>();
const heartbeatSeconds = Number(process.env.OCPP_HEARTBEAT_INTERVAL_SECONDS ?? 60);
const supabaseUrl = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const registry = supabaseUrl && serviceRoleKey
  ? createClient(supabaseUrl, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } })
  : null;
let pollingCommands = false;

const server = createServer((request, response) => {
  if (request.url === "/health") {
    response.writeHead(200, { "content-type": "application/json" });
    response.end(JSON.stringify({ status: "ok", connectedChargers: connections.size }));
    return;
  }
  response.writeHead(404).end();
});

const sockets = new WebSocketServer({ noServer: true, handleProtocols: (protocols) => protocols.has("ocpp1.6") ? "ocpp1.6" : false });

server.on("upgrade", async (request, socket, head) => {
  const url = new URL(request.url ?? "/", `http://${request.headers.host ?? "localhost"}`);
  const chargePointId = url.pathname.match(/^\/ocpp\/([A-Za-z0-9._-]{1,64})$/)?.[1];
  const suppliedToken = request.headers["x-telektro-dev-token"];
  const isDevAuth = process.env.NODE_ENV !== "production" && Boolean(developmentToken) && typeof suppliedToken === "string" && safeEqual(suppliedToken, developmentToken!);
  let charger: ChargerRecord | null = null;

  if (chargePointId && registry) {
    try {
      const { data, error } = await registry.from("chargers")
        .select("id, organization_id, site_id, ocpp_credential_hash")
        .eq("charge_point_id", chargePointId).maybeSingle();
      if (error) throw error;
      charger = data as ChargerRecord | null;
      const isDeviceAuth = Boolean(charger?.ocpp_credential_hash && request.headers.authorization &&
        verifyOcppBasicAuth(chargePointId, request.headers.authorization, charger.ocpp_credential_hash));
      if (!isDevAuth && !isDeviceAuth) charger = null;
      else if (!isDeviceAuth && !isDevAuth) charger = null;
    } catch {
      console.error(JSON.stringify({ event: "ocpp.authentication_failed", chargePointId, reason: "registry_lookup_failed" }));
    }
  }

  if (!chargePointId || (!isDevAuth && !charger)) {
    socket.write("HTTP/1.1 401 Unauthorized\r\nWWW-Authenticate: Basic realm=\"Telektro OCPP\"\r\nConnection: close\r\n\r\n");
    socket.destroy();
    console.warn(JSON.stringify({ event: "ocpp.connection_rejected", chargePointId: chargePointId ?? "invalid", reason: "authentication_not_configured" }));
    return;
  }

  sockets.handleUpgrade(request, socket, head, (websocket) => {
    socketChargers.set(websocket, charger);
    sockets.emit("connection", websocket, request);
  });
});

sockets.on("connection", (websocket: WebSocket, request) => {
  const chargePointId = new URL(request.url ?? "/", `http://${request.headers.host ?? "localhost"}`).pathname.split("/").at(-1)!;
  const previous = connections.get(chargePointId);
  if (previous && previous !== websocket) previous.close(1000, "Replaced by a new connection");
  connections.set(chargePointId, websocket);
  const charger = socketChargers.get(websocket) ?? null;
  if (charger) chargerConnections.set(charger.id, { chargePointId, websocket });
  void setOnline(charger, true).catch((error) => reportPersistenceFailure("connect", chargePointId, error));
  console.info(JSON.stringify({ event: "ocpp.connected", chargePointId }));

  websocket.on("message", (data) => {
    void handleMessage(websocket, chargePointId, charger, data.toString());
  });

  websocket.on("close", () => {
    if (connections.get(chargePointId) === websocket) {
      connections.delete(chargePointId);
      if (charger && chargerConnections.get(charger.id)?.websocket === websocket) chargerConnections.delete(charger.id);
      void setOffline(charger).catch((error) => reportPersistenceFailure("disconnect", chargePointId, error));
    }
    console.info(JSON.stringify({ event: "ocpp.disconnected", chargePointId }));
  });
});

async function handleMessage(websocket: WebSocket, chargePointId: string, charger: ChargerRecord | null, raw: string) {
  let messageId = "unknown";
  let action = "unknown";
  let isCall = false;
  try {
    const frame = parseOcppMessage(raw);
    const messageType = frame[0];
    if (messageType === 3) {
      const [, id, result] = frame;
      await completePendingCommand(id, result);
      return;
    }
    if (messageType === 4) {
      const [, id, code, description, details] = frame;
      await completePendingCommand(id, { code, description, details }, "failed");
      return;
    }
    const [, id, receivedAction, payload] = frame;
    messageId = id;
    action = receivedAction;
    isCall = true;
    if (messageType !== 2) throw new Error("Only CALL frames are supported by this foundation");
    const result = await persistCall(charger, action, payload);
    if (action === "BootNotification") result.interval = heartbeatSeconds;
    if (websocket.readyState === WebSocket.OPEN) websocket.send(JSON.stringify([3, messageId, result]));
    void logCall(charger, messageId, action, "accepted");
    console.info(JSON.stringify({ event: "ocpp.call_handled", chargePointId, action, messageId }));
  } catch (error) {
    const description = error instanceof Error ? error.message : "Invalid OCPP message";
    if (!isCall) {
      reportPersistenceFailure("command_confirmation", chargePointId, error);
      return;
    }
    const code = description.startsWith("Unsupported action") ? "NotSupported" : error instanceof ZodError || description.startsWith("Invalid") ? "FormationViolation" : "InternalError";
    if (websocket.readyState === WebSocket.OPEN) websocket.send(JSON.stringify([4, messageId, code, description, {}]));
    void logCall(charger, messageId, action, "rejected");
    console.warn(JSON.stringify({ event: "ocpp.call_rejected", chargePointId, action, messageId, reason: description }));
  }
}

async function persistCall(charger: ChargerRecord | null, action: string, payload: Record<string, unknown>): Promise<Record<string, unknown>> {
  if (!registry || !charger) return responseFor(action, payload);
  const now = new Date().toISOString();

  if (action === "BootNotification") {
    const parsed = BootNotificationSchema.parse(payload);
    const { error } = await registry.from("chargers").update({
      vendor: parsed.chargePointVendor,
      model: parsed.chargePointModel,
      firmware: parsed.firmwareVersion ?? null,
      online: true,
      last_heartbeat_at: now,
    }).eq("id", charger.id);
    if (error) throw error;
    return { status: "Accepted", currentTime: now, interval: heartbeatSeconds };
  }

  if (action === "Heartbeat") {
    HeartbeatSchema.parse(payload);
    const { error } = await registry.from("chargers").update({ online: true, last_heartbeat_at: now }).eq("id", charger.id);
    if (error) throw error;
    return { currentTime: now };
  }

  if (action === "Authorize") {
    const parsed = AuthorizeSchema.parse(payload);
    const grant = idTagGrants.get(parsed.idTag);
    if (!grant || grant.chargerId !== charger.id || grant.expiresAt <= Date.now()) {
      return { idTagInfo: { status: "Invalid" } };
    }
    grant.authorized = true;
    return { idTagInfo: { status: "Accepted", expiryDate: new Date(grant.expiresAt).toISOString() } };
  }

  if (action === "StatusNotification") {
    const parsed = StatusNotificationSchema.parse(payload);
    const statusAt = parsed.timestamp ?? now;
    const { error: connectorError } = await registry.from("connectors").upsert({
      organization_id: charger.organization_id,
      charger_id: charger.id,
      connector_id: parsed.connectorId,
      status: parsed.status,
      updated_at: statusAt,
    }, { onConflict: "charger_id,connector_id" });
    if (connectorError) throw connectorError;
    const chargerUpdate: Record<string, unknown> = { online: true, last_heartbeat_at: now };
    if (parsed.connectorId <= 1) chargerUpdate.status = parsed.status;
    const { error } = await registry.from("chargers").update(chargerUpdate).eq("id", charger.id);
    if (error) throw error;
    return {};
  }

  if (action === "StartTransaction") {
    const parsed = StartTransactionSchema.parse(payload);
    const grant = idTagGrants.get(parsed.idTag);
    if (!grant || grant.chargerId !== charger.id || !grant.authorized || grant.expiresAt <= Date.now()) {
      return { transactionId: 0, idTagInfo: { status: "Invalid" } };
    }
    const { data: active, error: activeError } = await registry.from("sessions").select("id")
      .eq("charger_id", charger.id).eq("connector_id", parsed.connectorId).is("ended_at", null).maybeSingle();
    if (activeError) throw activeError;
    if (active) {
      idTagGrants.delete(parsed.idTag);
      return { transactionId: 0, idTagInfo: { status: "ConcurrentTx" } };
    }

    const transactionId = await nextTransactionId(charger.id);
    const { error } = await registry.from("sessions").insert({
      organization_id: charger.organization_id,
      site_id: charger.site_id,
      charger_id: charger.id,
      connector_id: parsed.connectorId,
      ocpp_transaction_id: transactionId,
      id_tag: parsed.idTag,
      started_at: parsed.timestamp,
      start_meter_wh: parsed.meterStart,
    });
    if (error) throw error;
    idTagGrants.delete(parsed.idTag);
    return { transactionId, idTagInfo: { status: "Accepted" } };
  }

  if (action === "StopTransaction") {
    const parsed = StopTransactionSchema.parse(payload);
    const { data: session, error: findError } = await registry.from("sessions").select("id")
      .eq("charger_id", charger.id).eq("ocpp_transaction_id", parsed.transactionId).is("ended_at", null).maybeSingle();
    if (findError) throw findError;
    if (!session) return { idTagInfo: { status: "Invalid" } };
    const { error } = await registry.from("sessions").update({
      ended_at: parsed.timestamp,
      end_meter_wh: parsed.meterStop,
      stop_reason: parsed.reason ?? null,
    }).eq("id", session.id);
    if (error) throw error;
    return { idTagInfo: { status: "Accepted" } };
  }

  if (action === "MeterValues") {
    const parsed = MeterValuesSchema.parse(payload);
    let sessionId: string | null = null;
    if (parsed.transactionId !== undefined) {
      const { data: session, error } = await registry.from("sessions").select("id")
        .eq("charger_id", charger.id).eq("ocpp_transaction_id", parsed.transactionId).is("ended_at", null).maybeSingle();
      if (error) throw error;
      sessionId = session?.id ?? null;
    }
    const readings = parsed.meterValue.flatMap((sample) => sample.sampledValue.flatMap((reading) => {
      const value = Number(reading.value);
      if (!Number.isFinite(value)) return [];
      const measurand = reading.measurand ?? "Energy.Active.Import.Register";
      return [{
        organization_id: charger.organization_id,
        session_id: sessionId,
        charger_id: charger.id,
        connector_id: parsed.connectorId,
        sampled_at: sample.timestamp,
        measurand,
        value,
        unit: reading.unit ?? (measurand.startsWith("Energy.") ? "Wh" : measurand.startsWith("Power.") ? "W" : null),
        phase: reading.phase ?? null,
        context: reading.context ?? null,
      }];
    }));
    if (!readings.length) throw new Error("Invalid MeterValues: no numeric readings");
    const { error } = await registry.from("meter_values").insert(readings);
    if (error) throw error;
    return {};
  }

  return responseFor(action, payload);
}

async function setOnline(charger: ChargerRecord | null, online: boolean) {
  if (!registry || !charger) return;
  const { error } = await registry.from("chargers").update(online
    ? { online: true, status: "Unknown" }
    : { online: false, status: "Offline" }).eq("id", charger.id);
  if (error) throw error;
}

async function setOffline(charger: ChargerRecord | null) {
  await setOnline(charger, false);
}

async function logCall(charger: ChargerRecord | null, messageId: string, action: string, outcome: string, direction: "inbound" | "outbound" = "inbound") {
  if (!registry || !charger) return;
  const { error } = await registry.from("ocpp_messages").insert({
    organization_id: charger.organization_id,
    charger_id: charger.id,
    message_id: messageId,
    action,
    direction,
    outcome,
  });
  if (error) reportPersistenceFailure("message_log", charger.id, error);
}

async function nextTransactionId(chargerId: string): Promise<number> {
  if (!registry) throw new Error("Supabase registry is unavailable");
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const transactionId = randomInt(1, 2_147_483_647);
    const { data, error } = await registry.from("sessions").select("id")
      .eq("charger_id", chargerId).eq("ocpp_transaction_id", transactionId).limit(1);
    if (error) throw error;
    if (!data?.length) return transactionId;
  }
  throw new Error("Unable to allocate a unique OCPP transaction identifier");
}

async function pollPendingCommands() {
  if (!registry || pollingCommands) return;
  pollingCommands = true;
  try {
    const { data, error } = await registry.from("commands").select("id, charger_id, action, payload")
      .eq("status", "pending").order("requested_at", { ascending: true }).limit(25);
    if (error) throw error;
    for (const command of data ?? []) await dispatchCommand(command);
  } catch (error) {
    reportPersistenceFailure("command_poll", "gateway", error);
  } finally {
    pollingCommands = false;
  }
}

async function dispatchCommand(command: { id: string; charger_id: string; action: string; payload: Record<string, unknown> }) {
  if (!registry) return;
  if (command.action !== "RemoteStartTransaction" && command.action !== "RemoteStopTransaction") {
    await updateCommand(command.id, "failed", { error: "unsupported_action" });
    return;
  }
  const connection = chargerConnections.get(command.charger_id);
  const charger = connection ? socketChargers.get(connection.websocket) : null;
  if (!connection || !charger || connection.websocket.readyState !== WebSocket.OPEN) {
    await updateCommand(command.id, "failed", { error: "charger_offline" });
    return;
  }
  if (command.action === "RemoteStartTransaction" && (typeof command.payload.idTag !== "string" || command.payload.idTag.length > 20)) {
    await updateCommand(command.id, "failed", { error: "invalid_id_tag" });
    return;
  }
  if (command.action === "RemoteStopTransaction" && (typeof command.payload.transactionId !== "number" || !Number.isInteger(command.payload.transactionId))) {
    await updateCommand(command.id, "failed", { error: "invalid_transaction_id" });
    return;
  }

  const { data: claimed, error: claimError } = await registry.from("commands").update({ status: "sent" })
    .eq("id", command.id).eq("status", "pending").select("id").maybeSingle();
  if (claimError) throw claimError;
  if (!claimed) return;

  const messageId = randomUUID();
  const idTag = command.action === "RemoteStartTransaction" ? String(command.payload.idTag) : undefined;
  if (idTag) idTagGrants.set(idTag, { chargerId: charger.id, expiresAt: Date.now() + 10 * 60_000, authorized: true });
  const timeout = setTimeout(() => {
    void completePendingCommand(messageId, { error: "charger_response_timeout" }, "timeout")
      .catch((error) => reportPersistenceFailure("command_timeout", command.charger_id, error));
  }, 20_000);
  pendingCommands.set(messageId, { charger, commandId: command.id, action: command.action, idTag, timeout });
  try {
    connection.websocket.send(JSON.stringify([2, messageId, command.action, command.payload]));
    void logCall(charger, messageId, command.action, "sent", "outbound");
  } catch (error) {
    await completePendingCommand(messageId, { error: error instanceof Error ? error.message : "send_failed" }, "failed");
  }
}

async function completePendingCommand(messageId: string, result: Record<string, unknown>, forcedStatus?: "failed" | "timeout") {
  const pending = pendingCommands.get(messageId);
  if (!pending) return;
  clearTimeout(pending.timeout);
  pendingCommands.delete(messageId);
  const status = forcedStatus ?? (result.status === "Accepted" ? "accepted" : "rejected");
  if (status !== "accepted" && pending.idTag) idTagGrants.delete(pending.idTag);
  await updateCommand(pending.commandId, status, result);
  await logCall(pending.charger, messageId, pending.action, status, "outbound");
}

async function updateCommand(commandId: string, status: "accepted" | "rejected" | "timeout" | "failed", result: Record<string, unknown>) {
  if (!registry) return;
  const { error } = await registry.from("commands").update({ status, result, completed_at: new Date().toISOString() }).eq("id", commandId);
  if (error) throw error;
}

setInterval(() => { void pollPendingCommands(); }, 1_500).unref();
setInterval(() => {
  const now = Date.now();
  for (const [idTag, grant] of idTagGrants) if (grant.expiresAt <= now) idTagGrants.delete(idTag);
}, 30_000).unref();

function reportPersistenceFailure(action: string, chargePointId: string, error: unknown) {
  const reason = error instanceof Error ? error.message : "database write failed";
  console.error(JSON.stringify({ event: "ocpp.persistence_failed", action, chargePointId, reason }));
}

function safeEqual(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

server.listen(port, "0.0.0.0", () => console.info(JSON.stringify({ event: "gateway.started", port, healthPath: "/health", ocppPath: "/ocpp/{chargePointId}" })));

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => {
    sockets.close();
    server.close(() => process.exit(0));
  });
}
