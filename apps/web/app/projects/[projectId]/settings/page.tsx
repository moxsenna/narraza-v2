import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getSessionUser } from '../../../lib/get-session-user.js';
import { getCreditSummary } from '@narraza/application';
import { createUserRepo } from '@narraza/db/repositories/user-repo.js';
import { createLedgerRepo } from '@narraza/db/repositories/ledger-repo.js';
import { getPrisma } from '@narraza/db/client.js';

export default async function SettingsPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const sessionUser = await getSessionUser();
  if (!sessionUser) redirect('/auth/email');

  const { projectId } = await params;
  const prisma = getPrisma();

  // Credit summary
  let credit: any = null;
  let creditError: string | null = null;

  try {
    const ledgerRepo = createLedgerRepo();
    credit = await getCreditSummary(
      {
        userRepo: createUserRepo(),
        ledgerRepo: {
          listByUserId: async (uid: string) => {
            const entries = await ledgerRepo.listByUserId(uid);
            return entries.map((e) => ({ entryType: e.entryType, amountMicro: e.amountMicro }));
          },
        },
        reservationRepo: {
          listActiveByUserId: async (uid: string) => {
            const rows = await prisma.creditReservation.findMany({
              where: { userId: uid, status: { not: 'closed' } },
            });
            return rows.map((r) => ({
              reservedAmount: r.reservedAmount,
              settledAmount: r.settledAmount,
              releasedAmount: r.releasedAmount,
              openExposureAmount: 0n,
            }));
          },
        },
      },
      { userId: sessionUser.userId },
    );
  } catch (err: any) {
    creditError = err?.message ?? 'Gagal memuat ringkasan kredit.';
  }

  function fmt(microIdr: string): string {
    const n = BigInt(microIdr);
    const idr = Number(n) / 1_000_000;
    if (idr >= 1000) return `Rp ${(idr / 1000).toFixed(1)}jt`;
    return `Rp ${idr.toLocaleString('id-ID')}`;
  }

  return (
    <div style={{ maxWidth: 640, margin: '0 auto' }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 4 }}>Pengaturan</h1>
      <p style={{ color: '#6b7280', marginBottom: 24, fontSize: 14 }}>
        Ringkasan kredit dan informasi akun.
      </p>

      {/* Credit Summary Card */}
      <div
        style={{
          backgroundColor: '#fff',
          border: '1px solid #e5e7eb',
          borderRadius: 8,
          padding: 24,
          marginBottom: 24,
        }}
      >
        <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 16, color: '#111827' }}>
          Ringkasan Kredit
        </h2>

        {creditError && (
          <div
            style={{
              padding: 8,
              backgroundColor: '#fef2f2',
              color: '#dc2626',
              borderRadius: 4,
              fontSize: 13,
              marginBottom: 12,
            }}
          >
            {creditError}
          </div>
        )}

        {credit && (
          <div>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: 10,
                fontSize: 14,
              }}
            >
              <CreditRow label="Total Grants" value={fmt(credit.totalGrants)} />
              <CreditRow label="Total Settlements" value={fmt(credit.totalSettlements)} />
              <CreditRow label="Total Refunds" value={fmt(credit.totalRefunds)} />
              <CreditRow label="Net Adjustments" value={fmt(credit.netAdjustments)} />
              <CreditRow label="Book Balance" value={fmt(credit.bookBalance)} highlight />
              <CreditRow label="Held Balance" value={fmt(credit.heldBalance)} />
              <CreditRow label="Reconciling" value={fmt(credit.reconciling)} />
            </div>

            <div
              style={{
                marginTop: 16,
                padding: '12px 16px',
                backgroundColor: '#f0fdf4',
                border: '1px solid #86efac',
                borderRadius: 6,
              }}
            >
              <div style={{ fontSize: 12, color: '#065f46', marginBottom: 2 }}>
                Kredit Tersedia
              </div>
              <div style={{ fontSize: 22, fontWeight: 700, color: '#065f46' }}>
                {fmt(credit.availableCredit)}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Project info card */}
      <div
        style={{
          backgroundColor: '#fff',
          border: '1px solid #e5e7eb',
          borderRadius: 8,
          padding: 24,
        }}
      >
        <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 16, color: '#111827' }}>
          Info Proyek
        </h2>
        <div style={{ fontSize: 13, color: '#6b7280', lineHeight: 1.8 }}>
          <div>Project ID: {projectId}</div>
          <div>User ID: {sessionUser.userId}</div>
        </div>
      </div>

      <div style={{ marginTop: 24 }}>
        <Link
          href="/dashboard"
          style={{
            display: 'inline-block',
            padding: '8px 16px',
            color: '#6b7280',
            textDecoration: 'none',
            border: '1px solid #d1d5db',
            borderRadius: 4,
            fontSize: 14,
          }}
        >
          &larr; Kembali ke Dashboard
        </Link>
      </div>
    </div>
  );
}

function CreditRow({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        padding: '6px 0',
        borderBottom: '1px solid #f3f4f6',
        fontWeight: highlight ? 600 : 400,
      }}
    >
      <span style={{ color: '#6b7280', fontSize: 13 }}>{label}</span>
      <span style={{ color: '#111827', fontSize: 13 }}>{value}</span>
    </div>
  );
}
