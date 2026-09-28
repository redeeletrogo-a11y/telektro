"use client";

import { signInWithGoogle } from "@/app/login/actions";

export function GoogleSignInButton() {
  return <form action={signInWithGoogle}>
    <button className="google-button" type="submit"><span className="google-mark" aria-hidden="true">G</span>Continuar com Google</button>
  </form>;
}
