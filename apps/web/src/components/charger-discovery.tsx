"use client";
import { useState } from "react";
import { compareSuffix, discoveryError } from "@/lib/charger-lab/discovery";

type DiscoveryBluetooth = {
  requestDevice(options: {
    acceptAllDevices: true;
  }): Promise<{ name?: string | null }>;
};
type Seen = {
  name: string;
  source: "real" | "demo";
  comparison: "match" | "different" | "unknown";
};
export function ChargerDiscovery() {
  const [suffix, setSuffix] = useState("");
  const [seen, setSeen] = useState<Seen[]>([]);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [demo, setDemo] = useState(false);
  const [allowedDemo, setAllowedDemo] = useState(false);
  function record(name: string | null | undefined, source: Seen["source"]) {
    setSeen((old) =>
      [
        {
          name: name || "Aparelho sem nome anunciado",
          source,
          comparison: compareSuffix(name, suffix),
        },
        ...old,
      ].slice(0, 5),
    );
  }
  async function discover() {
    if (busy) return;
    if (!/^\d{5}$/.test(suffix)) {
      setMessage(
        "Informe os 5 últimos dígitos numéricos para a conferência do nome. Não use senhas ou códigos de posse.",
      );
      return;
    }
    const bluetooth = (
      navigator as Navigator & { bluetooth?: DiscoveryBluetooth }
    ).bluetooth;
    if (!window.isSecureContext || !bluetooth) {
      setMessage(
        "Busca real não suportada neste navegador ou contexto. Safari/iPhone não oferece Web Bluetooth nativo. Use um navegador compatível ou escolha a demonstração fictícia abaixo.",
      );
      return;
    }
    setBusy(true);
    setMessage(
      "Escolha apenas um aparelho próprio ou autorizado no seletor do navegador.",
    );
    try {
      // User gesture opens the native chooser. NO services requested, GATT connect, reads or writes.
      const device = await bluetooth.requestDevice({ acceptAllDevices: true });
      record(device.name, "real");
      setMessage(
        "Seleção real recebida. Nenhuma conexão GATT, configuração ou comando enviado. O nome não prova que seja carregador, nem confirma posse.",
      );
    } catch (error) {
      setMessage(discoveryError(error instanceof Error ? error.name : ""));
    } finally {
      setBusy(false);
    }
  }
  return (
    <section
      className="cl-panel cl-discovery"
      aria-labelledby="discovery-title"
    >
      <p className="cl-eyebrow">ANTES DO CADASTRO · TESTE OPCIONAL</p>
      <h2 id="discovery-title">Procurar por Bluetooth</h2>
      <p className="cl-help">
        Ligue o Bluetooth do celular e mantenha o aparelho autorizado próximo e
        em modo de descoberta. Toque para abrir a permissão e o seletor do
        navegador. Não use o carregador da farmácia.
      </p>
      <div className="cl-notice">
        <strong>Descoberta real, sem conectar ou configurar.</strong>
        <span>
          O navegador devolve só o aparelho que você escolher, não uma lista de
          todos os próximos. Não há driver, controle de carga ou cadastro real
          nesta etapa.
        </span>
      </div>
      <label htmlFor="cl-ble-suffix">
        5 últimos dígitos do serial para comparação
      </label>
      <input
        id="cl-ble-suffix"
        inputMode="numeric"
        pattern="[0-9]{5}"
        maxLength={5}
        value={suffix}
        onChange={(e) => {
          setSuffix(e.target.value.replace(/\D/g, ""));
          setSeen([]);
          setMessage("");
        }}
        placeholder="Ex.: 67890"
        autoComplete="off"
        disabled={busy}
      />
      <p className="cl-help">
        A comparação usa apenas o final numérico do nome anunciado. Muitos
        aparelhos não anunciam o serial. Nome coincidente não é validação de
        identidade ou de compatibilidade.
      </p>
      <button
        className="cl-primary"
        type="button"
        disabled={busy}
        onClick={() => void discover()}
      >
        {busy ? "Aguardando seleção…" : "Procurar aparelho real"}
      </button>
      <p className="cl-help">
        Chrome Android compatível: seletor real. Safari/iPhone e outros
        ambientes sem suporte: use só a demonstração. Não altera configurações
        do Bluetooth do sistema.
      </p>
      <button
        className="cl-inline"
        type="button"
        disabled={busy}
        onClick={() => {
          setDemo((v) => !v);
          setAllowedDemo(false);
        }}
      >
        {" "}
        {demo ? "Fechar demonstração" : "Usar busca simulada (sem Bluetooth)"}
      </button>
      {demo && (
        <div className="cl-demo-discovery">
          <h3>Busca simulada · aparelhos fictícios</h3>
          <p className="cl-help">
            Imagine o Bluetooth ligado. Aqui a permissão é fictícia, sem diálogo
            do sistema. Use 67890 para testar a coincidência.
          </p>
          <label className="cl-demo-consent">
            <input
              type="checkbox"
              checked={allowedDemo}
              onChange={(e) => setAllowedDemo(e.target.checked)}
            />{" "}
            Simular permissão para procurar
          </label>
          <button
            type="button"
            className="cl-secondary"
            disabled={!allowedDemo || !/^\d{5}$/.test(suffix)}
            onClick={() => {
              setSeen([
                {
                  name: "TELEKTRO-DEMO-67890",
                  source: "demo",
                  comparison: compareSuffix("TELEKTRO-DEMO-67890", suffix),
                },
                {
                  name: "EXEMPLO-12345",
                  source: "demo",
                  comparison: compareSuffix("EXEMPLO-12345", suffix),
                },
              ]);
              setMessage(
                "Busca fictícia concluída. Nenhuma permissão ou descoberta real solicitada.",
              );
            }}
          >
            Listar exemplos fictícios
          </button>
        </div>
      )}
      {seen.length > 0 && (
        <div className="cl-discovery-results">
          <h3>Escolhas desta aba · não são conexões</h3>
          <ul>
            {seen.map((item, i) => (
              <li key={i}>
                <strong>{item.name}</strong>
                <span>
                  {item.source === "real"
                    ? "Seleção real do navegador"
                    : "Aparelho fictício"}{" "}
                  ·{" "}
                  {item.comparison === "match"
                    ? "Final do nome coincide; identidade não validada"
                    : item.comparison === "different"
                      ? "Final do nome diferente do serial informado"
                      : "Serial não verificável pelo nome"}
                </span>
              </li>
            ))}
          </ul>
          <button
            className="cl-inline"
            type="button"
            onClick={() => setSeen([])}
          >
            Apagar lista local
          </button>
        </div>
      )}
      <p className="cl-message" role="status" aria-live="polite">
        {message}
      </p>
      <p className="cl-help">
        Nada é salvo em banco. Recarregar apaga a lista. Apagar aqui não revoga
        a permissão do navegador; isso fica nas configurações do site. Esta
        página não acessa serviços GATT.
      </p>
    </section>
  );
}
