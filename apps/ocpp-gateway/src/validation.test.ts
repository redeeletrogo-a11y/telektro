import { describe, expect, it } from "vitest";
import { isRegisteredConnector, meterReadingError, meterTransactionError } from "./validation.js";

describe("OCPP input validation", () => {
  it("rejects a transaction connector outside the charger count or registered list", () => {
    expect(isRegisteredConnector(1, [1], 1)).toBe(true);
    expect(isRegisteredConnector(99, [1], 1)).toBe(false);
    expect(isRegisteredConnector(2, [1, 2], 1)).toBe(false);
    expect(isRegisteredConnector(2, [], null)).toBe(false);
  });

  it("rejects negative energy and import registers below the initial meterStart", () => {
    expect(meterReadingError("Energy.Active.Import.Register", -1, "Wh", 0)).toContain("negative");
    expect(meterReadingError("Energy.Active.Import.Register", 2, "Wh", 3)).toContain("lower than StartTransaction");
    expect(meterReadingError("Energy.Active.Import.Register", 0.002, "kWh", 3)).toContain("lower than StartTransaction");
    expect(meterReadingError("Energy.Active.Import.Register", 4, "J", 3)).toContain("unit must be Wh or kWh");
  });

  it("accepts non-negative readings at or above meterStart", () => {
    expect(meterReadingError("Energy.Active.Import.Register", 3, "Wh", 3)).toBeNull();
    expect(meterReadingError("Power.Active.Import", 7200, "W", 3)).toBeNull();
  });

  it("rejects MeterValues for unknown transactions or a different connector", () => {
    expect(meterTransactionError(null, 123, 1)).toContain("unknown transactionId");
    expect(meterTransactionError({ connector_id: 1 }, 123, 2)).toContain("does not match transactionId");
    expect(meterTransactionError({ connector_id: 1 }, 123, 1)).toBeNull();
  });
});
