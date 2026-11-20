import { describe, expect, it } from "vitest";
import { createPollGate, createThrottle, readMsEnv } from "./polling.js";

describe("createPollGate", () => {
  it("ocioso: roda so a cada idleMs", () => {
    let t = 0;
    const gate = createPollGate({ idleMs: 5_000, now: () => t });
    expect(gate.due()).toBe(true);
    t = 1_500; expect(gate.due()).toBe(false);
    t = 4_500; expect(gate.due()).toBe(false);
    t = 5_000; expect(gate.due()).toBe(true);
  });
  it("depois de boost roda a cada tick por boostMs, e volta ao ocioso", () => {
    let t = 0;
    const gate = createPollGate({ idleMs: 5_000, boostMs: 60_000, now: () => t });
    gate.due();
    t = 1_000; gate.boost();
    t = 2_500; expect(gate.due()).toBe(true);
    t = 4_000; expect(gate.due()).toBe(true);
    t = 61_000; expect(gate.due()).toBe(true); // ainda dentro do boost (1_000 + 60_000)
    t = 62_500; expect(gate.due()).toBe(false);
    t = 66_000; expect(gate.due()).toBe(true);
  });
});

describe("createThrottle", () => {
  it("limita a 1 por intervalo", () => {
    let t = 0;
    const due = createThrottle(30_000, () => t);
    expect(due()).toBe(true);
    t = 29_999; expect(due()).toBe(false);
    t = 30_000; expect(due()).toBe(true);
  });
});

describe("readMsEnv", () => {
  it("usa padrao e limita ao intervalo", () => {
    expect(readMsEnv(undefined, 5_000, 1_500, 30_000)).toBe(5_000);
    expect(readMsEnv("", 5_000, 1_500, 30_000)).toBe(5_000);
    expect(readMsEnv("abc", 5_000, 1_500, 30_000)).toBe(5_000);
    expect(readMsEnv("100", 5_000, 1_500, 30_000)).toBe(1_500);
    expect(readMsEnv("999999", 5_000, 1_500, 30_000)).toBe(30_000);
    expect(readMsEnv("2000", 5_000, 1_500, 30_000)).toBe(2_000);
  });
});
