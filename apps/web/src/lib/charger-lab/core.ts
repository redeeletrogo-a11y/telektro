/** Isolated prototype. This module has no access to billing, Supabase or hardware. */
export type Transport = "ocpp" | "lan" | "ble" | "simulated";
export type RegistrationStatus = "registered" | "simulated" | "validated";
export type ChargerState = "idle" | "charging" | "unknown";
export type Snapshot = {
  connected: boolean;
  state: ChargerState;
  energyWh: number | null;
  source: "simulation" | "device";
  billable: false;
};
export type Capabilities = {
  start: boolean;
  stop: boolean;
  energy: boolean;
  realHardware: boolean;
};
export interface ChargerAdapter {
  transport: Transport;
  capabilities: Capabilities;
  connect(): Promise<Snapshot>;
  start(): Promise<Snapshot>;
  stop(): Promise<Snapshot>;
  read(): Promise<Snapshot>;
  disconnect(): Promise<Snapshot>;
}
export const transportLabels: Record<Transport, string> = {
  ocpp: "OCPP",
  lan: "Wi-Fi / LAN",
  ble: "Bluetooth BLE",
  simulated: "Simulado",
};
export const statusLabels: Record<RegistrationStatus, string> = {
  registered: "Cadastrado · não conectado",
  simulated: "Simulado",
  validated: "Validado neste modelo",
};
export const families = [
  {
    id: "gwm",
    brand: "GWM",
    model: "G-Series / K-Series",
    note: "Zeeda Energy. Integração de terceiros não validada.",
  },
  {
    id: "byd",
    brand: "BYD",
    model: "Selecionar família na validação real",
    note: "Zhida, Duosida e linhas OCPP exigem análise separada.",
  },
  {
    id: "other",
    brand: "Outra marca",
    model: "Modelo a identificar",
    note: "Cadastro não significa compatibilidade.",
  },
] as const;
// Two intentionally fictional units share a suffix, to exercise collision handling.
const demoUnits = [
  { id: "demo-a", serial: "TK-DEMO-A-12345" },
  { id: "demo-b", serial: "TK-DEMO-B-12345" },
  { id: "demo-c", serial: "TK-DEMO-C-67890" },
];
export type DemoUnit = (typeof demoUnits)[number];
export function findDemoUnits(value: string): DemoUnit[] {
  const input = value.trim().toUpperCase();
  const qr = /^TELEKTRO-DEMO:(TK-DEMO-[ABC]-\d{5})$/.exec(input);
  if (qr) return demoUnits.filter((d) => d.serial === qr[1]);
  if (/^\d{5}$/.test(input))
    return demoUnits.filter((d) => d.serial.endsWith(input));
  return [];
}
export function checkDemoProof(unit: DemoUnit, code: string): boolean {
  // Not a production claim mechanism. Do not accept real device credentials here.
  return (
    demoUnits.some((d) => d.id === unit.id && d.serial === unit.serial) &&
    code.trim() === "DEMO-OK"
  );
}
export const adapterCatalog = (
  ["ocpp", "lan", "ble", "simulated"] as const
).map((transport) => ({
  transport,
  label: transportLabels[transport],
  implemented: transport === "simulated",
  note:
    transport === "simulated"
      ? "Disponível só com dados fictícios"
      : "Contrato reservado · driver não conectado neste laboratório",
}));
export function createAdapter(transport: Transport): ChargerAdapter {
  if (transport !== "simulated")
    throw new Error("Driver real indisponível neste laboratório.");
  let connected = false;
  let state: ChargerState = "idle";
  let energyWh = 0;
  const snapshot = (): Snapshot => ({
    connected,
    state: connected ? state : "unknown",
    energyWh: connected ? energyWh : null,
    source: "simulation",
    billable: false,
  });
  const requireConnection = () => {
    if (!connected)
      throw new Error("Reconecte para consultar o estado simulado.");
  };
  return {
    transport,
    capabilities: {
      start: true,
      stop: true,
      energy: true,
      realHardware: false,
    },
    async connect() {
      connected = true;
      return snapshot();
    },
    async start() {
      requireConnection();
      if (state === "charging") throw new Error("Sessão simulada já iniciada.");
      energyWh = 0;
      state = "charging";
      return snapshot();
    },
    // Fixed fixture, not an elapsed-time meter. Repeated reads never add energy.
    async read() {
      requireConnection();
      if (state === "charging") energyWh = 420;
      return snapshot();
    },
    async stop() {
      requireConnection();
      state = "idle";
      return snapshot();
    },
    // Losing the client connection must never be represented as a successful stop.
    async disconnect() {
      connected = false;
      return snapshot();
    },
  };
}
