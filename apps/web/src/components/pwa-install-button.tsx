"use client";

import { useEffect, useState } from "react";
import { Download, X } from "lucide-react";

type InstallChoice = { outcome: "accepted" | "dismissed"; platform: string };
type InstallPrompt = Event & { prompt: () => Promise<void>; userChoice: Promise<InstallChoice> };

export function PwaInstallButton() {
  const [installPrompt, setInstallPrompt] = useState<InstallPrompt | null>(null);
  const [showIosHelp, setShowIosHelp] = useState(false);
  const [isIos, setIsIos] = useState(false);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    const detect = window.setTimeout(() => {
      const isAppleMobile = /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
      const isStandalone = window.matchMedia("(display-mode: standalone)").matches || ("standalone" in navigator && Boolean((navigator as Navigator & { standalone?: boolean }).standalone));
      setIsIos(isAppleMobile && !isStandalone);
      setInstalled(isStandalone);
    }, 0);
    const onInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as InstallPrompt);
    };
    const onInstalled = () => { setInstalled(true); setInstallPrompt(null); };
    window.addEventListener("beforeinstallprompt", onInstallPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.clearTimeout(detect);
      window.removeEventListener("beforeinstallprompt", onInstallPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  async function install() {
    if (installPrompt) {
      await installPrompt.prompt();
      const choice = await installPrompt.userChoice;
      if (choice.outcome === "accepted") setInstalled(true);
      setInstallPrompt(null);
      return;
    }
    if (isIos) setShowIosHelp(true);
  }

  if (installed || (!installPrompt && !isIos)) return null;

  return <>
    <button className="pwa-install-button" type="button" onClick={() => void install()}>
      <Download size={15}/><span>Instalar Telektro</span>
    </button>
    {showIosHelp && <div className="pwa-help-backdrop" role="presentation" onClick={() => setShowIosHelp(false)}>
      <section className="pwa-help-dialog" role="dialog" aria-modal="true" aria-labelledby="pwa-help-title" onClick={(event) => event.stopPropagation()}>
        <button className="pwa-help-close" type="button" onClick={() => setShowIosHelp(false)} aria-label="Fechar instruções"><X size={17}/></button>
        <p className="eyebrow">TELEKTRO NO CELULAR</p>
        <h2 id="pwa-help-title">Adicionar à Tela de Início</h2>
        <ol><li>Abra este endereço no <strong>Safari</strong>.</li><li>Toque em <strong>Compartilhar</strong> <span aria-label="ícone de compartilhar">□↑</span>.</li><li>Escolha <strong>Adicionar à Tela de Início</strong> e confirme.</li></ol>
        <p>O ícone do Telektro ficará junto dos outros aplicativos.</p>
      </section>
    </div>}
  </>;
}
