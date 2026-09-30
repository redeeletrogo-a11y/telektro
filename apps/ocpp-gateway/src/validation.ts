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
  if (measurand === "SoC" && (value < 0 || value > 100)) return "SoC must be between 0 and 100 percent";
  if (measurand !== "Energy.Active.Import.Register" || startMeterWh == null) return null;

  const normalizedUnit = unit.toLowerCase();
  const valueWh = normalizedUnit === "kwh" ? value * 1000 : normalizedUnit === "wh" ? value : null;
  if (valueWh === null) return "energy register unit must be Wh or kWh";
  if (valueWh < startMeterWh) return "energy register is lower than StartTransaction meterStart";
  return null;
}

export function energyRegisterWh(value: number, unit: string | null | undefined) {
  const normalizedUnit = unit?.toLowerCase();
  if (normalizedUnit === "kwh") return value * 1000;
  if (normalizedUnit === "wh") return value;
  return null;
}

export function energyRegisterRegressionError(valueWh: number, previousWh: number | null) {
  return previousWh !== null && valueWh < previousWh
    ? `energy register decreased from ${previousWh} Wh to ${valueWh} Wh`
    : null;
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
