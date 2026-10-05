import { notFound } from 'next/navigation';
import { EletropostoRepasse } from '@/components/eletroposto-repasse';
import '@/components/dashboard-theme.css';
export const dynamic = 'force-dynamic';
export default function RepassePreview() {
  // Fictional, read-only demo. Never present on production or with real organization IDs.
  if (process.env.VERCEL_ENV !== 'preview') notFound();
  const preview = { profile: { pix_kind: 'email', pix_key: 'dono@example.invalid', holder_name: 'Dono demonstrativo', updated_at: '2026-10-05T12:00:00Z' }, statement: { gross: 100, fee: 7, net: 93, excluded: 1, rows: [{ id: 'demo-pix', at: '2026-10-05T12:00:00Z', method: 'Pix', gross: 50, fee: 2.5, net: 47.5 }, { id: 'demo-card', at: '2026-10-05T12:05:00Z', method: 'Cartão', gross: 50, fee: 4.5, net: 45.5 }] } };
  return <main className="dashboard-shell repasse-preview" style={{ display: 'block', padding: '24px', maxWidth: 1100, margin: '0 auto' }}><h1>Telektro · Repasses</h1><EletropostoRepasse organizationId="demonstracao" preview={preview}/></main>;
}
