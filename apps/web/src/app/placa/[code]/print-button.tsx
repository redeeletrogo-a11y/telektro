"use client";

export function PrintButton() {
  return <button type="button" className="placa-btn" onClick={() => window.print()}>Imprimir ou salvar em PDF</button>;
}
