import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function requireEletropostoOwner(organizationId: string) {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(organizationId)) return null;
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const [{ data: membership }, { data: organization }] = await Promise.all([
    supabase.from("memberships").select("role").eq("organization_id", organizationId).eq("user_id", user.id).maybeSingle(),
    supabase.from("organizations").select("account_type").eq("id", organizationId).maybeSingle(),
  ]);
  if (membership?.role !== "owner" || organization?.account_type !== "eletroposto") return null;
  return { userId: user.id };
}
