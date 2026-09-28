"use client";

import Link from "next/link";
import { useActionState } from "react";
import { ArrowRight, ShieldCheck, Zap } from "lucide-react";
import { signUp, type LoginState } from "@/app/login/actions";

const initialState: LoginState = {};

export default function RegisterPage() {
  const [state, action, pending] = useActionState(signUp, initialState);
  return <main className="login-page"><section className="login-card">
    <div className="login-brand"><span className="brand-mark"><Zap size={20}/></span><span>TELEKTRO</span></div>
    <p className="eyebrow">NOVO ACESSO</p><h1>Crie sua conta</h1>
    <p className="login-description">Use seu e-mail para acessar e configurar seu workspace Telektro.</p>
    <form action={action} className="login-form">
      <label htmlFor="email">E-mail</label><input id="email" name="email" type="email" autoComplete="email" placeholder="voce@empresa.com" required/>
      <label htmlFor="password">Senha</label><input id="password" name="password" type="password" autoComplete="new-password" minLength={8} placeholder="Pelo menos 8 caracteres" required/>
      {state.error && <p className="login-error" role="alert">{state.error}</p>}
      {state.message && <p className="form-success" role="status">{state.message}</p>}
      <button className="primary-button login-submit" disabled={pending}>{pending ? "Criando conta…" : "Criar conta"}<ArrowRight size={15}/></button>
    </form>
    <p className="auth-switch">Já tem acesso? <Link href="/login">Entrar</Link></p>
    <div className="login-security"><ShieldCheck size={14}/>Confirmação de e-mail protegida pelo Supabase</div>
  </section><p className="login-foot">Telektro · Infraestrutura de recarga, sob controle.</p></main>;
}
