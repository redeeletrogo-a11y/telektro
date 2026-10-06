"use client";
import { useActionState, useEffect, useState } from 'react';
import { getPayoutProfile, getPayoutStatement, savePayoutProfile, type PayoutProfile } from '@/app/eletroposto-repasse-actions';
import { csvCell, type summarizeRepasse } from '@/lib/eletroposto-repasse';
import type { FormState } from '@/app/workspace-actions';

type Statement = ReturnType<typeof summarizeRepasse>;
const money = (value: number) => value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const when = (iso: string) => new Date(iso).toLocaleString('pt-BR', { timeZone: 'America/Fortaleza' });
function PixForm({ organizationId, profile }: { organizationId: string; profile: PayoutProfile | null }) {
  const [state, action, pending] = useActionState(savePayoutProfile.bind(null, organizationId), {} as FormState);
  // Keep the saved values visible instead of resetting to the initial profile.
  return <form action={action} onReset={event => event.preventDefault()} className="ep-form">
    <label>Tipo de chave<select name="pix_kind" defaultValue={profile?.pix_kind ?? 'email'}><option value="email">E-mail</option><option value="cpf">CPF</option><option value="cnpj">CNPJ</option><option value="telefone">Telefone</option><option value="aleatoria">Aleatória</option></select></label>
    <label>Chave Pix<input name="pix_key" defaultValue={profile?.pix_key ?? ''} maxLength={200} autoComplete="off" required/></label>
    <label>Nome do titular<input name="holder_name" defaultValue={profile?.holder_name ?? ''} minLength={2} maxLength={120} autoComplete="off" required/></label>
    <p className="ep-note">Telefone: +55 e DDD. Confira o titular no banco antes de qualquer pagamento. Esta chave não é verificada pelo Telektro.</p>
    <button className="primary-button" disabled={pending}>{pending ? 'Salvando…' : 'Salvar chave Pix'}</button>
    {state.error && <p className="ep-msg err" role="alert">{state.error}</p>}
    {state.success && <p className="ep-msg ok" role="status">{state.success}</p>}
  </form>;
}
function download(statement: Statement, month: string) {
  const lines = [['ID da recarga', 'Concluída em', 'Meio', 'Cobrado (R$)', 'Taxa Telektro (R$)', 'Parte do dono (R$)'].map(csvCell).join(';')];
  for (const row of statement.rows) lines.push([row.id, when(row.at), row.method, row.gross.toFixed(2).replace('.', ','), row.fee.toFixed(2).replace('.', ','), row.net.toFixed(2).replace('.', ',')].map(csvCell).join(';'));
  const url = URL.createObjectURL(new Blob(['\ufeff' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' }));
  const link = document.createElement('a'); link.href = url; link.download = `extrato-conferencia-${month}.csv`; link.click(); URL.revokeObjectURL(url);
}
// preview data is only supplied by the protected preview route, never from an owner query.
export function EletropostoRepasse({ organizationId, preview }: { organizationId: string; preview?: { statement: Statement; profile: PayoutProfile } }) {
  const [month, setMonth] = useState(() => new Date(Date.now() - 3 * 3600_000).toISOString().slice(0, 7));
  const [statement, setStatement] = useState<Statement | null>(preview?.statement ?? null);
  const [profile, setProfile] = useState<PayoutProfile | null>(preview?.profile ?? null);
  const [canEdit, setCanEdit] = useState(false);
  const [error, setError] = useState('');
  const [profileError, setProfileError] = useState('');
  const [loading, setLoading] = useState(!preview);
  useEffect(() => {
    if (preview) return;
    let active = true;
    getPayoutProfile(organizationId).then(result => { if (active) { setProfile(result.profile ?? null); setCanEdit(result.canEdit ?? false); setProfileError(result.error ?? ''); } }).catch(() => { if (active) setProfileError('Não foi possível carregar a chave.'); });
    return () => { active = false; };
  }, [organizationId, preview]);
  useEffect(() => {
    if (preview) return;
    let active = true;
    getPayoutStatement(organizationId, month).then(result => { if (active) { setStatement(result.statement ?? null); setError(result.error ?? ''); setLoading(false); } }).catch(() => { if (active) { setError('Não foi possível carregar o extrato.'); setStatement(null); setLoading(false); } });
    return () => { active = false; };
  }, [organizationId, month, preview]);
  return <div className="ep-panel">
    {preview && <p className="ep-msg">DEMONSTRAÇÃO: valores fictícios. Não salva dados nem faz pagamentos.</p>}
    <section className="panel ep-card"><h3>Recebimento do dono</h3><p className="ep-note">Repasse manual por enquanto. Os clientes ainda pagam na conta da Nexa. Cadastrar a chave Pix não ativa transferência automática nem muda a cobrança.</p>
      {profileError ? <p className="ep-msg err" role="alert">{profileError}</p> : canEdit ? <PixForm organizationId={organizationId} profile={profile}/> : <p className="ep-note">{preview ? 'Chave de demonstração: dono@example.invalid' : 'Só o dono da conta pode ver e alterar os dados de recebimento.'}</p>}
    </section>
    <section className="panel ep-card"><div className="ep-card-head"><h3>Extrato para conferência</h3><label className="ep-month">Mês<input type="month" value={month} disabled={!!preview} onChange={event => { setMonth(event.target.value); setStatement(null); setError(''); setLoading(true); }}/></label></div>
      <p className="ep-note">Recargas concluídas no mês, no horário de Fortaleza. Somente consumo cobrado com taxa registrada e sem alerta. Reservas, devoluções integrais e recargas pendentes não entram. Mensalidade do software não está incluída e não é descontada aqui.</p>
      {loading && <p className="ep-note" role="status">Carregando extrato…</p>}{error && <p className="ep-msg err" role="alert">{error}</p>}
      {statement && <><div className="ep-stats"><div className="panel ep-stat"><span>Cobrado nas recargas</span><strong>{money(statement.gross)}</strong><small>{statement.rows.length} recargas</small></div><div className="panel ep-stat"><span>Taxa Telektro</span><strong>{money(statement.fee)}</strong><small>taxa registrada em cada recarga</small></div><div className="panel ep-stat ep-stat-main"><span>Parte do dono</span><strong>{money(statement.net)}</strong><small>para conferência, não é saldo disponível</small></div></div>
      {statement.excluded > 0 && <p className="ep-msg err" role="alert">{statement.excluded} registros excluídos por alerta ou valores incompletos. Confira antes de fechar o repasse.</p>}
      <p className="ep-note">Este extrato não confirma que o dinheiro foi repassado. Disponibilidade no Mercado Pago, estornos posteriores e pagamentos já feitos precisam ser conferidos separadamente.</p>
      {statement.rows.length ? <><button className="ep-csv" onClick={() => download(statement, month)}>Baixar extrato CSV</button><div className="ep-table-wrap"><table className="ep-table"><thead><tr><th>Conclusão</th><th>Meio</th><th>Cobrado</th><th>Taxa</th><th>Parte do dono</th></tr></thead><tbody>{statement.rows.slice(0, 100).map(row => <tr key={row.id}><td>{when(row.at)}</td><td>{row.method}</td><td>{money(row.gross)}</td><td>{money(row.fee)}</td><td>{money(row.net)}</td></tr>)}</tbody></table></div>{statement.rows.length > 100 && <p className="ep-note">Tela mostra 100; CSV inclui todos os registros do extrato.</p>}</> : <p className="ep-note">Nenhuma recarga elegível neste mês.</p>}</>}
    </section>
  </div>;
}
