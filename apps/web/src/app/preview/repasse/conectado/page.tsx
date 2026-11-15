import { notFound } from 'next/navigation';
import { EletropostoRepasse } from '@/components/eletroposto-repasse';
import '@/components/dashboard-theme.css';
export const dynamic = 'force-dynamic';
const preview = {
  profile: { pix_kind: 'email', pix_key: 'dono@example.invalid', holder_name: 'Dono demonstrativo', updated_at: '2026-10-05T12:00:00Z' },
  statement: { gross: 0, fee: 0, net: 0, excluded: 0, rows: [] },
  mp: { connected: true, configured: true, canEdit: false, mpUserIdSuffix: '4321', connectedAt: '2026-11-15T12:00:00Z' },
};
export default function RepasseConectadoPreview() {
  // Fictional, read-only demo. Never present on production or with real organization IDs.
  if (process.env.VERCEL_ENV !== 'preview') notFound();
  return <main className="dashboard-shell repasse-preview" style={{ display: 'block', padding: '24px', maxWidth: 1100, margin: '0 auto' }}><h1>Telektro · Repasses</h1><EletropostoRepasse organizationId="demonstracao" preview={preview}/></main>;
}
