import { describe, expect, it, vi } from "vitest";
import { createSettlementRequester, createSettlementWatcher, shouldSweepPending } from "./settlement.js";

const ok = () => Promise.resolve(new Response("{}", { status: 200 }));
describe("settlement requester", () => {
  it("does nothing without url and secret", async () => {
    const f = vi.fn(ok);
    const s = createSettlementRequester({ url: "", secret: "", fetchImpl: f as never });
    expect(s.enabled).toBe(false);
    s.request();
    expect(await s.sweepOnce()).toBe(false);
    expect(f).not.toHaveBeenCalled();
  });
  it("calls the sweep with the bearer secret", async () => {
    const f = vi.fn((_url: string, _init: RequestInit) => ok());
    const s = createSettlementRequester({ url: "https://x/sweep", secret: "s3", fetchImpl: f as never });
    expect(await s.sweepOnce()).toBe(true);
    expect(f.mock.calls[0][1].headers).toEqual({ authorization: "Bearer s3" });
  });
  it("reports failure on HTTP errors and network errors without throwing", async () => {
    const bad = createSettlementRequester({ url: "https://x", secret: "s", fetchImpl: (() => Promise.resolve(new Response("", { status: 500 }))) as never });
    expect(await bad.sweepOnce()).toBe(false);
    const down = createSettlementRequester({ url: "https://x", secret: "s", fetchImpl: (() => Promise.reject(new Error("net"))) as never });
    expect(await down.sweepOnce()).toBe(false);
  });
  it("never runs two sweeps at once and runs a trailing one", async () => {
    let release: () => void = () => undefined; let active = 0; let max = 0; let calls = 0;
    const f = () => { calls++; active++; max = Math.max(max, active); return new Promise<Response>((r) => { release = () => { active--; r(new Response("{}")); }; }); };
    const s = createSettlementRequester({ url: "https://x", secret: "s", fetchImpl: f as never });
    const first = s.sweepOnce(); await s.sweepOnce();
    release(); await first; await new Promise((r) => setTimeout(r, 5)); release(); await new Promise((r) => setTimeout(r, 5));
    expect(max).toBe(1); expect(calls).toBe(2);
  });
  it("retries once after a failure, then leaves it to the cron", async () => {
    vi.useFakeTimers();
    const f = vi.fn(() => Promise.resolve(new Response("", { status: 500 })));
    const s = createSettlementRequester({ url: "https://x", secret: "s", fetchImpl: f as never, delaysMs: [10], retryMs: 100 });
    s.request();
    await vi.advanceTimersByTimeAsync(10); expect(f).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(100); expect(f).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(1000); expect(f).toHaveBeenCalledTimes(2);
    vi.useRealTimers();
  });
});

describe("settlement watcher", () => {
  const now = Date.parse("2026-11-16T16:00:00Z");
  const row = (over: Partial<{ needs_attention: boolean; updated_at: string; paid_at: string }> = {}) => ({ id: "a", needs_attention: false, updated_at: "2026-11-16T15:59:00Z", paid_at: "2026-11-16T15:55:00Z", ...over });
  it("sweeps when a pending payment has no attention flag", () => { expect(shouldSweepPending([row()], now)).toBe(true); });
  it("does nothing with no pending payments", () => { expect(shouldSweepPending([], now)).toBe(false); });
  it("waits 10 minutes before retrying a failed payment", () => {
    expect(shouldSweepPending([row({ needs_attention: true })], now)).toBe(false);
    expect(shouldSweepPending([row({ needs_attention: true, updated_at: "2026-11-16T15:45:00Z" })], now)).toBe(true);
  });
  it("gives up on failed payments paid more than 6 hours ago", () => {
    expect(shouldSweepPending([row({ needs_attention: true, updated_at: "2026-11-16T15:00:00Z", paid_at: "2026-11-16T09:00:00Z" })], now)).toBe(false);
  });
  it("calls the sweep only when needed and survives errors", async () => {
    const sweep = vi.fn(() => Promise.resolve(true));
    expect(await createSettlementWatcher({ loadPending: () => Promise.resolve([]), sweep, now: () => now })()).toBe(false);
    expect(sweep).not.toHaveBeenCalled();
    expect(await createSettlementWatcher({ loadPending: () => Promise.resolve([row()]), sweep, now: () => now })()).toBe(true);
    expect(sweep).toHaveBeenCalledTimes(1);
    expect(await createSettlementWatcher({ loadPending: () => Promise.reject(new Error("db")), sweep, now: () => now })()).toBe(false);
  });
});
