"use client";
import { useRef, useState } from "react";
import Link from "next/link";
import {
  adapterCatalog,
  checkDemoProof,
  createAdapter,
  families,
  findDemoUnits,
  statusLabels,
  type ChargerAdapter,
  type DemoUnit,
  type RegistrationStatus,
  type Snapshot,
  type Transport,
} from "@/lib/charger-lab/core";
import "./charger-lab.css";

export function ChargerLab() {
  const [family, setFamily] = useState("gwm");
  const [identity, setIdentity] = useState("");
  const [matches, setMatches] = useState<DemoUnit[]>([]);
  const [unit, setUnit] = useState<DemoUnit | null>(null);
  const [proof, setProof] = useState("");
  const [status, setStatus] = useState<RegistrationStatus | null>(null);
  const [transport, setTransport] = useState<Transport>("simulated");
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [events, setEvents] = useState<string[]>([]);
  const adapter = useRef<ChargerAdapter | null>(null);
  const selected = families.find((f) => f.id === family)!;
  const stage = status ? 3 : unit ? 2 : 1;
  function reset() {
    setMatches([]);
    setUnit(null);
    setProof("");
    setStatus(null);
    setSnapshot(null);
    setEvents([]);
    adapter.current = null;
    setMessage("");
  }
  function search() {
    reset();
    const found = findDemoUnits(identity);
    setMatches(found);
    if (found.length === 1) setUnit(found[0]);
    else
      setMessage(
        found.length
          ? "Este final pertence a dois exemplos. Confirme o serial completo abaixo."
          : "Exemplo não encontrado. Use 12345, 67890 ou o QR de demonstração indicado.",
      );
  }
  function claim() {
    if (!unit || !checkDemoProof(unit, proof)) {
      setMessage("Código de demonstração incorreto. Use DEMO-OK.");
      return;
    }
    setStatus("registered");
    setMessage(
      "Cadastro fictício criado apenas nesta aba. Prova de posse simulada, sem validação de aparelho real.",
    );
  }
  async function act(
    action: "connect" | "start" | "read" | "stop" | "disconnect",
  ) {
    if (busy) return;
    setBusy(true);
    try {
      if (action === "connect" && !adapter.current)
        adapter.current = createAdapter(transport);
      if (!adapter.current) throw new Error("Conecte o simulador primeiro.");
      const next = await adapter.current[action]();
      setSnapshot(next);
      setStatus("simulated");
      const labels = {
        connect: "Conexão simulada confirmada",
        start: "Início simulado confirmado",
        read: "Leitura fictícia: 420 Wh se em recarga",
        stop: "Parada simulada confirmada",
        disconnect:
          "Conexão perdida: estado e energia desconhecidos; não confirma parada",
      };
      setEvents((old) => [labels[action], ...old].slice(0, 5));
      setMessage("");
    } catch (err) {
      setMessage(
        err instanceof Error ? err.message : "Não foi possível simular.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="charger-lab">
      <header className="cl-header">
        <Link href="/" className="cl-brand">
          telektro<span>LAB</span>
        </Link>
        <span className="cl-tag">Protótipo isolado</span>
      </header>
      <section className="cl-intro">
        <p className="cl-eyebrow">MAIS MODELOS. UM SÓ LUGAR.</p>
        <h1>
          Seu carregador,
          <br />
          <span>do seu jeito.</span>
        </h1>
        <p>
          Uma base simples para cadastrar e testar integrações. Por enquanto,
          tudo aqui é demonstração.
        </p>
      </section>
      <div className="cl-notice">
        <strong>Sem cobrança. Sem aparelho conectado.</strong>
        <span>
          Nenhum comando sai desta página. Os dados somem ao recarregar ou
          fechar a aba.
        </span>
      </div>
      <div className="cl-layout">
        <section className="cl-panel">
          <nav className="cl-steps" aria-label="Etapas do cadastro">
            {["Identificar", "Prova de posse", "Testar"].map((s, i) => (
              <span
                key={s}
                aria-current={stage === i + 1 ? "step" : undefined}
                className={stage === i + 1 ? "active" : ""}
              >
                {i + 1}
                <small>{s}</small>
              </span>
            ))}
          </nav>
          {!status && (
            <>
              <h2>{unit ? "Confirme a posse" : "Adicionar carregador"}</h2>
              {!unit ? (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    search();
                  }}
                >
                  <label htmlFor="cl-family">
                    Marca / família de referência
                  </label>
                  <select
                    id="cl-family"
                    value={family}
                    onChange={(e) => {
                      setFamily(e.target.value);
                      reset();
                    }}
                  >
                    {families.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.brand} · {f.model}
                      </option>
                    ))}
                  </select>
                  <p className="cl-help">
                    {selected.note} Esta escolha não conecta um aparelho da
                    marca.
                  </p>
                  <label htmlFor="cl-identity">
                    Final do serial ou conteúdo do QR demonstrativo
                  </label>
                  <input
                    id="cl-identity"
                    value={identity}
                    onChange={(e) => setIdentity(e.target.value)}
                    placeholder="Ex.: 67890"
                    maxLength={100}
                    autoComplete="off"
                    required
                  />
                  <p className="cl-help">
                    Teste com{" "}
                    <button
                      type="button"
                      className="cl-inline"
                      onClick={() => {
                        setIdentity("12345");
                        reset();
                      }}
                    >
                      12345
                    </button>{" "}
                    (dois exemplos) ou{" "}
                    <button
                      type="button"
                      className="cl-inline"
                      onClick={() => {
                        setIdentity("67890");
                        reset();
                      }}
                    >
                      67890
                    </button>
                    . Não digite serial, senha ou chave de um aparelho real.
                  </p>
                  <details>
                    <summary>Usar um QR de demonstração</summary>
                    <p>
                      Este protótipo recebe o texto do QR, sem abrir a câmera.
                      Copie no campo acima:
                    </p>
                    <code>TELEKTRO-DEMO:TK-DEMO-C-67890</code>
                    <p>Não cole links ou QR de equipamentos reais.</p>
                  </details>
                  <button className="cl-primary" type="submit">
                    Buscar exemplo <span>→</span>
                  </button>
                </form>
              ) : (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    claim();
                  }}
                >
                  <p className="cl-unit">
                    {selected.brand} · referência
                    <br />
                    <strong>{unit.serial}</strong>
                    <span>
                      Unidade fictícia Telektro, não é produto da marca.
                    </span>
                  </p>
                  <label htmlFor="cl-proof">
                    Código de posse de demonstração
                  </label>
                  <input
                    id="cl-proof"
                    value={proof}
                    onChange={(e) => setProof(e.target.value)}
                    placeholder="DEMO-OK"
                    autoComplete="off"
                    required
                  />
                  <p className="cl-help">
                    Use <strong>DEMO-OK</strong>. Este código só exercita o
                    fluxo. Na integração real, o final do serial não será senha
                    nem prova de dono.
                  </p>
                  <button className="cl-primary" type="submit">
                    Confirmar cadastro fictício <span>→</span>
                  </button>
                  <button
                    type="button"
                    className="cl-secondary"
                    onClick={reset}
                  >
                    Voltar
                  </button>
                </form>
              )}
              {!unit && matches.length > 1 && (
                <fieldset className="cl-matches">
                  <legend>Escolha o serial completo fictício</legend>
                  {matches.map((m) => (
                    <button
                      type="button"
                      key={m.id}
                      onClick={() => {
                        setUnit(m);
                        setMessage("");
                      }}
                    >
                      {m.serial} →
                    </button>
                  ))}
                </fieldset>
              )}
            </>
          )}
          {status && (
            <>
              <div className="cl-status">{statusLabels[status]}</div>
              <h2>{unit?.serial}</h2>
              <p className="cl-help">
                Cadastro local de demonstração · básico gratuito · sem
                pagamentos
              </p>
              <label htmlFor="cl-transport">Adaptador</label>
              <select
                id="cl-transport"
                value={transport}
                disabled={snapshot !== null}
                onChange={(e) => {
                  setTransport(e.target.value as Transport);
                  setMessage("");
                }}
              >
                {adapterCatalog.map((a) => (
                  <option key={a.transport} value={a.transport}>
                    {a.label}
                    {a.implemented ? "" : " · não implementado no laboratório"}
                  </option>
                ))}
              </select>
              {transport !== "simulated" ? (
                <div className="cl-notice">
                  <strong>Interface reservada, sem driver real.</strong>
                  <span>
                    O cadastro não comprova compatibilidade. Nenhuma conexão
                    será tentada.
                  </span>
                </div>
              ) : (
                <>
                  <div className="cl-metrics">
                    <div>
                      <span>Estado simulado</span>
                      <strong>
                        {!snapshot
                          ? "Não conectado"
                          : snapshot.state === "unknown"
                            ? "Desconhecido"
                            : snapshot.state === "charging"
                              ? "Em recarga"
                              : "Disponível"}
                      </strong>
                    </div>
                    <div>
                      <span>Energia fictícia</span>
                      <strong>
                        {snapshot?.energyWh == null
                          ? "—"
                          : `${(snapshot.energyWh / 1000).toLocaleString("pt-BR")} kWh`}
                      </strong>
                    </div>
                  </div>
                  <p className="cl-help">
                    A leitura de teste usa 420 Wh fixos durante a sessão. Não é
                    medidor e nunca é usada para cobrar.
                  </p>
                  <div className="cl-actions">
                    <button
                      className="cl-primary"
                      type="button"
                      disabled={busy || !!snapshot?.connected}
                      onClick={() => act("connect")}
                    >
                      {snapshot && !snapshot.connected
                        ? "Reconectar simulador"
                        : "Conectar simulador"}
                    </button>
                    <button
                      className="cl-secondary"
                      type="button"
                      disabled={
                        busy ||
                        !snapshot?.connected ||
                        snapshot.state === "charging"
                      }
                      onClick={() => act("start")}
                    >
                      Simular início
                    </button>
                    <button
                      className="cl-secondary"
                      type="button"
                      disabled={busy || !snapshot?.connected}
                      onClick={() => act("read")}
                    >
                      Ler exemplo
                    </button>
                    <button
                      className="cl-secondary"
                      type="button"
                      disabled={
                        busy ||
                        !snapshot?.connected ||
                        snapshot.state !== "charging"
                      }
                      onClick={() => act("stop")}
                    >
                      Simular parada
                    </button>
                    <button
                      className="cl-secondary"
                      type="button"
                      disabled={busy || !snapshot?.connected}
                      onClick={() => act("disconnect")}
                    >
                      Simular perda de conexão
                    </button>
                  </div>
                  {snapshot && !snapshot.connected && (
                    <p className="cl-warning">
                      Sem conexão não há confirmação de parada. Reconecte para
                      recuperar o estado simulado.
                    </p>
                  )}
                  {events.length > 0 && (
                    <div className="cl-log">
                      <h3>Registro de simulação</h3>
                      <ul>
                        {events.map((e, i) => (
                          <li key={`${i}-${e}`}>{e}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </>
              )}
              <button
                type="button"
                disabled={busy}
                className="cl-inline cl-reset"
                onClick={() => {
                  reset();
                  setTransport("simulated");
                  setIdentity("");
                }}
              >
                Apagar exemplo e recomeçar
              </button>
            </>
          )}
          <p role="status" aria-live="polite" className="cl-message">
            {message}
          </p>
        </section>
        <aside className="cl-sidebar">
          <section className="cl-panel">
            <p className="cl-eyebrow">BASE REAPROVEITÁVEL</p>
            <h2>Conexões, sem confusão.</h2>
            {adapterCatalog.map((a) => (
              <div className="cl-adapter" key={a.transport}>
                <strong>{a.label}</strong>
                <span>{a.note}</span>
              </div>
            ))}
          </section>
          <section className="cl-panel">
            <h3>O que este teste não faz</h3>
            <ul>
              <li>Não cadastra um ponto no banco.</li>
              <li>Não valida posse real, marca ou firmware.</li>
              <li>Não acessa Wi-Fi ou Bluetooth.</li>
              <li>Não envia comandos a carregadores.</li>
            </ul>
            <p className="cl-help">
              &quot;Validado neste modelo&quot; é uma etapa futura de
              homologação técnica. Não é liberada por preencher este formulário.
            </p>
          </section>
        </aside>
      </div>
      <footer className="cl-footer">
        Telektro · laboratório gratuito de integração · sem cobrança neste
        protótipo
      </footer>
    </main>
  );
}
