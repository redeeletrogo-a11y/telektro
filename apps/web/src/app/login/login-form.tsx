"use client";

import { useActionState } from "react";
import Link from "next/link";
import { Zap, ArrowRight, ShieldCheck } from "lucide-react";
import { GoogleSignInButton } from "@/components/google-sign-in-button";
import { resendConfirmation, signIn, type LoginState } from "./actions";

const initialState: LoginState = {};

export function LoginForm({ authError }: { authError?: string }) {
  const [state, action, pending] = useActionState(signIn, initialState);
  const [resendState, resendAction, resendPending] = useActionState(resendConfirmation, initialState);
  return <main className="login-page"><section className="login-card"><div className="login-brand"><span className="brand-mark"><Zap size={20}/></span><span>TELEKTRO</span></div><p className="eyebrow">PLATAFORMA DE OPERAÇÃO</p><h1>Bem-vindo de volta</h1><p className="login-description">Entre para acompanhar sua infraestrutura de recarga.</p>{authError && <p className="login-error" role="alert">{authError}</p>}<form action={action} className="login-form"><label htmlFor="email">E-mail</label><input id="email" name="email" type="email" autoComplete="email" placeholder="voce@empresa.com" required/><label htmlFor="password">Senha</label><input id="password" name="password" type="password" autoComplete="current-password" placeholder="Sua senha" required/>{state.error && <p className="login-error" role="alert">{state.error}</p>}<button className="primary-button login-submit" disabled={pending}>{pending ? "Entrando…" : "Entrar"}<ArrowRight size={15}/></button></form><form action={resendAction} className="resend-form"><label htmlFor="confirmation-email">Ainda não confirmou sua conta?</label><div className="resend-row"><input id="confirmation-email" name="email" type="email" autoComplete="email" placeholder="voce@empresa.com" required/><button className="secondary-button" disabled={resendPending}>{resendPending ? "Enviando…" : "Reenviar link"}</button></div>{resendState.error && <p className="login-error" role="alert">{resendState.error}</p>}{resendState.message && <p className="form-success" role="status">{resendState.message}</p>}</form><div className="auth-divider"><span/>ou<span/></div><GoogleSignInButton/><p className="auth-switch">Ainda não tem acesso? <Link href="/register">Criar conta</Link></p><div className="login-security"><ShieldCheck size={14}/>Acesso protegido pela autenticação do Supabase</div></section><p className="login-foot">Telektro · Infraestrutura de recarga, sob controle.</p></main>;
}
