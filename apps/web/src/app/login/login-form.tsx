"use client";

import { useActionState } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { AuthShell } from "@/components/auth-shell";
import { GoogleSignInButton } from "@/components/google-sign-in-button";
import { resendConfirmation, signIn, type LoginState } from "./actions";

const initialState: LoginState = {};

export function LoginForm({ authError }: { authError?: string }) {
  const [state, action, pending] = useActionState(signIn, initialState);
  const [resendState, resendAction, resendPending] = useActionState(resendConfirmation, initialState);
  return <AuthShell>
    <h1>Entrar</h1>
    {authError && <p className="auth-error" role="alert">{authError}</p>}
    <form action={action} className="auth-form">
      <label htmlFor="email" className="sr-only">E-mail</label>
      <input id="email" name="email" type="email" autoComplete="email" placeholder="E-mail" required/>
      <label htmlFor="password" className="sr-only">Senha</label>
      <input id="password" name="password" type="password" autoComplete="current-password" placeholder="Senha" required/>
      {state.error && <p className="auth-error" role="alert">{state.error}</p>}
      <button className="auth-submit" disabled={pending}>{pending ? "Entrando…" : "Entrar"}<ArrowRight size={16}/></button>
    </form>
    <div className="auth-or"><span/>ou<span/></div>
    <GoogleSignInButton/>
    <p className="auth-link">Não tem conta? <Link href="/register">Criar conta</Link></p>
    <details className="auth-resend">
      <summary>Não recebeu o e-mail de confirmação?</summary>
      <form action={resendAction} className="auth-form">
        <label htmlFor="confirmation-email" className="sr-only">E-mail</label>
        <input id="confirmation-email" name="email" type="email" autoComplete="email" placeholder="E-mail" required/>
        <button className="auth-ghost" disabled={resendPending}>{resendPending ? "Enviando…" : "Reenviar link"}</button>
        {resendState.error && <p className="auth-error" role="alert">{resendState.error}</p>}
        {resendState.message && <p className="auth-success" role="status">{resendState.message}</p>}
      </form>
    </details>
  </AuthShell>;
}
