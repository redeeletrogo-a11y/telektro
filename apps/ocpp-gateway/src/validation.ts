export function isRegisteredConnector(
  connectorId: number,
  registeredConnectorIds: number[],
  configuredConnectorCount: number | null | undefined,
) {
  if (!Number.isInteger(connectorId) || connectorId < 1) return false;
  if (Number.isInteger(configuredConnectorCount) && configuredConnectorCount! > 0) {
    return connectorId <= configuredConnectorCount! &&
      (!registeredConnectorIds.length || registeredConnectorIds.includes(connectorId));
  }
  return registeredConnectorIds.includes(connectorId);
}

export function meterReadingError(
  measurand: string,
  value: number,
  unit: string,
  startMeterWh?: number | null,
) {
  if (!Number.isFinite(value)) return "meter value is not numeric";
  if (measurand.startsWith("Energy.") && value < 0) return "energy meter value cannot be negative";
  if (measurand !== "Energy.Active.Import.Register" || startMeterWh == null) return null;

  const normalizedUnit = unit.toLowerCase();
  const valueWh = normalizedUnit === "kwh" ? value * 1000 : normalizedUnit === "wh" ? value : null;
  if (valueWh === null) return "energy register unit must be Wh or kWh";
  if (valueWh < startMeterWh) return "energy register is lower than StartTransaction meterStart";
  return null;
}

export function meterTransactionError(
  session: { connector_id: number | null } | null,
  transactionId: number,
  connectorId: number,
) {
  if (!session) return `unknown transactionId ${transactionId}`;
  if (session.connector_id !== null && session.connector_id !== connectorId) {
    return `connector ${connectorId} does not match transactionId ${transactionId}`;
  }
  return null;
}
