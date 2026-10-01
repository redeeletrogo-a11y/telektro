import { createServer } from "node:http";
import { createHash, randomInt, randomUUID, timingSafeEqual } from "node:crypto";
import { WebSocket, WebSocketServer } from "ws";
import { createClient } from "@supabase/supabase-js";
import { ZodError } from "zod";
import { verifyOcppBasicAuth } from "./authentication.js";
import { capabilityFromCommandResult, mergeCapability, readAuthorizeRemoteTxRequests } from "./capabilities.js";
import { commandStatusForResult, operationConfirmationTimeoutStatus, operationEventStatus } from "./operation-state.js";
import { energyRegisterRegressionError, energyRegisterWh, isRegisteredConnector, meterReadingError, meterTransactionError } from "./validation.js";
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
  removed_at?: string | null;
  connector_count?: number | null;
  capabilities?: Record<string, unknown> | null;
};

type PendingCommand = { charger: ChargerRecord; commandId: string; action: string; idTag?: string; userId: string | null; timeout: NodeJS.Timeout };
type IdTagGrant = { chargerId: string; expiresAt: number; authorized: boolean; authorizationType: "RFID" | "REMOTE" | "APP" | "QR"; userId: string | null };

const port = Number(process.env.OCPP_GATEWAY_PORT ?? 9000);
const developmentToken = process.env.OCPP_DEV_TOKEN;
const connections = new Map<string, WebSocket>();
const inboundMessageQueues = new Map<string, Promise<void>>();
const socketChargers = new WeakMap<WebSocket, ChargerRecord | null>();
const chargerConnections = new Map<string, { chargePointId: string; websocket: WebSocket; credentialHash: string | null }>();
const pendingCommands = new Map<string, PendingCommand>();
const idTagGrants = new Map<string, IdTagGrant>();
const heartbeatSeconds = Number(process.env.OCPP_HEARTBEAT_INTERVAL_SECONDS ?? 60);
const operationConfirmationSeconds = Math.max(30, Number(process.env.OCPP_OPERATION_CONFIRMATION_SECONDS ?? 300));
const supabaseUrl = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const registry = supabaseUrl && serviceRoleKey
  ? createClient(supabaseUrl, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } })
  : null;
let pollingCommands = false;
let startupRecoveryComplete = false;

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
        .select("id, organization_id, site_id, ocpp_credential_hash, connector_count, capabilities, removed_at")
        .eq("charge_point_id", chargePointId).is("removed_at", null).maybeSingle();
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
  if (charger) chargerConnections.set(charger.id, { chargePointId, websocket, credentialHash: charger.ocpp_credential_hash });
  void setOnline(charger, true).catch((error) => reportPersistenceFailure("connect", chargePointId, error));
  console.info(JSON.stringify({ event: "ocpp.connected", chargePointId }));

  websocket.on("message", (data) => {
    const queueKey = charger?.id ?? chargePointId;
    const previous = inboundMessageQueues.get(queueKey) ?? Promise.resolve();
    const next = previous.catch(() => undefined).then(() => handleMessage(websocket, chargePointId, charger, data.toString()));
    const tail = next.catch((error) => reportPersistenceFailure("inbound_message_queue", chargePointId, error)).finally(() => {
      if (inboundMessageQueues.get(queueKey) === tail) inboundMessageQueues.delete(queueKey);
    });
    inboundMessageQueues.set(queueKey, tail);
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
  let payload: Record<string, unknown> = {};
  try {
    const frame = parseOcppMessage(raw);
    const messageType = frame[0];
    if (messageType === 3) {
      const [, id, result] = frame;
      await completePendingCommand(id, result, undefined, charger);
      return;
    }
    if (messageType === 4) {
      const [, id, code] = frame;
      await completePendingCommand(id, { code, error: `Charger returned OCPP ${code}` }, "failed", charger);
      if (charger) await setLastOcppError(charger, `OCPP CALLERROR ${code}`);
      return;
    }
    const [, id, receivedAction, receivedPayload] = frame;
    payload = receivedPayload;
    messageId = id;
    action = receivedAction;
    isCall = true;
    if (messageType !== 2) throw new Error("Only CALL frames are supported by this foundation");
    const result = await persistCall(charger, action, payload);
    if (action === "BootNotification") result.interval = heartbeatSeconds;
    if (websocket.readyState === WebSocket.OPEN) websocket.send(JSON.stringify([3, messageId, result]));
    const inboundOutcome = action === "Authorize" || action === "StartTransaction"
      ? (result.idTagInfo as { status?: string } | undefined)?.status === "Accepted" ? "authorization_accepted" : "authorization_rejected"
      : "accepted";
    const metadata = await safeCallMetadata(charger, action, payload);
    const authorizationStatus = (result.idTagInfo as { status?: string } | undefined)?.status;
    if (authorizationStatus && authorizationStatus !== "Accepted") metadata.reason = `idTagInfo ${authorizationStatus}`;
    void logCall(charger, messageId, action, inboundOutcome, "inbound", metadata);
    console.info(JSON.stringify({ event: "ocpp.call_handled", chargePointId, action, messageId }));
  } catch (error) {
    const description = error instanceof ZodError ? `Invalid ${action} payload` : error instanceof Error ? error.message : "Invalid OCPP message";
    if (!isCall) {
      reportPersistenceFailure("command_confirmation", chargePointId, error);
      return;
    }
    const code = description.startsWith("Unsupported action") ? "NotSupported" : error instanceof ZodError || description.startsWith("Invalid") ? "FormationViolation" : "InternalError";
    if (websocket.readyState === WebSocket.OPEN) websocket.send(JSON.stringify([4, messageId, code, description, {}]));
    if (charger) void setLastOcppError(charger, `${action}: ${description}`).catch((metadataError) => reportPersistenceFailure("ocpp_error_state", charger.id, metadataError));
    void safeCallMetadata(charger, action, payload).then((metadata) => logCall(charger, messageId, action, "rejected", "inbound", { ...metadata, reason: description }));
    console.warn(JSON.stringify({ event: "ocpp.call_rejected", chargePointId, action, messageId, reason: description }));
  }
}

async function persistCall(charger: ChargerRecord | null, action: string, payload: Record<string, unknown>): Promise<Record<string, unknown>> {
  if (!registry || !charger) return responseFor(action, payload);
  const now = new Date().toISOString();
  const { data: currentCharger, error: currentChargerError } = await registry.from("chargers").select("removed_at")
    .eq("id", charger.id).eq("organization_id", charger.organization_id).maybeSingle();
  if (currentChargerError) throw currentChargerError;
  if (!currentCharger || currentCharger.removed_at) {
    if (action === "Authorize" || action === "StartTransaction") return { idTagInfo: { status: "Invalid" }, ...(action === "StartTransaction" ? { transactionId: 0 } : {}) };
    throw new Error("CHARGER_REMOVED");
  }

  if (action === "BootNotification") {
    const parsed = BootNotificationSchema.parse(payload);
    const { error } = await registry.from("chargers").update({
      vendor: parsed.chargePointVendor,
      model: parsed.chargePointModel,
      ...(parsed.firmwareVersion ? { firmware: parsed.firmwareVersion } : {}),
      ...(parsed.chargePointSerialNumber ? { serial_number: parsed.chargePointSerialNumber } : {}),
      ocpp_version: "1.6J",
      online: true,
      last_heartbeat_at: now,
      last_boot_at: now,
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
    const grant = await resolveIdTagGrant(charger, parsed.idTag);
    if (!grant || grant.chargerId !== charger.id || grant.expiresAt <= Date.now()) {
      await setLastOcppError(charger, "Authorize rejected: unknown or revoked idTag");
      return { idTagInfo: { status: "Invalid" } };
    }
    grant.authorized = true;
    if (grant.authorizationType === "RFID") await updateCapabilities(charger, "rfid", { state: "SUPPORTED", evidence: "Accepted physical idTag Authorize", observedAt: now });
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
    const chargerUpdate: Record<string, unknown> = { online: true, last_heartbeat_at: now, last_status_notification_at: statusAt };
    if (parsed.connectorId <= 1) chargerUpdate.status = parsed.status;
    const { error } = await registry.from("chargers").update(chargerUpdate).eq("id", charger.id);
    if (error) throw error;
    return {};
  }

  if (action === "StartTransaction") {
    const parsed = StartTransactionSchema.parse(payload);
    const { data: connectorRows, error: connectorError } = await registry.from("connectors")
      .select("connector_id").eq("charger_id", charger.id);
    if (connectorError) throw connectorError;
    const registeredConnectorIds = (connectorRows ?? []).map((connector) => connector.connector_id);
    if (!isRegisteredConnector(parsed.connectorId, registeredConnectorIds, charger.connector_count)) {
      await setLastOcppError(charger, `StartTransaction rejected: connector ${parsed.connectorId} is not registered`);
      return { transactionId: 0, idTagInfo: { status: "Invalid" } };
    }
    const grant = await resolveIdTagGrant(charger, parsed.idTag);
    if (!grant || grant.chargerId !== charger.id || !grant.authorized || grant.expiresAt <= Date.now()) {
      await setLastOcppError(charger, "StartTransaction rejected: no active authorization for idTag");
      return { transactionId: 0, idTagInfo: { status: "Invalid" } };
    }
    const { data: active, error: activeError } = await registry.from("sessions").select("id")
      .eq("charger_id", charger.id).eq("connector_id", parsed.connectorId).is("ended_at", null).maybeSingle();
    if (activeError) throw activeError;
    if (active) {
      idTagGrants.delete(parsed.idTag);
      await setLastOcppError(charger, "StartTransaction rejected: connector already has an active transaction");
      return { transactionId: 0, idTagInfo: { status: "ConcurrentTx" } };
    }

    const transactionId = await nextTransactionId(charger.id);
    const { error } = await registry.from("sessions").insert({
      organization_id: charger.organization_id,
      site_id: charger.site_id,
      charger_id: charger.id,
      connector_id: parsed.connectorId,
      gateway_guarded: true,
      ocpp_transaction_id: transactionId,
      id_tag: grant.authorizationType === "RFID" ? hashIdTag(parsed.idTag) : parsed.idTag,
      authorization_type: grant.authorizationType,
      authorized_user_id: grant.userId,
      started_at: parsed.timestamp,
      start_meter_wh: parsed.meterStart,
    });
    if (error?.code === "23505") {
      idTagGrants.delete(parsed.idTag);
      return { transactionId: 0, idTagInfo: { status: "ConcurrentTx" } };
    }
    if (error) throw error;
    if (grant.authorizationType === "RFID") await updateCapabilities(charger, "rfid", { state: "SUPPORTED", evidence: "Accepted allowlisted physical idTag StartTransaction", observedAt: now });
    const { error: diagnosticsError } = await registry.from("chargers").update({ last_transaction_at: parsed.timestamp, last_transaction_id: transactionId }).eq("id", charger.id);
    if (diagnosticsError) reportPersistenceFailure("start_transaction_diagnostics", charger.id, diagnosticsError);
    try { await reconcileCommandFromOperation(charger, "RemoteStartTransaction", "idTag", parsed.idTag, "StartTransaction"); }
    catch (error) { reportPersistenceFailure("start_command_reconciliation", charger.id, error); }
    idTagGrants.delete(parsed.idTag);
    return { transactionId, idTagInfo: { status: "Accepted" } };
  }

  if (action === "StopTransaction") {
    const parsed = StopTransactionSchema.parse(payload);
    const { data: session, error: findError } = await registry.from("sessions").select("id, start_meter_wh")
      .eq("charger_id", charger.id).eq("ocpp_transaction_id", parsed.transactionId).is("ended_at", null).maybeSingle();
    if (findError) throw findError;
    if (!session) return { idTagInfo: { status: "Invalid" } };
    if (session.start_meter_wh !== null && parsed.meterStop < Number(session.start_meter_wh)) {
      throw new Error("Invalid StopTransaction: meterStop is lower than StartTransaction meterStart");
    }
    const { error } = await registry.from("sessions").update({
      ended_at: parsed.timestamp,
      end_meter_wh: parsed.meterStop,
      stop_reason: parsed.reason ?? null,
    }).eq("id", session.id);
    if (error) throw error;
    const { error: diagnosticsError } = await registry.from("chargers").update({ last_transaction_at: parsed.timestamp, last_transaction_id: parsed.transactionId }).eq("id", charger.id);
    if (diagnosticsError) reportPersistenceFailure("stop_transaction_diagnostics", charger.id, diagnosticsError);
    try { await reconcileCommandFromOperation(charger, "RemoteStopTransaction", "transactionId", String(parsed.transactionId), "StopTransaction"); }
    catch (error) { reportPersistenceFailure("stop_command_reconciliation", charger.id, error); }
    return { idTagInfo: { status: "Accepted" } };
  }

  if (action === "MeterValues") {
    const parsed = MeterValuesSchema.parse(payload);
    let sessionId: string | null = null;
    let startMeterWh: number | null = null;
    let previousRegisterWh: number | null = null;
    if (parsed.transactionId !== undefined) {
      const { data: session, error } = await registry.from("sessions").select("id, connector_id, start_meter_wh")
        .eq("charger_id", charger.id).eq("ocpp_transaction_id", parsed.transactionId)
        .order("started_at", { ascending: false }).limit(1).maybeSingle();
      if (error) throw error;
      if (!session) throw new Error(`Invalid MeterValues: ${meterTransactionError(null, parsed.transactionId, parsed.connectorId)}`);
      const transactionError = meterTransactionError(session, parsed.transactionId, parsed.connectorId);
      if (transactionError) throw new Error(`Invalid MeterValues: ${transactionError}`);
      sessionId = session.id;
      startMeterWh = session.start_meter_wh === null ? null : Number(session.start_meter_wh);
      const { data: latestRegister, error: latestRegisterError } = await registry.from("meter_values")
        .select("value, unit")
        .eq("session_id", session.id)
        .eq("measurand", "Energy.Active.Import.Register")
        .eq("requires_review", false)
        .order("sampled_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (latestRegisterError) throw latestRegisterError;
      if (latestRegister) previousRegisterWh = energyRegisterWh(Number(latestRegister.value), latestRegister.unit);
    }
    const readings: Record<string, unknown>[] = [];
    const orderedMeterValues = [...parsed.meterValue].sort((a, b) => a.timestamp.localeCompare(b.timestamp));
    for (const sample of orderedMeterValues) {
      for (const reading of sample.sampledValue) {
        const value = Number(reading.value);
        if (!Number.isFinite(value)) throw new Error("Invalid MeterValues: meter value is not numeric");
        const measurand = reading.measurand ?? "Energy.Active.Import.Register";
        const unit = reading.unit ?? (measurand.startsWith("Energy.") ? "Wh" : measurand.startsWith("Power.") ? "W" : null);
        const readingError = meterReadingError(measurand, value, unit ?? "", startMeterWh);
        if (readingError) throw new Error(`Invalid MeterValues: ${readingError}`);
        let requiresReview = false;
        let reviewReason: string | null = null;
        if (measurand === "Energy.Active.Import.Register") {
          const valueWh = energyRegisterWh(value, unit);
          if (valueWh === null) throw new Error("Invalid MeterValues: energy register unit must be Wh or kWh");
          reviewReason = energyRegisterRegressionError(valueWh, previousRegisterWh);
          requiresReview = reviewReason !== null;
          if (!requiresReview) previousRegisterWh = valueWh;
        }
        readings.push({
          organization_id: charger.organization_id,
          session_id: sessionId,
          charger_id: charger.id,
          connector_id: parsed.connectorId,
          sampled_at: sample.timestamp,
          measurand,
          value,
          unit,
          phase: reading.phase ?? null,
          context: reading.context ?? null,
          requires_review: requiresReview,
          review_reason: reviewReason,
        });
      }
    }
    if (!readings.length) throw new Error("Invalid MeterValues: no readings");
    const { error } = await registry.from("meter_values").insert(readings);
    if (error) throw error;
    return {};
  }

  return responseFor(action, payload);
}

async function restoreIdTagGrant(charger: ChargerRecord, idTag: string): Promise<IdTagGrant | null> {
  if (!registry) return null;
  const { data, error } = await registry.from("commands")
    .select("requested_at, requested_by, payload")
    .eq("charger_id", charger.id)
    .eq("action", "RemoteStartTransaction")
    .filter("payload->>idTag", "eq", idTag)
    .in("status", ["sent", "accepted", "unknown", "operation_timeout"])
    .gte("requested_at", new Date(Date.now() - 10 * 60_000).toISOString())
    .order("requested_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;

  const expiresAt = new Date(data.requested_at).getTime() + 10 * 60_000;
  if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) return null;
  const grant = { chargerId: charger.id, expiresAt, authorized: true, authorizationType: "REMOTE" as const, userId: data.requested_by as string | null };
  idTagGrants.set(idTag, grant);
  return grant;
}

async function resolveIdTagGrant(charger: ChargerRecord, idTag: string): Promise<IdTagGrant | null> {
  const cached = idTagGrants.get(idTag);
  const remote = cached?.authorizationType === "REMOTE" ? cached : await restoreIdTagGrant(charger, idTag);
  if (remote && remote.chargerId === charger.id && remote.expiresAt > Date.now()) return remote;
  if (!registry) return null;
  const { data, error } = await registry.from("charger_authorizations")
    .select("user_id, authorization_type, expires_at")
    .eq("charger_id", charger.id).eq("id_tag_hash", hashIdTag(idTag)).eq("enabled", true).maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const expiresAt = data.expires_at ? new Date(data.expires_at).getTime() : Date.now() + 10 * 60_000;
  if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) return null;
  const grant: IdTagGrant = {
    chargerId: charger.id,
    expiresAt,
    authorized: true,
    authorizationType: data.authorization_type === "QR" ? "QR" : data.authorization_type === "APP" ? "APP" : "RFID",
    userId: data.user_id,
  };
  idTagGrants.set(idTag, grant);
  return grant;
}

function hashIdTag(idTag: string) {
  return createHash("sha256").update(idTag, "utf8").digest("hex");
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

async function logCall(
  charger: ChargerRecord | null,
  messageId: string,
  action: string,
  outcome: string,
  direction: "inbound" | "outbound" = "inbound",
  metadata: { requestId?: string; userId?: string | null; connectorId?: number; transactionId?: number; reason?: string } = {},
) {
  if (!registry || !charger) return;
  const { error } = await registry.from("ocpp_messages").insert({
    organization_id: charger.organization_id,
    charger_id: charger.id,
    message_id: messageId,
    action,
    direction,
    outcome,
    request_id: metadata.requestId ?? messageId,
    user_id: metadata.userId ?? null,
    connector_id: metadata.connectorId ?? null,
    transaction_id: metadata.transactionId ?? null,
    reason: metadata.reason ?? null,
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
  if (!registry || !startupRecoveryComplete || pollingCommands) return;
  pollingCommands = true;
  try {
    await expireAcceptedOperations();
    const { data, error } = await registry.from("commands").select("id, charger_id, action, payload, requested_by")
      .eq("status", "pending").order("requested_at", { ascending: true }).limit(25);
    if (error) throw error;
    for (const command of data ?? []) await dispatchCommand(command);
  } catch (error) {
    reportPersistenceFailure("command_poll", "gateway", error);
  } finally {
    pollingCommands = false;
  }
}

async function expireAcceptedOperations() {
  if (!registry) return;
  const cutoff = new Date(Date.now() - operationConfirmationSeconds * 1000).toISOString();
  const { data, error } = await registry.from("commands")
    .select("id, charger_id, action, payload, ocpp_message_id")
    .eq("status", "accepted").in("action", ["RemoteStartTransaction", "RemoteStopTransaction"])
    .lte("completed_at", cutoff).limit(50);
  if (error) throw error;
  for (const command of data ?? []) {
    const result = { error: "transaction_confirmation_timeout", timeout_seconds: operationConfirmationSeconds };
    const { data: updated, error: updateError } = await registry.from("commands")
      .update({ status: operationConfirmationTimeoutStatus(), result, completed_at: new Date().toISOString() })
      .eq("id", command.id).eq("status", "accepted").select("id").maybeSingle();
    if (updateError) throw updateError;
    if (updated && command.ocpp_message_id) {
      const charger = await getCharger(command.charger_id);
      await logCall(charger, command.ocpp_message_id, command.action, "operation_timeout", "outbound", {
        requestId: command.id,
        reason: "transaction_confirmation_timeout",
      });
    }
  }
}

async function getCharger(chargerId: string): Promise<ChargerRecord | null> {
  if (!registry) return null;
  const { data, error } = await registry.from("chargers")
        .select("id, organization_id, site_id, ocpp_credential_hash, connector_count, capabilities, removed_at").eq("id", chargerId).maybeSingle();
  if (error) throw error;
  return data as ChargerRecord | null;
}

async function dispatchCommand(command: { id: string; charger_id: string; action: string; payload: Record<string, unknown>; requested_by: string | null }) {
  if (!registry) return;
  const currentCharger = await getCharger(command.charger_id);
  if (!currentCharger || currentCharger.removed_at) {
    await failPendingCommand(command.id, { error: "charger_removed" });
    return;
  }
  if (!(["RemoteStartTransaction", "RemoteStopTransaction", "GetConfiguration"] as string[]).includes(command.action)) {
    await failPendingCommand(command.id, { error: "unsupported_action" });
    return;
  }
  const connection = chargerConnections.get(command.charger_id);
  const charger = connection ? socketChargers.get(connection.websocket) : null;
  if (!connection || !charger || connection.websocket.readyState !== WebSocket.OPEN) {
    await failPendingCommand(command.id, { error: "charger_offline" });
    return;
  }
  if (command.action === "RemoteStartTransaction" && (typeof command.payload.idTag !== "string" || command.payload.idTag.length > 20)) {
    await failPendingCommand(command.id, { error: "invalid_id_tag" });
    return;
  }
  if (command.action === "RemoteStartTransaction" && command.payload.connectorId !== undefined &&
    (typeof command.payload.connectorId !== "number" || !Number.isInteger(command.payload.connectorId) || command.payload.connectorId < 1)) {
    await failPendingCommand(command.id, { error: "invalid_connector_id" });
    return;
  }
  if (command.action === "RemoteStopTransaction" && (typeof command.payload.transactionId !== "number" || !Number.isInteger(command.payload.transactionId))) {
    await failPendingCommand(command.id, { error: "invalid_transaction_id" });
    return;
  }
  if (command.action === "GetConfiguration" && (!Array.isArray(command.payload.key) || command.payload.key.length > 20 || command.payload.key.some((key) => typeof key !== "string"))) {
    await failPendingCommand(command.id, { error: "invalid_configuration_keys" });
    return;
  }

  const messageId = randomUUID();
  const { data: claimed, error: claimError } = await registry.from("commands").update({
    status: "sent",
    sent_at: new Date().toISOString(),
    ocpp_message_id: messageId,
  })
    .eq("id", command.id).eq("status", "pending").select("id").maybeSingle();
  if (claimError) throw claimError;
  if (!claimed) return;

  const idTag = command.action === "RemoteStartTransaction" ? String(command.payload.idTag) : undefined;
  if (idTag) idTagGrants.set(idTag, { chargerId: charger.id, expiresAt: Date.now() + 10 * 60_000, authorized: true, authorizationType: "REMOTE", userId: command.requested_by });
  const timeout = setTimeout(() => {
    void completePendingCommand(messageId, { error: "charger_response_timeout" }, "timeout")
      .catch((error) => reportPersistenceFailure("command_timeout", command.charger_id, error));
  }, 20_000);
  pendingCommands.set(messageId, { charger, commandId: command.id, action: command.action, idTag, userId: command.requested_by, timeout });
  try {
    connection.websocket.send(JSON.stringify([2, messageId, command.action, command.payload]), (error) => {
      if (error) void completePendingCommand(messageId, { error: "send_failed" }, "failed", charger)
        .catch((completionError) => reportPersistenceFailure("command_send", command.charger_id, completionError));
    });
    void logCall(charger, messageId, command.action, "sent", "outbound", { requestId: command.id, userId: command.requested_by });
  } catch (error) {
    await completePendingCommand(messageId, { error: error instanceof Error ? error.message : "send_failed" }, "failed", charger);
  }
}

async function completePendingCommand(
  messageId: string,
  result: Record<string, unknown>,
  forcedStatus?: "failed" | "timeout",
  responseCharger?: ChargerRecord | null,
) {
  const pending = pendingCommands.get(messageId);
  if (!pending) {
    if (forcedStatus || !responseCharger) return;
    await reconcileDelayedCommand(messageId, result, responseCharger);
    return;
  }
  const status = commandStatusForResult(pending.action, result, forcedStatus);
  const safeResult = pending.action === "GetConfiguration" ? sanitizeConfigurationResult(result) : result;
  const storedResult = status === "accepted" ? { ...safeResult, accepted_at: new Date().toISOString() } : safeResult;
  const updated = await updateCommand(pending.commandId, messageId, status, storedResult, ["sent"]);
  if (!updated) {
    clearTimeout(pending.timeout);
    pendingCommands.delete(messageId);
    if (status !== "accepted" && pending.idTag) idTagGrants.delete(pending.idTag);
    return;
  }
  clearTimeout(pending.timeout);
  pendingCommands.delete(messageId);
  if (status !== "accepted" && pending.idTag) idTagGrants.delete(pending.idTag);
  if (pending.action === "RemoteStartTransaction" || pending.action === "RemoteStopTransaction") {
    const capabilityKey = pending.action === "RemoteStartTransaction" ? "remoteStart" : "remoteStop";
    await updateCommandCapability(pending.charger, capabilityKey, result);
  }
  if (pending.action === "GetConfiguration") await persistConfigurationCapability(pending.charger, safeResult);
  if (status !== "accepted" && status !== "confirmed") await setLastOcppError(pending.charger, typeof safeResult.error === "string" ? safeResult.error : typeof safeResult.code === "string" ? `OCPP ${safeResult.code}` : status === "rejected" ? `${pending.action} rejected by charger` : status);
  await logCall(pending.charger, messageId, pending.action, status, "outbound", {
    requestId: pending.commandId,
    userId: pending.userId,
    reason: typeof safeResult.error === "string" ? safeResult.error : typeof safeResult.code === "string" ? `OCPP ${safeResult.code}` : safeResult.status === "Rejected" ? `${pending.action} rejected by charger` : undefined,
    connectorId: typeof result.connectorId === "number" ? result.connectorId : undefined,
    transactionId: typeof result.transactionId === "number" ? result.transactionId : undefined,
  });
}

async function reconcileDelayedCommand(messageId: string, result: Record<string, unknown>, charger: ChargerRecord) {
  if (!registry) return;
  const { data: command, error: lookupError } = await registry.from("commands")
    .select("id, action, payload, requested_by")
    .eq("charger_id", charger.id)
    .eq("ocpp_message_id", messageId)
    .in("status", ["sent", "timeout", "unknown", "operation_timeout"])
    .maybeSingle();
  if (lookupError) throw lookupError;
  if (!command) return;

  const status = commandStatusForResult(command.action, result);
  const safeResult = command.action === "GetConfiguration" ? sanitizeConfigurationResult(result) : result;
  const updated = await updateCommand(command.id, messageId, status, safeResult, ["sent", "timeout", "unknown", "operation_timeout"]);
  if (updated) {
    if (status !== "accepted" && typeof command.payload.idTag === "string") idTagGrants.delete(command.payload.idTag);
    if (command.action === "RemoteStartTransaction" || command.action === "RemoteStopTransaction") {
      const capabilityKey = command.action === "RemoteStartTransaction" ? "remoteStart" : "remoteStop";
      await updateCommandCapability(charger, capabilityKey, result);
    }
    if (command.action === "GetConfiguration") await persistConfigurationCapability(charger, safeResult);
    await logCall(charger, messageId, command.action, status, "outbound", { requestId: command.id, userId: command.requested_by, reason: typeof safeResult.error === "string" ? safeResult.error : typeof safeResult.code === "string" ? `OCPP ${safeResult.code}` : undefined });
  }
}

async function reconcileCommandFromOperation(
  charger: ChargerRecord,
  action: "RemoteStartTransaction" | "RemoteStopTransaction",
  payloadKey: "idTag" | "transactionId",
  value: string,
  operation: "StartTransaction" | "StopTransaction",
) {
  if (!registry) return;
  const { data: command, error: lookupError } = await registry.from("commands")
    .select("id, ocpp_message_id, status, requested_by")
    .eq("charger_id", charger.id)
    .eq("action", action)
    .filter(`payload->>${payloadKey}`, "eq", value)
    .in("status", ["sent", "accepted", "timeout", "unknown", "operation_timeout"])
    .gte("requested_at", new Date(Date.now() - 10 * 60_000).toISOString())
    .order("requested_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (lookupError) throw lookupError;
  if (!command) return;

  const confirmedStatus = operationEventStatus(action, operation);
  if (!confirmedStatus) return;

  const { data, error } = await registry.from("commands").update({
    status: confirmedStatus,
    result: { status: "Accepted", confirmed_by: operation },
    completed_at: new Date().toISOString(),
  }).eq("id", command.id).eq("status", command.status).select("id").maybeSingle();
  if (error) throw error;
  if (data && command.ocpp_message_id) await logCall(charger, command.ocpp_message_id, action, `confirmed_by_${operation}`, "outbound", { requestId: command.id, userId: command.requested_by });
}

async function updateCapabilities(charger: ChargerRecord, key: string, value: unknown) {
  if (!registry) return;
  const { data, error: readError } = await registry.from("chargers").select("capabilities").eq("id", charger.id).maybeSingle();
  if (readError) throw readError;
  const capabilities = mergeCapability(data?.capabilities as Record<string, unknown> | null, key, value);
  const { error } = await registry.from("chargers").update({ capabilities }).eq("id", charger.id);
  if (error) throw error;
  charger.capabilities = capabilities;
}

async function persistConfigurationCapability(charger: ChargerRecord, result: Record<string, unknown>) {
  if (!registry) return;
  const now = new Date().toISOString();
  if (result.code === "NotSupported") {
    await updateCapabilities(charger, "authorizeRemoteTxRequests", { state: "UNSUPPORTED", value: null, observedAt: now, evidence: "GetConfiguration CALLERROR NotSupported" });
    return;
  }
  const value = readAuthorizeRemoteTxRequests(result);
  const unknownKeys = Array.isArray(result.unknownKey) ? result.unknownKey : [];
  const wasUnknown = unknownKeys.includes("AuthorizeRemoteTxRequests");
  await updateCapabilities(charger, "authorizeRemoteTxRequests", {
    state: value === null ? wasUnknown ? "UNSUPPORTED" : "UNKNOWN" : "SUPPORTED",
    value: value === null ? null : String(value),
    observedAt: now,
    evidence: value === null ? "GetConfiguration did not report the key" : "GetConfiguration response",
  });
  if (wasUnknown) await setLastOcppError(charger, "GetConfiguration: AuthorizeRemoteTxRequests indisponível neste carregador");
}

function sanitizeConfigurationResult(result: Record<string, unknown>): Record<string, unknown> {
  const configurationKey = Array.isArray(result.configurationKey)
    ? result.configurationKey.filter((item) => item && typeof item === "object" && (item as Record<string, unknown>).key === "AuthorizeRemoteTxRequests")
    : [];
  const unknownKey = Array.isArray(result.unknownKey)
    ? result.unknownKey.filter((item) => item === "AuthorizeRemoteTxRequests")
    : [];
  return {
    ...(configurationKey.length ? { configurationKey } : {}),
    ...(unknownKey.length ? { unknownKey } : {}),
    ...(typeof result.code === "string" ? { code: result.code } : {}),
    ...(typeof result.error === "string" ? { error: result.error.slice(0, 120) } : {}),
  };
}

async function updateCommandCapability(charger: ChargerRecord, key: "remoteStart" | "remoteStop", result: Record<string, unknown>) {
  const observed = capabilityFromCommandResult(result);
  const prior = charger.capabilities?.[key] as { state?: string } | undefined;
  if (observed.state === "UNKNOWN" && prior && prior.state !== "UNKNOWN") return;
  await updateCapabilities(charger, key, { ...observed, observedAt: new Date().toISOString() });
}

async function setLastOcppError(charger: ChargerRecord, reason: string) {
  if (!registry) return;
  const { error } = await registry.from("chargers").update({ last_ocpp_error: reason.slice(0, 500) }).eq("id", charger.id);
  if (error) throw error;
}

async function callMetadata(charger: ChargerRecord | null, action: string, payload: Record<string, unknown>) {
  const metadata: { userId?: string | null; connectorId?: number; transactionId?: number; reason?: string } = {
    connectorId: typeof payload.connectorId === "number" ? payload.connectorId : undefined,
    transactionId: typeof payload.transactionId === "number" ? payload.transactionId : undefined,
    reason: action === "StatusNotification" && typeof payload.errorCode === "string" && payload.errorCode !== "NoError" ? payload.errorCode : undefined,
  };
  if (charger && action === "StartTransaction" && typeof payload.idTag === "string") {
    metadata.userId = (await resolveIdTagGrant(charger, payload.idTag))?.userId ?? null;
  }
  if (charger && action === "StopTransaction" && typeof payload.transactionId === "number" && registry) {
    const { data } = await registry.from("sessions").select("authorized_user_id")
      .eq("charger_id", charger.id).eq("ocpp_transaction_id", payload.transactionId).maybeSingle();
    metadata.userId = data?.authorized_user_id ?? null;
  }
  return metadata;
}

async function safeCallMetadata(charger: ChargerRecord | null, action: string, payload: Record<string, unknown>) {
  try { return await callMetadata(charger, action, payload); }
  catch (error) {
    if (charger) reportPersistenceFailure("ocpp_message_metadata", charger.id, error);
    return {};
  }
}

async function updateCommand(
  commandId: string,
  messageId: string,
  status: "accepted" | "rejected" | "timeout" | "failed" | "unknown" | "confirmed",
  result: Record<string, unknown>,
  previousStatuses: string[],
): Promise<boolean> {
  if (!registry) return false;
  const { data, error } = await registry.from("commands").update({ status, result, completed_at: new Date().toISOString() })
    .eq("id", commandId).eq("ocpp_message_id", messageId).in("status", previousStatuses).select("id").maybeSingle();
  if (error) throw error;
  return Boolean(data);
}

async function failPendingCommand(commandId: string, result: Record<string, unknown>) {
  if (!registry) return;
  const { error } = await registry.from("commands").update({
    status: "failed",
    result,
    completed_at: new Date().toISOString(),
  }).eq("id", commandId).eq("status", "pending");
  if (error) throw error;
}

async function recoverInterruptedCommands() {
  if (!registry) return;
  const { data, error } = await registry.from("commands").update({
    status: "unknown",
    result: { error: "gateway_restarted_before_confirmation" },
    completed_at: new Date().toISOString(),
  }).eq("status", "sent").select("id");
  if (error) throw error;
  if (data?.length) console.warn(JSON.stringify({
    event: "ocpp.commands_recovered",
    count: data.length,
    outcome: "unknown_without_automatic_redelivery",
  }));
}

setInterval(() => { void pollPendingCommands(); }, 1_500).unref();
setInterval(() => { void disconnectRemovedChargerConnections(); }, 1_000).unref();
setInterval(() => {
  const now = Date.now();
  for (const [idTag, grant] of idTagGrants) if (grant.expiresAt <= now) idTagGrants.delete(idTag);
}, 30_000).unref();

function reportPersistenceFailure(action: string, chargePointId: string, error: unknown) {
  const reason = error instanceof Error ? error.message : "database write failed";
  console.error(JSON.stringify({ event: "ocpp.persistence_failed", action, chargePointId, reason }));
}

async function disconnectRemovedChargerConnections() {
  if (!registry || chargerConnections.size === 0) return;
  const chargerIds = [...chargerConnections.keys()];
  const { data, error } = await registry.from("chargers").select("id, ocpp_credential_hash, removed_at")
    .in("id", chargerIds);
  if (error) {
    reportPersistenceFailure("removed_charger_disconnect_check", "gateway", error);
    return;
  }
  for (const row of data ?? []) {
    const connection = chargerConnections.get(row.id);
    if (!connection) continue;
    const reason = row.removed_at ? "Charger removed" : row.ocpp_credential_hash !== connection.credentialHash ? "Credential rotated" : null;
    if (!reason) continue;
    chargerConnections.delete(row.id);
    if (connections.get(connection.chargePointId) === connection.websocket) connections.delete(connection.chargePointId);
    for (const [idTag, grant] of idTagGrants) if (grant.chargerId === row.id) idTagGrants.delete(idTag);
    if (connection.websocket.readyState === WebSocket.OPEN) connection.websocket.close(4001, reason);
    console.info(JSON.stringify({ event: row.removed_at ? "ocpp.removed_charger_disconnected" : "ocpp.credential_rotated_disconnected", chargePointId: connection.chargePointId }));
  }
}

function safeEqual(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

async function startGateway() {
  await recoverInterruptedCommands();
  startupRecoveryComplete = true;
  server.listen(port, "0.0.0.0", () => console.info(JSON.stringify({ event: "gateway.started", port, healthPath: "/health", ocppPath: "/ocpp/{chargePointId}" })));
}

void startGateway().catch((error) => {
  reportPersistenceFailure("startup_command_recovery", "gateway", error);
  process.exit(1);
});

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => {
    sockets.close();
    server.close(() => process.exit(0));
  });
}
