"use client";

import { useActionState } from "react";
import { Zap, ArrowRight, ShieldCheck } from "lucide-react";
import { signIn, type LoginState } from "./actions";

const initialState: LoginState = {};

export default function LoginPage() {
  const [state, action, pending] = useActionState(signIn, initialState);
  return <main className="login-page"><section className="login-card"><div className="login-brand"><span className="brand-mark"><Zap size={20}/></span><span>TELEKTRO</span></div><p className="eyebrow">PLATAFORMA DE OPERAÇÃO</p><h1>Bem-vindo de volta</h1><p className="login-description">Entre para acompanhar sua infraestrutura de recarga.</p><form action={action} className="login-form"><label htmlFor="email">E-mail</label><input id="email" name="email" type="email" autoComplete="email" placeholder="voce@empresa.com" required/><label htmlFor="password">Senha</label><input id="password" name="password" type="password" autoComplete="current-password" placeholder="Sua senha" required/>{state.error && <p className="login-error" role="alert">{state.error}</p>}<button className="primary-button login-submit" disabled={pending}>{pending ? "Entrando…" : "Entrar"}<ArrowRight size={15}/></button></form><div className="login-security"><ShieldCheck size={14}/>Acesso protegido pela autenticação do Supabase</div></section><p className="login-foot">Telektro · Infraestrutura de recarga, sob controle.</p></main>;
}
