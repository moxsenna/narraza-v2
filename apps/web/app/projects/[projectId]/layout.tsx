import Link from 'next/link';
import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { getSessionUser } from '../../lib/get-session-user';
import { lockOwnedProject, computeProjectProgress, getCreditSummary } from '@narraza/application';
import { createProjectRepo, createUserRepo, createLedgerRepo, createFoundationRepo, createCharacterRepo } from '../../lib/server/db';
import {
  countChapterOutlines,
  countBeatsForProject,
  countActiveJobs,
  listActiveReservationsForCredit,
} from '../../lib/server/project-reads';

export const metadata: Metadata = {
  title: 'Narraza - Project',
};

/** SIDEBAR STAGES (Indonesian UI terms from design S9) */
const STAGES: Array<{ label: string; phase: string; route: string; indonesian: string }> = [
  { label: 'Intake', phase: 'intake', route: 'intake', indonesian: 'Ekstrak Cerita' },
  { label: 'Konsep', phase: 'concepts', route: 'concepts', indonesian: 'Pilih Konsep' },
  { label: 'Fondasi Cerita', phase: 'foundation', route: 'foundation', indonesian: 'Fondasi' },
  { label: 'Karakter', phase: 'characters', route: 'characters', indonesian: 'Karakter' },
  { label: 'Outline', phase: 'outline', route: 'outline', indonesian: 'Jadwal Rahasia' },
  { label: 'Menulis', phase: 'writing', route: 'write', indonesian: 'Adegan' },
  { label: 'Usulan AI', phase: 'proposals', route: 'proposals', indonesian: 'Usulan AI' },
];

function formatCredit(microIdr: string): string {
  const n = BigInt(microIdr);
  const idr = Number(n) / 1_000_000;
  if (idr >= 1000) return `Rp ${(idr / 1000).toFixed(1)}jt`;
  return `Rp ${idr.toLocaleString('id-ID')}`;
}

export default async function ProjectLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ projectId: string }>;
}) {
  const sessionUser = await getSessionUser();
  if (!sessionUser) {
    redirect('/auth/email');
  }

  const { projectId } = await params;

  // Verify project ownership
  const projectRepo = createProjectRepo();
  try {
    await lockOwnedProject(projectRepo, projectId, sessionUser.userId);
  } catch {
    redirect('/dashboard');
  }

  const project = await projectRepo.findById(projectId);
  if (!project) redirect('/dashboard');

  // Compute progress for sidebar highlighting
  const foundationRepo = createFoundationRepo();
  const characterRepo = createCharacterRepo();

  const foundation = await foundationRepo.findByProjectId(projectId);
  const characters = await characterRepo.findActiveByProjectId(projectId);
  const chapterCount = await countChapterOutlines(projectId);
  const beatCount = await countBeatsForProject(projectId);
  const activeJobCount = await countActiveJobs(projectId);

  const progress = computeProjectProgress({
    hasIntake: foundation !== null,
    foundationStatus: project.foundationStatus,
    hasCharacters: characters.length > 0,
    chapterCount,
    hasAcceptedProse: beatCount > 0,
    hasActiveJob: activeJobCount > 0,
    hasWorkingDraft: false,
  });

  // Credit summary for top bar
  const ledgerRepo = createLedgerRepo();
  let credit: { availableCredit: string; heldBalance: string; reconciling: string } | null = null;
  try {
    const summary = await getCreditSummary(
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
            return listActiveReservationsForCredit(uid);
          },
        },
      },
      { userId: sessionUser.userId },
    );
    credit = {
      availableCredit: summary.availableCredit,
      heldBalance: summary.heldBalance,
      reconciling: summary.reconciling,
    };
  } catch {
    // Credit summary is best-effort for UI shell
  }

  const currentPath = `projects/${projectId}`;

  return (
    <div style={{ display: 'flex', height: '100vh', fontFamily: 'system-ui, sans-serif' }}>
      {/* Sidebar */}
      <aside
        style={{
          width: 240,
          borderRight: '1px solid #e5e7eb',
          backgroundColor: '#f9fafb',
          display: 'flex',
          flexDirection: 'column',
          padding: '16px 0',
          flexShrink: 0,
        }}
      >
        <div style={{ padding: '0 16px', marginBottom: 24 }}>
          <Link
            href="/dashboard"
            style={{
              fontSize: 18,
              fontWeight: 700,
              color: '#111827',
              textDecoration: 'none',
            }}
          >
            Narraza
          </Link>
          <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>{project.title}</div>
        </div>

        <nav style={{ flex: 1 }}>
          {STAGES.map((stage) => {
            const chip = progress.chips.find((c) => c.phase === stage.phase);
            const isActive = chip?.active ?? false;
            const isCompleted = chip?.completed ?? false;

            return (
              <Link
                key={stage.phase}
                href={`/projects/${projectId}/${stage.route}`}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '8px 16px',
                  fontSize: 14,
                  textDecoration: 'none',
                  color: isActive ? '#111827' : '#6b7280',
                  backgroundColor: isActive ? '#e5e7eb' : 'transparent',
                  fontWeight: isActive ? 600 : 400,
                  borderLeft: isActive ? '3px solid #0070f3' : '3px solid transparent',
                }}
              >
                <span
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    backgroundColor: isCompleted
                      ? '#16a34a'
                      : isActive
                        ? '#0070f3'
                        : '#d1d5db',
                    flexShrink: 0,
                  }}
                />
                <span>{stage.indonesian}</span>
                {isCompleted && (
                  <span style={{ marginLeft: 'auto', color: '#16a34a', fontSize: 12 }}>&#10003;</span>
                )}
              </Link>
            );
          })}

          <div style={{ borderTop: '1px solid #e5e7eb', marginTop: 16, paddingTop: 16 }}>
            <Link
              href={`/projects/${projectId}/settings`}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '8px 16px',
                fontSize: 14,
                textDecoration: 'none',
                color: '#6b7280',
              }}
            >
              <span style={{ fontSize: 16 }}>&#9881;</span>
              <span>Pengaturan</span>
            </Link>
            <Link
              href="/dashboard"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '8px 16px',
                fontSize: 14,
                textDecoration: 'none',
                color: '#6b7280',
              }}
            >
              <span style={{ fontSize: 16 }}>&#8592;</span>
              <span>Kembali</span>
            </Link>
          </div>
        </nav>
      </aside>

      {/* Main content */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Top bar with credit */}
        <header
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '10px 24px',
            borderBottom: '1px solid #e5e7eb',
            backgroundColor: '#fff',
            flexShrink: 0,
          }}
        >
          <div style={{ fontSize: 16, fontWeight: 600, color: '#111827' }}>
            {project.title}
            <span style={{ fontSize: 12, color: '#9ca3af', marginLeft: 8, fontWeight: 400 }}>
              {project.foundationStatus === 'locked'
                ? 'Fondasi terkunci'
                : project.foundationStatus === 'draft'
                  ? 'Fondasi draft'
                  : 'Fondasi kosong'}
            </span>
          </div>

          {credit && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, fontSize: 13 }}>
              <span style={{ color: '#059669' }}>
                Tersedia: {formatCredit(credit.availableCredit)}
              </span>
              {BigInt(credit.heldBalance) > 0n && (
                <span style={{ color: '#d97706' }}>
                  Tertahan: {formatCredit(credit.heldBalance)}
                </span>
              )}
            </div>
          )}

          <Link
            href="/dashboard"
            style={{
              fontSize: 13,
              color: '#6b7280',
              textDecoration: 'none',
              padding: '4px 12px',
              borderRadius: 4,
              border: '1px solid #e5e7eb',
            }}
          >
            Dashboard
          </Link>
        </header>

        <main style={{ flex: 1, overflow: 'auto', padding: 24 }}>
          {children}
        </main>
      </div>
    </div>
  );
}
