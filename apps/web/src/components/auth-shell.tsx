import type { ReactNode } from "react";

export function AuthShell({ children }: { children: ReactNode }) {
  return <main className="auth-page"><div className="auth-art" aria-hidden="true"/><section className="auth-panel">{children}</section></main>;
}
