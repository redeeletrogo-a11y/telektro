# Temporary unencrypted ws:// diagnostic endpoint (OCPP gateway)

Purpose: find out whether a charger with old firmware fails to connect because of TLS. TEMPORARY. Off by default.

- Env var `ENABLE_INSECURE_WS=true` starts a second listener (internal port `OCPP_INSECURE_WS_PORT`, default 9001), exposed by Fly on external port 8080 (see fly.toml).
- Charger URL: `ws://telektro-ocpp-gateway.fly.dev:8080/ocpp/<chargePointId>`
- Auth is unchanged: the same Basic auth credential (Auth Key) is required. Only the transport is unencrypted, so the credential and traffic are readable on the network. Use only for a short test, then regenerate the credential in Telektro.
- Logs (fly logs): `ocpp.insecure_upgrade_attempt` (any WebSocket attempt, with IP), `ocpp.connected_insecure_ws` (authenticated, with chargePointId and IP), `ocpp.connection_rejected` with `insecure: true` (bad credential).

Enable: `fly secrets set ENABLE_INSECURE_WS=true -a telektro-ocpp-gateway` (restarts the machine)
Disable: `fly secrets unset ENABLE_INSECURE_WS -a telektro-ocpp-gateway`
