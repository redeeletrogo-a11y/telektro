import type { ReactNode } from "react";
import { COMPANY_NOTE } from "@/lib/site";

export function AuthShell({ children }: { children: ReactNode }) {
  return <main className="auth-page"><div className="auth-art" aria-hidden="true"/><section className="auth-panel">{children}</section><p className="company-note">{COMPANY_NOTE}</p></main>;
}
