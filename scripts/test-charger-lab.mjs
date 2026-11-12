import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "../apps/web/node_modules/typescript/lib/typescript.js";
const source = fs.readFileSync(
  new URL("../apps/web/src/lib/charger-lab/core.ts", import.meta.url),
  "utf8",
);
const js = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.ESNext,
    target: ts.ScriptTarget.ES2022,
  },
}).outputText;
const { findDemoUnits, checkDemoProof, createAdapter } = await import(
  "data:text/javascript;base64," + Buffer.from(js).toString("base64")
);
assert.equal(
  findDemoUnits("12345").length,
  2,
  "collision never claims first unit",
);
assert.equal(findDemoUnits("67890").length, 1);
assert.equal(findDemoUnits("TELEKTRO-DEMO:TK-DEMO-C-67890").length, 1);
for (const value of [
  "https://example.com/12345",
  "1234",
  "123456",
  "real-67890",
  "<script>",
])
  assert.equal(findDemoUnits(value).length, 0);
const unit = findDemoUnits("67890")[0];
assert.equal(checkDemoProof(unit, "wrong"), false);
assert.equal(checkDemoProof(unit, "DEMO-OK"), true);
assert.equal(checkDemoProof({ id: "real", serial: "67890" }, "DEMO-OK"), false);
for (const t of ["ocpp", "lan", "ble"])
  assert.throws(() => createAdapter(t), /indisponível/);
const a = createAdapter("simulated");
await assert.rejects(() => a.start(), /Reconecte/);
assert.equal((await a.connect()).state, "idle");
assert.equal((await a.start()).state, "charging");
await assert.rejects(() => a.start(), /já iniciada/);
assert.equal((await a.read()).energyWh, 420);
assert.equal((await a.read()).energyWh, 420, "reads do not accumulate energy");
assert.equal((await a.disconnect()).state, "unknown");
assert.equal((await a.disconnect()).energyWh, null);
await assert.rejects(() => a.stop(), /Reconecte/);
assert.equal(
  (await a.connect()).state,
  "charging",
  "disconnect does not stop underlying fixture",
);
assert.equal((await a.read()).billable, false);
assert.equal(a.capabilities.realHardware, false);
assert.equal((await a.stop()).state, "idle");
assert.equal((await a.start()).energyWh, 0, "new session resets fixture");
console.log(
  "PASS: identity/collision, demo proof, real-adapter gates, state transitions, disconnection/reconciliation and non-billable fixture.",
);
