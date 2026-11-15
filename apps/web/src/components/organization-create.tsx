"use client";

import { useActionState, useState } from "react";
import { createPortal } from "react-dom";
import { ArrowRight, Home, PlugZap, Plus, X } from "lucide-react";
import { createOrganization, type FormState } from "@/app/workspace-actions";

const initialState: FormState = {};
const accountTypes = [
  { value: "eletroposto", title: "Eletroposto", icon: PlugZap, description: "Venda recargas com QR e conecte o Mercado Pago." },
  { value: "residencial", title: "Residencial", icon: Home, description: "Uso pessoal, com seus carregadores em casa." },
] as const;

type ExtraAccountType = (typeof accountTypes)[number]["value"];

function makeSlug(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
    .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60);
}

function OrganizationCreateDialog({ onClose }: { onClose: () => void }) {
  const [state, action, pending] = useActionState(createOrganization, initialState);
  const [name, setName] = useState("");
  const [type, setType] = useState<ExtraAccountType>("eletroposto");
  const slug = makeSlug(name);

  const dialog = <div className="organization-create-backdrop" onClick={() => { if (!pending) onClose(); }}>
    <section className="organization-create-dialog" role="dialog" aria-modal="true" aria-labelledby="organization-create-title" onClick={(event) => event.stopPropagation()}>
      <button type="button" className="organization-create-close" onClick={onClose} disabled={pending} aria-label="Fechar"><X size={16}/></button>
      <p className="eyebrow">Nova organização</p>
      <h2 id="organization-create-title">Criar outra organização</h2>
      <p className="organization-create-copy">Sua organização atual continua intacta. Depois de criar, você alterna entre elas no seletor acima.</p>
      <form action={action}>
        <fieldset className="organization-type-grid" disabled={pending}>
          <legend className="sr-only">Tipo da nova organização</legend>
          {accountTypes.map(({ value, title, icon: Icon, description }) => <label key={value} className={`organization-type-option ${type === value ? "selected" : ""}`}>
            <input type="radio" name="account_type" value={value} checked={type === value} onChange={() => setType(value)}/>
            <Icon size={18}/>
            <span><strong>{title}</strong><small>{description}</small></span>
          </label>)}
        </fieldset>
        <div className="organization-field">
          <label htmlFor="extra-organization-name">Nome</label>
          <input id="extra-organization-name" name="name" value={name} onChange={(event) => setName(event.target.value)} maxLength={120} autoComplete="organization" placeholder={type === "eletroposto" ? "Ex.: Eletroposto da Geisa" : "Ex.: Casa da Geisa"} autoFocus required/>
        </div>
        <div className="organization-field">
          <label htmlFor="extra-organization-slug">Identificador</label>
          <input id="extra-organization-slug" name="slug" value={slug} readOnly required/>
          <small>Gerado a partir do nome e usado em links internos.</small>
        </div>
        {state.error && <p className="organization-create-error" role="alert">{state.error}</p>}
        <div className="organization-create-actions">
          <button type="button" className="secondary-button" onClick={onClose} disabled={pending}>Cancelar</button>
          <button type="submit" className="primary-button" disabled={pending || !slug}>{pending ? "Criando…" : "Criar organização"}<ArrowRight size={14}/></button>
        </div>
      </form>
    </section>
  </div>;
  return typeof document === "undefined" ? dialog : createPortal(dialog, document.body);
}

export function OrganizationCreate() {
  const [open, setOpen] = useState(false);
  return <>
    <button type="button" className="organization-create-button" onClick={() => setOpen(true)} aria-haspopup="dialog" aria-label="Criar outra organização">
      <Plus size={13}/><span>Criar outra organização</span>
    </button>
    {open && <OrganizationCreateDialog onClose={() => setOpen(false)}/>}
  </>;
}
