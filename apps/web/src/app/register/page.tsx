"use client";

import Link from "next/link";
import { useActionState } from "react";
import { ArrowRight } from "lucide-react";
import { signUp, type LoginState } from "@/app/login/actions";
import { AuthShell } from "@/components/auth-shell";
import { GoogleSignInButton } from "@/components/google-sign-in-button";

const initialState: LoginState = {};

export default function RegisterPage() {
  const [state, action, pending] = useActionState(signUp, initialState);
  return <AuthShell>
    <h1>Criar conta</h1>
    <form action={action} className="auth-form">
      <label htmlFor="email" className="sr-only">E-mail</label>
      <input id="email" name="email" type="email" autoComplete="email" placeholder="E-mail" required/>
      <label htmlFor="password" className="sr-only">Senha</label>
      <input id="password" name="password" type="password" autoComplete="new-password" minLength={8} placeholder="Senha (mínimo 8 caracteres)" required/>
      {state.error && <p className="auth-error" role="alert">{state.error}</p>}
      {state.message && <p className="auth-success" role="status">{state.message}</p>}
      <button className="auth-submit" disabled={pending}>{pending ? "Criando conta…" : "Criar conta"}<ArrowRight size={16}/></button>
    </form>
    <div className="auth-or"><span/>ou<span/></div>
    <GoogleSignInButton/>
    <p className="auth-link">Já tem conta? <Link href="/login">Entrar</Link></p>
  </AuthShell>;
}
