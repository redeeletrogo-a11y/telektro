"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function acceptClaim(token: string) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/c/${token}/entrar`);
  const { data: organizationId, error } = await supabase.rpc("accept_charger_claim", { p_token: token });
  if (error) {
    const reason = error.message.includes("NO_ORGANIZATION") ? "NO_ORGANIZATION" : "CLAIM_INVALID";
    redirect(`/c/${token}?erro=${reason}`);
  }
  (await cookies()).delete("telektro_claim");
  redirect(typeof organizationId === "string" ? `/?org=${organizationId}` : "/");
}
