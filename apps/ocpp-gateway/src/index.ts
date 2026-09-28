import { createServer } from "node:http";
import { timingSafeEqual } from "node:crypto";
import { WebSocket, WebSocketServer } from "ws";
import { createClient } from "@supabase/supabase-js";
import { verifyOcppBasicAuth } from "./authentication.js";
import { parseOcppCall, responseFor } from "./protocol.js";

const port = Number(process.env.OCPP_GATEWAY_PORT ?? 9000);
const developmentToken = process.env.OCPP_DEV_TOKEN;
const connections = new Map<string, WebSocket>();
const heartbeatSeconds = Number(process.env.OCPP_HEARTBEAT_INTERVAL_SECONDS ?? 60);
const supabaseUrl = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const registry = supabaseUrl && serviceRoleKey
  ? createClient(supabaseUrl, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } })
  : null;

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
  let isDeviceAuth = false;

  if (chargePointId && registry && request.headers.authorization) {
    try {
      const { data, error } = await registry.from("chargers").select("ocpp_credential_hash")
        .eq("charge_point_id", chargePointId).maybeSingle();
      if (error) throw error;
      isDeviceAuth = Boolean(data?.ocpp_credential_hash && verifyOcppBasicAuth(chargePointId, request.headers.authorization, data.ocpp_credential_hash));
    } catch {
      console.error(JSON.stringify({ event: "ocpp.authentication_failed", chargePointId, reason: "registry_lookup_failed" }));
    }
  }

  if (!chargePointId || (!isDevAuth && !isDeviceAuth)) {
    socket.write("HTTP/1.1 401 Unauthorized\r\nWWW-Authenticate: Basic realm=\"Telektro OCPP\"\r\nConnection: close\r\n\r\n");
    socket.destroy();
    console.warn(JSON.stringify({ event: "ocpp.connection_rejected", chargePointId: chargePointId ?? "invalid", reason: "authentication_not_configured" }));
    return;
  }

  sockets.handleUpgrade(request, socket, head, (websocket) => {
    sockets.emit("connection", websocket, request);
  });
});

sockets.on("connection", (websocket: WebSocket, request) => {
  const chargePointId = new URL(request.url ?? "/", `http://${request.headers.host ?? "localhost"}`).pathname.split("/").at(-1)!;
  connections.set(chargePointId, websocket);
  console.info(JSON.stringify({ event: "ocpp.connected", chargePointId }));

  websocket.on("message", (data) => {
    let messageId = "unknown";
    let action = "unknown";
    try {
      const [messageType, id, receivedAction, payload] = parseOcppCall(data.toString());
      messageId = id;
      action = receivedAction;
      if (messageType !== 2) throw new Error("Only CALL frames are supported by this foundation");
      const result = responseFor(action, payload);
      if (action === "BootNotification") result.interval = heartbeatSeconds;
      websocket.send(JSON.stringify([3, messageId, result]));
      console.info(JSON.stringify({ event: "ocpp.call_handled", chargePointId, action, messageId }));
    } catch (error) {
      const description = error instanceof Error ? error.message : "Invalid OCPP message";
      const code = description.startsWith("Unsupported action") ? "NotSupported" : "FormationViolation";
      if (websocket.readyState === WebSocket.OPEN) websocket.send(JSON.stringify([4, messageId, code, description, {}]));
      console.warn(JSON.stringify({ event: "ocpp.call_rejected", chargePointId, action, messageId, reason: description }));
    }
  });

  websocket.on("close", () => {
    if (connections.get(chargePointId) === websocket) connections.delete(chargePointId);
    console.info(JSON.stringify({ event: "ocpp.disconnected", chargePointId }));
  });
});

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
