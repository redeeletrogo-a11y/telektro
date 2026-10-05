"use server";
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { serviceClient } from '@/lib/pix';
import { monthRange, normalizePix, summarizeRepasse, type RepassePayment } from '@/lib/eletroposto-repasse';
import type { FormState } from '@/app/workspace-actions';

async function access(organizationId: string) {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(organizationId)) return null;
  const client = await createSupabaseServerClient();
  const { data: { user } } = await client.auth.getUser();
  if (!user) return null;
  const [{ data: member }, { data: org }] = await Promise.all([
    client.from('memberships').select('role').eq('organization_id', organizationId).eq('user_id', user.id).maybeSingle(),
    client.from('organizations').select('account_type').eq('id', organizationId).maybeSingle(),
  ]);
  if (!member || !['owner', 'admin'].includes(member.role) || org?.account_type !== 'eletroposto') return null;
  return { userId: user.id, isOwner: member.role === 'owner' };
}
export type PayoutProfile = { pix_kind: string; pix_key: string; holder_name: string; updated_at: string };
export async function getPayoutProfile(organizationId: string): Promise<{ profile?: PayoutProfile | null; error?: string; canEdit?: boolean }> {
  const auth = await access(organizationId);
  if (!auth) return { error: 'Acesso não permitido.' };
  if (!auth.isOwner) return { canEdit: false };
  const { data, error } = await serviceClient().from('eletroposto_payout_profiles').select('pix_kind,pix_key,holder_name,updated_at').eq('organization_id', organizationId).maybeSingle();
  if (error) return { error: 'Cadastro de repasse indisponível. A migração precisa estar aplicada.' };
  return { profile: data, canEdit: true };
}
export async function savePayoutProfile(organizationId: string, _previous: FormState, form: FormData): Promise<FormState> {
  const auth = await access(organizationId);
  if (!auth?.isOwner) return { error: 'Só o dono da conta pode alterar a chave de recebimento.' };
  const kind = String(form.get('pix_kind') ?? '');
  const key = normalizePix(kind, String(form.get('pix_key') ?? ''));
  const holder = String(form.get('holder_name') ?? '').trim();
  if (!key || holder.length < 2 || holder.length > 120 || /[\u0000-\u001f]/.test(holder)) return { error: 'Confira o tipo, a chave Pix e o nome do titular. Telefone deve incluir + e código do país.' };
  const { error } = await serviceClient().from('eletroposto_payout_profiles').upsert({ organization_id: organizationId, pix_kind: kind, pix_key: key, holder_name: holder, updated_by: auth.userId, updated_at: new Date().toISOString() }, { onConflict: 'organization_id' });
  return error ? { error: 'Não foi possível salvar. Confira se a migração foi aplicada.' } : { success: 'Chave salva para conferência. Nenhuma transferência foi feita.' };
}
export async function getPayoutStatement(organizationId: string, month: string) {
  if (!await access(organizationId)) return { error: 'Acesso não permitido.' };
  const range = monthRange(month);
  if (!range) return { error: 'Mês inválido.' };
  const client = serviceClient();
  const rows: RepassePayment[] = [];
  // Paginate; fail closed rather than give an incomplete financial total.
  for (let offset = 0; offset <= 10000; offset += 500) {
    const { data, error } = await client.from('eletroposto_payments').select('id,settled_at,charged_amount,fee_amount,needs_attention,payment_method')
      .eq('organization_id', organizationId).eq('status', 'settled').gte('settled_at', range.from).lt('settled_at', range.to)
      .order('settled_at').order('id').range(offset, offset + 499);
    if (error) return { error: 'Não foi possível carregar o extrato.' };
    rows.push(...(data ?? []) as RepassePayment[]);
    if (rows.length > 10000) return { error: 'Este mês ultrapassa 10.000 registros. O total não será exibido incompleto; peça uma exportação assistida.' };
    if ((data?.length ?? 0) < 500) break;
  }
  return { statement: summarizeRepasse(rows) };
}
