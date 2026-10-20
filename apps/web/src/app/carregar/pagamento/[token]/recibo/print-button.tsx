"use client";
export function PrintButton() {
  return <button className="ep-primary ep-noprint" type="button" onClick={() => window.print()}>Imprimir ou salvar PDF</button>;
}
