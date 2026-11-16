import { notFound } from 'next/navigation';
import { EletropostoRepasse } from '@/components/eletroposto-repasse';
import '@/components/dashboard-theme.css';
export const dynamic = 'force-dynamic';
const preview = {
  profile: { pix_kind: 'email', pix_key: 'dono@example.invalid', holder_name: 'Dono demonstrativo', updated_at: '2026-10-05T12:00:00Z' },
  statement: { gross: 50, fee: 4, net: 46, excluded: 0, rows: [{ id: 'demo-pix-1', at: '2026-11-03T12:00:00Z', method: 'Pix', reserved: 30, refunded: 10, gross: 20, fee: 1.6, net: 18.4 }, { id: 'demo-pix-2', at: '2026-11-04T15:30:00Z', method: 'Pix', reserved: 30, refunded: 0, gross: 30, fee: 2.4, net: 27.6 }] },
  payouts: [{ id: 'demo-pay-1', amount: 18.4, paid_on: '2026-11-09', note: 'Pix semana anterior' }],
  mp: { connected: true, configured: true, canEdit: false, mpUserIdSuffix: '4321', connectedAt: '2026-11-15T12:00:00Z' },
};
export default function RepasseConectadoPreview() {
  // Fictional, read-only demo. Never present on production or with real organization IDs.
  if (process.env.VERCEL_ENV !== 'preview') notFound();
  return <main className="dashboard-shell repasse-preview" style={{ display: 'block', padding: '24px', maxWidth: 1100, margin: '0 auto' }}><h1>Telektro · Repasses</h1><EletropostoRepasse organizationId="demonstracao" preview={preview}/></main>;
}
