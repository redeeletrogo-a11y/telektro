"use client";
import { useActionState, useEffect, useState, useTransition } from 'react';
import { useSearchParams } from 'next/navigation';
import { getMercadoPagoConnection, getPayoutProfile, getPayoutStatement, recordPayout, removeMercadoPagoConnection, savePayoutProfile, type MercadoPagoConnectionInfo, type PayoutProfile } from '@/app/eletroposto-repasse-actions';
import { csvCell, type PayoutRecord, type summarizeRepasse } from '@/lib/eletroposto-repasse';
import type { FormState } from '@/app/workspace-actions';

type Statement = ReturnType<typeof summarizeRepasse>;
type Balance = { paid: number; due: number; overpaid: number };
function PayoutForm({ organizationId, month, onSaved }: { organizationId: string; month: string; onSaved: () => void }) {
  const [state, action, pending] = useActionState(async (previous: FormState, form: FormData) => { const result = await recordPayout(organizationId, month, previous, form); if (result.success) onSaved(); return result; }, {} as FormState);
  return <form action={action} className="ep-form">
    <label>Valor recebido (R$)<input name="amount" inputMode="decimal" placeholder="0,00" required/></label>
    <label>Data do recebimento<input name="paid_on" type="date" required/></label>
    <label>Observação (opcional)<input name="note" maxLength={200} autoComplete="off"/></label>
    <button className="primary-button" disabled={pending}>{pending ? 'Registrando…' : 'Registrar repasse recebido'}</button>
    {state.error && <p className="ep-msg err" role="alert">{state.error}</p>}
    {state.success && <p className="ep-msg ok" role="status">{state.success}</p>}
  </form>;
}
const money = (value: number) => value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const when = (iso: string) => new Date(iso).toLocaleString('pt-BR', { timeZone: 'America/Fortaleza' });

const mpMessages: Record<string, { text: string; ok?: boolean }> = {
  connected: { text: 'Mercado Pago conectado. As próximas vendas já usam a conta do dono.', ok: true },
  denied: { text: 'A autorização foi cancelada no Mercado Pago.' },
  invalid: { text: 'A resposta do Mercado Pago expirou ou é inválida. Tente conectar de novo.' },
  forbidden: { text: 'Entre como dono da conta Eletroposto para conectar o Mercado Pago.' },
  config: { text: 'A conexão automática ainda não está configurada no sistema.' },
  migration: { text: 'A conexão automática ainda não está disponível. A migração do banco precisa ser aplicada.' },
  exchange: { text: 'Não foi possível concluir a conexão com o Mercado Pago. Tente de novo.' },
};

function MercadoPagoConnectionCard({ organizationId, onChange, preview }: { organizationId: string; onChange: (connected: boolean) => void; preview?: MercadoPagoConnectionInfo }) {
  const params = useSearchParams();
  const [connection, setConnection] = useState<MercadoPagoConnectionInfo | null>(preview ?? null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState<FormState>(() => {
    const result = params.get('mp');
    if (!result || !mpMessages[result]) return {};
    return mpMessages[result].ok ? { success: mpMessages[result].text } : { error: mpMessages[result].text };
  });
  const [pending, start] = useTransition();
  useEffect(() => {
    if (preview) return;
    let active = true;
    getMercadoPagoConnection(organizationId).then(result => {
      if (!active) return;
      if ('error' in result) { setError(result.error); setConnection(null); onChange(false); return; }
      setConnection(result); setError(''); onChange(result.connected);
    }).catch(() => { if (active) { setError('Não foi possível carregar a conexão do Mercado Pago.'); onChange(false); } });
    return () => { active = false; };
  }, [organizationId, onChange, preview]);
  function disconnect() {
    if (!window.confirm('Desconectar o Mercado Pago? Novas vendas voltam para o repasse manual.')) return;
    start(async () => {
      const result = await removeMercadoPagoConnection(organizationId);
      setMessage(result);
      if (result.success) {
        const next = await getMercadoPagoConnection(organizationId);
        if (!('error' in next)) { setConnection(next); onChange(next.connected); }
      }
    });
  }
  return <section className="panel ep-card"><div className="ep-card-head"><div><h3>Recebimento automático</h3><p className="ep-note">Conecte a conta Mercado Pago do dono. O pagamento cai nela e a parte do Telektro é separada na hora.</p></div>{connection?.connected ? <span className="ep-chip">Automático ativo</span> : <span className="ep-chip warn">Repasse manual</span>}</div>
    {error && <p className="ep-msg err" role="alert">{error}</p>}
    {message.error && <p className="ep-msg err" role="alert">{message.error}</p>}
    {message.success && <p className="ep-msg ok" role="status">{message.success}</p>}
    {connection?.unavailable && <p className="ep-msg err" role="alert">Conexão automática indisponível. A migração do banco precisa ser aplicada.</p>}
    {connection?.connected ? <>
      <p className="ep-note">Conta Mercado Pago terminada em {connection.mpUserIdSuffix ?? '----'} conectada{connection.connectedAt ? ` em ${when(connection.connectedAt)}` : ''}. Novas vendas não entram no repasse semanal manual.</p>
      {connection.lastError && <p className="ep-msg err" role="alert">Última renovação falhou. Desconecte e conecte de novo, ou confira a conta no Mercado Pago.</p>}
      {connection.canEdit && <div className="ep-actions"><button disabled={pending} onClick={disconnect}>{pending ? 'Desconectando…' : 'Desconectar Mercado Pago'}</button></div>}
    </> : <>
      <p className="ep-note">Sem conta conectada, o cliente paga na conta da plataforma e o dono recebe por repasse manual toda segunda-feira. O Mercado Pago decide se a conta pode ser conectada depois da verificação de segurança (KYC).</p>
      {!connection?.configured && <p className="ep-msg err" role="alert">Conexão automática temporariamente indisponível.</p>}
      {connection?.canEdit && connection.configured && !connection.unavailable && <div className="ep-actions"><a className="ep-primary" href={`/api/eletroposto/mercadopago/connect?organization_id=${organizationId}`}>Conectar Mercado Pago</a></div>}
      {connection && !connection.canEdit && <p className="ep-note">Só o dono da conta pode conectar o Mercado Pago.</p>}
    </>}
  </section>;
}
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
  const lines = [['ID da recarga', 'Concluída em', 'Meio', 'Reservado (R$)', 'Devolvido (R$)', 'Cobrado (R$)', 'Taxa Telektro (R$)', 'Parte do dono (R$)'].map(csvCell).join(';')];
  for (const row of statement.rows) lines.push([row.id, when(row.at), row.method, row.reserved.toFixed(2).replace('.', ','), row.refunded.toFixed(2).replace('.', ','), row.gross.toFixed(2).replace('.', ','), row.fee.toFixed(2).replace('.', ','), row.net.toFixed(2).replace('.', ',')].map(csvCell).join(';'));
  const url = URL.createObjectURL(new Blob(['\ufeff' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' }));
  const link = document.createElement('a'); link.href = url; link.download = `extrato-conferencia-${month}.csv`; link.click(); URL.revokeObjectURL(url);
}
// preview data is only supplied by the protected preview route, never from an owner query.
export function EletropostoRepasse({ organizationId, preview }: { organizationId: string; preview?: { statement: Statement; profile: PayoutProfile; mp: MercadoPagoConnectionInfo } }) {
  const [month, setMonth] = useState(() => new Date(Date.now() - 3 * 3600_000).toISOString().slice(0, 7));
  const [statement, setStatement] = useState<Statement | null>(preview?.statement ?? null);
  const [profile, setProfile] = useState<PayoutProfile | null>(preview?.profile ?? null);
  const [canEdit, setCanEdit] = useState(false);
  const [payouts, setPayouts] = useState<PayoutRecord[]>([]);
  const [balance, setBalance] = useState<Balance | null>(null);
  const [payoutsUnavailable, setPayoutsUnavailable] = useState(false);
  const [reload, setReload] = useState(0);
  const [error, setError] = useState('');
  const [profileError, setProfileError] = useState('');
  const [mpConnected, setMpConnected] = useState<boolean | null>(preview ? preview.mp.connected : null);
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
    getPayoutStatement(organizationId, month).then(result => { if (active) { setStatement(result.statement ?? null); setPayouts(result.payouts ?? []); setBalance(result.balance ?? null); setPayoutsUnavailable(Boolean(result.payoutsUnavailable)); setError(result.error ?? ''); setLoading(false); } }).catch(() => { if (active) { setError('Não foi possível carregar o extrato.'); setStatement(null); setLoading(false); } });
    return () => { active = false; };
  }, [organizationId, month, preview, reload]);
  return <div className="ep-panel">
    {preview && <p className="ep-msg">DEMONSTRAÇÃO: valores fictícios. Não salva dados nem faz pagamentos.</p>}
    <MercadoPagoConnectionCard organizationId={organizationId} onChange={setMpConnected} preview={preview?.mp}/>
    {mpConnected !== true && <section className="panel ep-card"><h3>Repasse manual semanal</h3><p className="ep-note">Sem Mercado Pago conectado, os clientes pagam na conta da plataforma e o dono recebe por Pix toda segunda-feira. Cadastrar a chave não ativa transferência automática.</p>
      {profileError ? <p className="ep-msg err" role="alert">{profileError}</p> : canEdit ? <PixForm organizationId={organizationId} profile={profile}/> : <p className="ep-note">{preview ? 'Chave de demonstração: dono@example.invalid' : 'Só o dono da conta pode ver e alterar os dados de recebimento.'}</p>}
    </section>}
    <section className="panel ep-card"><div className="ep-card-head"><h3>Extrato para conferência</h3><label className="ep-month">Mês<input type="month" value={month} disabled={!!preview} onChange={event => { setMonth(event.target.value); setStatement(null); setError(''); setLoading(true); }}/></label></div>
      <p className="ep-note">Recargas concluídas no mês, no horário de Fortaleza. Somente consumo cobrado com taxa registrada e sem alerta. Reservas, devoluções integrais e recargas pendentes não entram. Mensalidade do software não está incluída e não é descontada aqui.</p>
      {loading && <p className="ep-note" role="status">Carregando extrato…</p>}{error && <p className="ep-msg err" role="alert">{error}</p>}
      {mpConnected === true && <p className="ep-note">Este extrato mostra só vendas que caíram na plataforma. Vendas da conta conectada caem direto no Mercado Pago do dono e não entram no repasse manual.</p>}
      {statement && <><div className="ep-stats"><div className="panel ep-stat"><span>Cobrado nas recargas</span><strong>{money(statement.gross)}</strong><small>{statement.rows.length} recargas</small></div><div className="panel ep-stat"><span>Taxa Telektro</span><strong>{money(statement.fee)}</strong><small>taxa registrada em cada recarga</small></div><div className="panel ep-stat ep-stat-main"><span>Parte do dono</span><strong>{money(statement.net)}</strong><small>para conferência, não é saldo disponível</small></div></div>
      {mpConnected !== true && balance && <div className="ep-stats"><div className="panel ep-stat"><span>Já pago</span><strong>{money(balance.paid)}</strong><small>{payouts.length} {payouts.length === 1 ? 'registro' : 'registros'} do dono neste mês</small></div><div className="panel ep-stat ep-stat-main"><span>A repassar</span><strong>{money(balance.due)}</strong><small>{balance.overpaid > 0 ? `registrado ${money(balance.overpaid)} a mais que o extrato` : 'parte do dono menos o já pago'}</small></div></div>}
      {payoutsUnavailable && <p className="ep-msg err" role="alert">Registro de repasses indisponível. A migração precisa estar aplicada.</p>}
      {mpConnected !== true && payouts.length > 0 && <ul className="ep-note">{payouts.map(p => <li key={p.id}>{new Date(p.paid_on + 'T12:00:00').toLocaleDateString('pt-BR')}: {money(p.amount)}{p.note ? ` · ${p.note}` : ''}</li>)}</ul>}
      {mpConnected !== true && canEdit && !preview && !payoutsUnavailable && <details><summary>Registrar repasse recebido</summary><PayoutForm organizationId={organizationId} month={month} onSaved={() => setReload(n => n + 1)}/></details>}
      {statement.excluded > 0 && <p className="ep-msg err" role="alert">{statement.excluded} registros excluídos por alerta ou valores incompletos. Confira antes de fechar o repasse.</p>}
      <p className="ep-note">Este extrato não confirma que o dinheiro foi repassado. Disponibilidade no Mercado Pago, estornos posteriores e pagamentos já feitos precisam ser conferidos separadamente.</p>
      {statement.rows.length ? <><button className="ep-csv" onClick={() => download(statement, month)}>Baixar extrato CSV</button><div className="ep-table-wrap"><table className="ep-table"><thead><tr><th>Conclusão</th><th>Meio</th><th>Reservado</th><th>Devolvido</th><th>Cobrado</th><th>Taxa</th><th>Parte do dono</th></tr></thead><tbody>{statement.rows.slice(0, 100).map(row => <tr key={row.id}><td>{when(row.at)}</td><td>{row.method}</td><td>{money(row.reserved)}</td><td>{money(row.refunded)}</td><td>{money(row.gross)}</td><td>{money(row.fee)}</td><td>{money(row.net)}</td></tr>)}</tbody></table></div>{statement.rows.length > 100 && <p className="ep-note">Tela mostra 100; CSV inclui todos os registros do extrato.</p>}</> : <p className="ep-note">Nenhuma recarga elegível neste mês.</p>}</>}
    </section>
  </div>;
}
