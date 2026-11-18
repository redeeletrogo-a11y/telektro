import { notFound } from 'next/navigation';
import { EletropostoRepasse } from '@/components/eletroposto-repasse';
import '@/components/dashboard-theme.css';
export const dynamic = 'force-dynamic';
const preview = {
  profile: { pix_kind: 'email', pix_key: 'dono@example.invalid', holder_name: 'Dono demonstrativo', updated_at: '2026-10-05T12:00:00Z' },
  statement: { gross: 100, fee: 7, net: 93, excluded: 1, rows: [{ id: 'demo-pix', at: '2026-10-05T12:00:00Z', method: 'Pix', reserved: 60, refunded: 10, gross: 50, fee: 2.5, net: 47.5 }, { id: 'demo-card', at: '2026-10-05T12:05:00Z', method: 'Cartão', reserved: 60, refunded: 10, gross: 50, fee: 4.5, net: 45.5 }] },
  weekStatement: { gross: 40, fee: 3.2, net: 36.8, excluded: 0, rows: [{ id: 'demo-week-pix', at: '2026-10-05T13:30:00Z', method: 'Pix', reserved: 40, refunded: 0, gross: 40, fee: 3.2, net: 36.8 }] },
  payouts: [{ id: 'demo-payout-1', amount: 80, paid_on: '2026-10-12', note: 'Pix semana 1' }, { id: 'demo-payout-2', amount: 13, paid_on: '2026-10-19', note: 'Pix semana 2' }],
  weekPayouts: [{ id: 'demo-payout-3', amount: 30, paid_on: '2026-10-05', note: 'Pix da semana' }],
  mp: { connected: false, configured: true, canEdit: true },
};
export default function RepassePreview() {
  // Fictional, read-only demo. Never present on production or with real organization IDs.
  if (process.env.VERCEL_ENV !== 'preview') notFound();
  return <main className="dashboard-shell repasse-preview" style={{ display: 'block', padding: '24px', maxWidth: 1100, margin: '0 auto' }}><h1>Telektro · Repasses</h1><EletropostoRepasse organizationId="demonstracao" preview={preview}/></main>;
}
