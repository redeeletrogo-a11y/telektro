import { notFound } from "next/navigation";
import { Building2 } from "lucide-react";
import { OrganizationCreate } from "@/components/organization-create";
import "@/components/dashboard-theme.css";

export const dynamic = "force-dynamic";

export default function OrganizacaoPreview() {
  // Fictional, read-only demo for reviewing the extra-organization flow on Vercel previews.
  if (process.env.VERCEL_ENV !== "preview") notFound();

  return <main className="app-shell">
    <div className="main-area" style={{ marginLeft: 0, minHeight: "100vh" }}>
      <header className="topbar">
        <div className="breadcrumb"><span>Workspace</span><span>/</span><strong>Visão geral</strong></div>
        <div className="topbar-actions">
          <form className="organization-switcher" action="/preview/organizacao" method="get">
            <Building2 size={14}/>
            <label className="sr-only" htmlFor="preview-organization">Organização ativa</label>
            <select id="preview-organization" defaultValue="casa" aria-label="Organização ativa">
              <option value="casa">Casa da Geisa</option>
            </select>
          </form>
          <OrganizationCreate/>
        </div>
      </header>
      <div className="page-wrap">
        <div className="dash-hello"><h1>Casa da Geisa</h1><span className="role-chip">owner</span></div>
        <section className="panel" style={{ padding: 18 }}>
          <h2 className="panel-title">Demonstração do seletor</h2>
          <p className="panel-kicker">Use o botão verde no topo para criar uma organização extra sem alterar esta.</p>
        </section>
      </div>
    </div>
  </main>;
}
