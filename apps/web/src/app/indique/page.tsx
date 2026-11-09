import type { Metadata } from "next";
import { cookies } from "next/headers";
import { SITE_URL } from "@/lib/site";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { MyReferral } from "@/lib/referral";
import { ReferralLanding, type ReferralBanner, type ReferralPanelData } from "@/components/referral-landing";

export const metadata: Metadata = {
  title: "Indique e ganhe R$ 250",
  description: "Indique a Telektro para um comércio ou condomínio. Quando o seu indicado pagar e o ponto estiver funcionando, você recebe R$ 250 no Pix. Sem limite de indicações.",
  alternates: { canonical: "/indique" },
  openGraph: { title: "Indique e ganhe R$ 250 | Telektro", description: "Compartilhe seu link: quando o seu indicado pagar e o ponto estiver funcionando, você recebe R$ 250 no Pix.", url: "/indique" },
};

type PreviewRow = { valid: boolean; referrer_first_name: string | null };

export default async function IndiquePage({ searchParams }: { searchParams: Promise<{ ref?: string }> }) {
  let banner: ReferralBanner | null = null;
  let panel: ReferralPanelData | null = null;

  try {
    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();

    const { ref: refParam } = await searchParams;
    const cookieStore = await cookies();
    const ref = (refParam ?? cookieStore.get("tk_ref")?.value ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6);

    let referrerName: string | null = null;
    let refValid = false;
    if (/^[A-Z0-9]{6}$/.test(ref)) {
      const { data: preview } = await supabase.rpc("get_referral_preview", { p_code: ref });
      const info = (Array.isArray(preview) ? preview[0] : preview) as PreviewRow | undefined;
      refValid = Boolean(info?.valid);
      referrerName = info?.referrer_first_name ?? null;
    }

    if (user) {
      // Vínculo automático e idempotente: quem entra logado com um código válido fica ligado a quem indicou.
      if (refValid) {
        const { data: result } = await supabase.rpc("bind_referral", { p_code: ref });
        if (result === "OK") banner = { kind: "bound", name: referrerName };
      }

      const [codeResult, referralsResult, adminResult] = await Promise.all([
        supabase.rpc("get_my_referral_code"),
        supabase.rpc("my_referrals"),
        supabase.rpc("is_referral_admin"),
      ]);
      const code = typeof codeResult.data === "string" ? codeResult.data : null;
      const referrals = (Array.isArray(referralsResult.data) ? referralsResult.data : []) as MyReferral[];
      if (code) {
        panel = {
          code,
          link: `${SITE_URL}/i/${code}`,
          referrals,
          isAdmin: Boolean(adminResult.data),
          email: user.email ?? "",
        };
      }
    } else if (refValid) {
      banner = { kind: "preview", name: referrerName };
    }
  } catch {
    // Supabase não configurado neste ambiente: mostra a página pública normalmente.
  }

  return <ReferralLanding banner={banner} panel={panel}/>;
}
