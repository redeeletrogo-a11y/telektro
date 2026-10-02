"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";

function subscribeMotion(cb: () => void) {
  const q = window.matchMedia("(prefers-reduced-motion: reduce)");
  q.addEventListener("change", cb);
  return () => q.removeEventListener("change", cb);
}

const slides = [
  { id: "casa", src: "/showcase/casa.webp", label: "Residencial", title: "Carregue em casa, sem complicação", text: "Controle pelo app, acompanhe o consumo e tenha mais economia no dia a dia.", alt: "Carro elétrico carregando na garagem de uma casa em um carregador de parede Telektro", pos: "100% 50%" },
  { id: "condominio", src: "/showcase/condominio.webp", label: "Condomínio", title: "Carregamento no condomínio, organizado e seguro", text: "Gestão centralizada dos carregadores, controle de usuários e cobrança automática.", alt: "Carregadores Telektro instalados em vagas de garagem de um condomínio", pos: "92% 50%" },
  { id: "eletroposto", src: "/showcase/eletroposto.webp", label: "Eletroposto", title: "Abasteça o futuro com energia limpa", text: "Gestão, monitoramento em tempo real e cobrança integrada para eletropostos.", alt: "Estação de recarga pública Telektro com carregador rápido e sinalização", pos: "90% 50%" },
];

export function HeroCarousel() {
  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(false);
  const reduced = useSyncExternalStore(subscribeMotion, () => window.matchMedia("(prefers-reduced-motion: reduce)").matches, () => false);
  const startX = useRef<number | null>(null);

  const go = useCallback((n: number) => setI((n + slides.length) % slides.length), []);

  useEffect(() => {
    if (paused || reduced) return;
    const t = window.setTimeout(() => go(i + 1), 5500);
    return () => window.clearTimeout(t);
  }, [i, paused, reduced, go]);

  const s = slides[i];
  return (
    <div className="lp-show" role="region" aria-roledescription="carrossel" aria-label="Soluções Telektro"
      onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)} onFocus={() => setPaused(true)} onBlur={() => setPaused(false)}>
      <div className="lp-show-stage"
        onPointerDown={(e) => { startX.current = e.clientX; setPaused(true); }}
        onPointerUp={(e) => { if (startX.current !== null) { const d = e.clientX - startX.current; if (Math.abs(d) > 40) go(i + (d < 0 ? 1 : -1)); } startX.current = null; setPaused(false); }}
        onPointerCancel={() => { startX.current = null; setPaused(false); }}>
        {slides.map((sl, n) => (
          <Image key={sl.id} src={sl.src} alt={sl.alt} width={1280} height={720} priority={n === 0} sizes="(min-width: 1160px) 1120px, 100vw"
            className={`lp-show-img${n === i ? " on" : ""}`} style={{ objectPosition: sl.pos }} aria-hidden={n !== i} draggable={false}/>
        ))}
      </div>
      <div className="lp-show-bar">
        <div className="lp-show-copy" aria-live="polite">
          <strong>{s.title}</strong>
          <span>{s.text}</span>
        </div>
        <div className="lp-show-ctl">
          <div className="lp-show-tabs" role="tablist" aria-label="Escolher cenário">
            {slides.map((sl, n) => (
              <button key={sl.id} role="tab" aria-selected={n === i} className={n === i ? "on" : ""} onClick={() => go(n)}>{sl.label}</button>
            ))}
          </div>
          <a href={`#${s.id}`} className="lp-btn primary">Ver plano {s.label}</a>
        </div>
      </div>
    </div>
  );
}
