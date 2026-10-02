"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function acceptInvite(code: string) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/convite/${code}/entrar`);
  const { data: organizationId, error } = await supabase.rpc("accept_resident_invite", { p_code: code });
  if (error) {
    const reason = error.message.includes("RESIDENT_LIMIT_REACHED") ? "RESIDENT_LIMIT_REACHED" : "INVITE_INVALID";
    redirect(`/convite/${code}?erro=${reason}`);
  }
  (await cookies()).delete("telektro_invite");
  redirect(typeof organizationId === "string" ? `/?org=${organizationId}` : "/");
}
