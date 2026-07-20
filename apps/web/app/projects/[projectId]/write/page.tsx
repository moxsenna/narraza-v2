import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getSessionUser } from '../../../lib/get-session-user';

const PHASE_LABELS: Record<string, string> = {
  queued: 'Antrian',
  running: 'Menulis',
  succeeded: 'Selesai',
  failed: 'Gagal',
  cancelled: 'Dibatalkan',
  dead: 'Gagal',
};

function severityColor(sev: string): string {
  if (sev === 'blocker') return '#b91c1c';
  if (sev === 'warning') return '#b45309';
  return '#374151';
}

async function requestBeatWriteAction(formData: FormData): Promise<void> {
  'use server';

  const sessionUser = await getSessionUser();
  if (!sessionUser) redirect('/auth/email');

  const projectId = formData.get('projectId') as string;
  const beatId = formData.get('beatId') as string;
  const chapterId = (formData.get('chapterId') as string) || '';
  const beatNumberRaw = formData.get('beatNumber') as string | null;
  if (!beatId && (!chapterId || !beatNumberRaw)) return;

  const { lockOwnedProject, requestBeatWrite } = await import('@narraza/application');
  const { createProjectRepo, createPrismaOperationalUnitOfWork, getPrisma } =
    await import('../../../lib/server/db');
  const { createWebAIExecutionPort } = await import('../../../lib/server/ai');

  const projectRepo = createProjectRepo();
  try {
    await lockOwnedProject(projectRepo, projectId, sessionUser.userId);
  } catch {
    redirect('/dashboard');
  }

  try {
    const prisma = getPrisma();
    let resolvedChapterId = chapterId;
    let resolvedBeatNumber = beatNumberRaw ? parseInt(beatNumberRaw, 10) : NaN;
    let chapterNumber: number | undefined;

    if ((!resolvedChapterId || Number.isNaN(resolvedBeatNumber)) && beatId) {
      const beat = await prisma.beat.findUnique({
        where: { id: beatId },
        include: { chapter: true },
      });
      if (!beat) return;
      resolvedChapterId = beat.chapterId;
      resolvedBeatNumber = beat.beatNumber;
      chapterNumber = beat.chapter.number;
    } else if (resolvedChapterId) {
      const ch = await prisma.chapter.findUnique({ where: { id: resolvedChapterId } });
      chapterNumber = ch?.number;
    }
    if (!resolvedChapterId || Number.isNaN(resolvedBeatNumber)) return;

    const uow = createPrismaOperationalUnitOfWork();
    const aiPort = createWebAIExecutionPort();
    const writeInput: {
      userId: string;
      projectId: string;
      chapterId: string;
      beatNumber: number;
      requestId: string;
      chapterNumber?: number;
      beatId?: string;
    } = {
      userId: sessionUser.userId,
      projectId,
      chapterId: resolvedChapterId,
      beatNumber: resolvedBeatNumber,
      requestId: `web-beat-${Date.now()}`,
    };
    if (typeof chapterNumber === 'number') writeInput.chapterNumber = chapterNumber;
    if (beatId) writeInput.beatId = beatId;
    await requestBeatWrite(uow, aiPort, writeInput);
  } catch {
    // silently handled — UI reloads job list
  }

  redirect(`/projects/${projectId}/write`);
}

async function saveWorkingDraftAction(formData: FormData): Promise<void> {
  'use server';

  const sessionUser = await getSessionUser();
  if (!sessionUser) redirect('/auth/email');

  const projectId = formData.get('projectId') as string;
  const beatId = formData.get('beatId') as string;
  const content = (formData.get('content') as string) ?? '';

  if (!beatId || !content) return;

  const { lockOwnedProject } = await import('@narraza/application');
  const { createProjectRepo, getPrisma } = await import('../../../lib/server/db');

  const projectRepo = createProjectRepo();
  try {
    await lockOwnedProject(projectRepo, projectId, sessionUser.userId);
  } catch {
    redirect('/dashboard');
  }

  const prisma = getPrisma();
  const existing = await prisma.proseWorkingDraft.findFirst({
    where: { userId: sessionUser.userId, beatId, deletedAt: null },
  });

  const { createHash } = await import('node:crypto');
  const contentHash = createHash('sha256').update(content).digest('hex');

  try {
    if (existing) {
      if (existing.contentHash !== contentHash) {
        await prisma.proseWorkingDraft.update({
          where: { id: existing.id },
          data: { content, contentHash, version: { increment: 1 } },
        });
      }
    } else {
      await prisma.proseWorkingDraft.create({
        data: {
          userId: sessionUser.userId,
          beatId,
          content,
          contentHash,
          version: 1,
        },
      });
    }
  } catch {
    // silently handled
  }

  redirect(`/projects/${projectId}/write`);
}

async function submitProseForAcceptAction(formData: FormData): Promise<void> {
  'use server';

  const sessionUser = await getSessionUser();
  if (!sessionUser) redirect('/auth/email');

  const projectId = formData.get('projectId') as string;
  const beatId = formData.get('beatId') as string;
  const proseVersionId = (formData.get('proseVersionId') as string) || '';
  if (!beatId) return;

  const { lockOwnedProject, submitUserProse } = await import('@narraza/application');
  const {
    createProjectRepo,
    createUserRepo,
    createPrismaUnitOfWork,
    getPrisma,
  } = await import('../../../lib/server/db');

  const projectRepo = createProjectRepo();
  try {
    await lockOwnedProject(projectRepo, projectId, sessionUser.userId);
  } catch {
    redirect('/dashboard');
  }

  try {
    const prisma = getPrisma();
    const beat = await prisma.beat.findUnique({
      where: { id: beatId },
      include: { chapter: true },
    });
    if (!beat) return;

    // If submitting a specific AI prose version, copy into working draft first
    if (proseVersionId) {
      const pv = await prisma.proseVersion.findUnique({ where: { id: proseVersionId } });
      if (pv && pv.beatId === beatId) {
        const { createHash } = await import('node:crypto');
        const contentHash = createHash('sha256').update(pv.content).digest('hex');
        const existing = await prisma.proseWorkingDraft.findFirst({
          where: { userId: sessionUser.userId, beatId, deletedAt: null },
        });
        if (existing) {
          await prisma.proseWorkingDraft.update({
            where: { id: existing.id },
            data: { content: pv.content, contentHash, version: { increment: 1 } },
          });
        } else {
          await prisma.proseWorkingDraft.create({
            data: {
              userId: sessionUser.userId,
              beatId,
              content: pv.content,
              contentHash,
              version: 1,
            },
          });
        }
      }
    }

    const report = proseVersionId
      ? await prisma.validationReport.findFirst({
          where: { proseVersionId },
          orderBy: { createdAt: 'desc' },
        })
      : null;
    const findings = Array.isArray(report?.findings)
      ? (report!.findings as Array<Record<string, unknown>>)
      : [];
    const blockers = findings.filter((f) => f.severity === 'blocker');
    if (blockers.length > 0) {
      // Backend accept will also reject — surface by staying on page
      redirect(`/projects/${projectId}/write?error=blockers`);
    }

    const uow = createPrismaUnitOfWork();
    await uow.execute(async (ports: any) => {
      const submitted = await submitUserProse(
        { ...ports, userRepo: createUserRepo() },
        {
          userId: sessionUser.userId,
          projectId,
          beatId,
          chapterId: beat.chapterId,
          chapterNumber: beat.chapter.number,
          validationContext: {
            projectId,
            beatId,
            chapterId: beat.chapterId,
            chapterNumber: beat.chapter.number,
            forbiddenTruths: [],
            validationMode: 'full',
            contextCompleteness: 'complete',
            beatContract: {
              beatGoal: beat.title || 'Beat goal',
              mustInclude: [],
              mustNotInclude: [],
              expectedEndState: 'Beat complete',
              stopCondition: 'End of beat',
            },
            existingCanonTruths: [],
          },
        },
      );

      // Immediately try accept (backend enforces validation)
      const { acceptProposal } = await import('@narraza/application');
      await acceptProposal(
        { ...ports, userRepo: createUserRepo() },
        {
          userId: sessionUser.userId,
          projectId,
          proposalId: submitted.proposalId,
          proseVersionId: submitted.proseVersionId,
        },
      );
    });
  } catch {
    redirect(`/projects/${projectId}/write?error=accept_failed`);
  }

  redirect(`/projects/${projectId}/write?ok=accepted`);
}

async function repairProseAction(formData: FormData): Promise<void> {
  'use server';

  const sessionUser = await getSessionUser();
  if (!sessionUser) redirect('/auth/email');

  const projectId = formData.get('projectId') as string;
  const proseVersionId = formData.get('proseVersionId') as string;
  const beatId = formData.get('beatId') as string;
  if (!proseVersionId || !beatId) return;

  const { lockOwnedProject, createRepairProseVersion } = await import(
    '@narraza/application'
  );
  const {
    createProjectRepo,
    createUserRepo,
    createPrismaUnitOfWork,
    getPrisma,
  } = await import('../../../lib/server/db');

  const projectRepo = createProjectRepo();
  try {
    await lockOwnedProject(projectRepo, projectId, sessionUser.userId);
  } catch {
    redirect('/dashboard');
  }

  try {
    const prisma = getPrisma();
    const beat = await prisma.beat.findUnique({
      where: { id: beatId },
      include: { chapter: true },
    });
    if (!beat) return;

    const report = await prisma.validationReport.findFirst({
      where: { proseVersionId },
      orderBy: { createdAt: 'desc' },
    });
    const findings = Array.isArray(report?.findings)
      ? (report!.findings as Array<Record<string, unknown>>)
      : [];
    const forbiddenPhrases = findings
      .filter((f) => f.severity === 'blocker')
      .map((f) => {
        const msg = String(f.message ?? '');
        // Best-effort extract quoted phrase from message
        const m = msg.match(/["“]([^"”]+)["”]/);
        return m?.[1] ?? '';
      })
      .filter(Boolean);

    const uow = createPrismaUnitOfWork();
    await uow.execute(async (ports: any) => {
      const repaired = await createRepairProseVersion(
        { ...ports, userRepo: createUserRepo() },
        {
          userId: sessionUser.userId,
          projectId,
          originalProseVersionId: proseVersionId,
          forbiddenPhrases:
            forbiddenPhrases.length > 0 ? forbiddenPhrases : ['TODO_FORBIDDEN'],
          context: {
            projectId,
            beatId,
            chapterId: beat.chapterId,
            chapterNumber: beat.chapter.number,
            forbiddenTruths: forbiddenPhrases,
            validationMode: 'full',
            contextCompleteness: 'complete',
            beatContract: {
              beatGoal: beat.title || 'Beat goal',
              mustInclude: [],
              mustNotInclude: forbiddenPhrases,
              expectedEndState: 'Beat complete',
              stopCondition: 'End of beat',
            },
            existingCanonTruths: [],
          },
        },
      );

      // Load repaired into working draft for comparison / accept
      const pv = await ports.proseVersionRepo.findById(repaired.repairProseVersionId);
      if (pv) {
        const existing = await ports.workingDraftRepo.findByUserAndBeat(
          sessionUser.userId,
          beatId,
        );
        if (existing) {
          await ports.workingDraftRepo.save({
            userId: sessionUser.userId,
            beatId,
            content: pv.content,
            contentHash: pv.contentHash,
            expectedVersion: existing.version,
          });
        } else {
          await ports.workingDraftRepo.save({
            userId: sessionUser.userId,
            beatId,
            content: pv.content,
            contentHash: pv.contentHash,
          });
        }
      }
    });
  } catch {
    redirect(`/projects/${projectId}/write?error=repair_failed`);
  }

  redirect(`/projects/${projectId}/write?ok=repaired`);
}

export default async function WritePage({
  params,
  searchParams,
}: {
  params: Promise<{ projectId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sessionUser = await getSessionUser();
  if (!sessionUser) redirect('/auth/email');

  const { projectId } = await params;
  const sp = await searchParams;
  const flashError = typeof sp.error === 'string' ? sp.error : null;
  const flashOk = typeof sp.ok === 'string' ? sp.ok : null;

  const { lockOwnedProject } = await import('@narraza/application');
  const { createProjectRepo } = await import('../../../lib/server/db');
  const { listBeatWriteBundles, listGenerationJobs } = await import(
    '../../../lib/server/project-reads'
  );

  const projectRepo = createProjectRepo();
  try {
    await lockOwnedProject(projectRepo, projectId, sessionUser.userId);
  } catch {
    redirect('/dashboard');
  }

  const project = await projectRepo.findById(projectId);
  if (!project) redirect('/dashboard');
  if (project.foundationStatus !== 'locked') {
    redirect(`/projects/${projectId}/foundation`);
  }

  const bundles = await listBeatWriteBundles(projectId, sessionUser.userId);
  const activeJobs = await listGenerationJobs(projectId, {
    statuses: ['queued', 'running'],
    take: 5,
  });
  const completedJobs = await listGenerationJobs(projectId, {
    statuses: ['succeeded', 'failed', 'dead'],
    take: 5,
  });

  // Group bundles by chapter
  const byChapter = new Map<
    string,
    { chapterId: string; chapterNumber: number; beats: typeof bundles }
  >();
  for (const b of bundles) {
    const key = b.chapterId;
    if (!byChapter.has(key)) {
      byChapter.set(key, {
        chapterId: b.chapterId,
        chapterNumber: b.chapterNumber,
        beats: [],
      });
    }
    byChapter.get(key)!.beats.push(b);
  }
  const chapters = [...byChapter.values()].sort(
    (a, b) => a.chapterNumber - b.chapterNumber,
  );

  return (
    <div style={{ maxWidth: 960, margin: '0 auto' }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 4 }}>
        Adegan (Write Room)
      </h1>
      <p style={{ color: '#6b7280', marginBottom: 16, fontSize: 14 }}>
        Generate draft AI, lihat findings validator, perbaiki, lalu terima prose.
        Model/provider tidak ditampilkan.
      </p>

      {flashError === 'blockers' && (
        <Banner tone="error">
          Accept ditolak: masih ada blocker. Perbaiki dulu (Repair) atau edit draft.
        </Banner>
      )}
      {flashError === 'accept_failed' && (
        <Banner tone="error">
          Accept gagal di backend (validasi/stale). Cek findings di bawah.
        </Banner>
      )}
      {flashError === 'repair_failed' && (
        <Banner tone="error">Repair gagal. Coba lagi atau edit manual.</Banner>
      )}
      {flashOk === 'accepted' && (
        <Banner tone="ok">Prose berhasil diterima ke canon.</Banner>
      )}
      {flashOk === 'repaired' && (
        <Banner tone="ok">
          Versi repair dibuat (versi baru). Bandingkan lalu Accept jika lolos.
        </Banner>
      )}

      {activeJobs.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 8, color: '#374151' }}>
            Sedang Diproses ({activeJobs.length})
          </h2>
          {activeJobs.map((job) => (
            <div
              key={job.id}
              style={{
                border: '1px solid #fbbf24',
                borderRadius: 6,
                padding: '10px 14px',
                marginBottom: 6,
                backgroundColor: '#fffbeb',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <div>
                <span style={{ fontSize: 13, fontWeight: 600, color: '#92400e' }}>
                  {PHASE_LABELS[job.status] ?? job.status}
                </span>
                <span style={{ fontSize: 12, color: '#a16207', marginLeft: 8 }}>
                  {job.jobType}
                </span>
              </div>
              <span style={{ fontSize: 11, color: '#9ca3af' }}>
                {new Date(job.createdAt).toLocaleString('id-ID')}
              </span>
            </div>
          ))}
          <p style={{ fontSize: 12, color: '#6b7280' }}>
            Refresh halaman untuk update status job.
          </p>
        </div>
      )}

      {chapters.length === 0 ? (
        <div
          style={{
            border: '1px dashed #d1d5db',
            borderRadius: 8,
            padding: 32,
            textAlign: 'center',
            color: '#9ca3af',
            fontSize: 14,
          }}
        >
          Belum ada chapter dan beat. Buat outline terlebih dahulu.
          <div style={{ marginTop: 12 }}>
            <Link
              href={`/projects/${projectId}/outline`}
              style={{
                display: 'inline-block',
                padding: '8px 16px',
                backgroundColor: '#0070f3',
                color: '#fff',
                textDecoration: 'none',
                borderRadius: 4,
                fontSize: 13,
              }}
            >
              Buat Outline
            </Link>
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {chapters.map((ch) => (
            <div
              key={ch.chapterId}
              style={{
                border: '1px solid #e5e7eb',
                borderRadius: 8,
                overflow: 'hidden',
                backgroundColor: '#fff',
              }}
            >
              <div
                style={{
                  padding: '10px 16px',
                  backgroundColor: '#f3f4f6',
                  fontWeight: 600,
                  fontSize: 14,
                  color: '#374151',
                }}
              >
                Chapter {ch.chapterNumber}
              </div>

              {ch.beats.map((beat) => {
                const latest = beat.proseVersions[0] ?? null;
                const blockers =
                  latest?.report?.findings.filter((f) => f.severity === 'blocker') ??
                  [];
                const warnings =
                  latest?.report?.findings.filter((f) => f.severity === 'warning') ??
                  [];
                const canAccept =
                  latest &&
                  latest.report &&
                  latest.report.passed &&
                  blockers.length === 0;

                return (
                  <div
                    key={beat.beatId}
                    style={{
                      padding: '12px 16px',
                      borderTop: '1px solid #f3f4f6',
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        marginBottom: 8,
                      }}
                    >
                      <span
                        style={{ fontSize: 13, fontWeight: 600, color: '#111827' }}
                      >
                        Beat {beat.beatNumber}
                        {beat.title ? `: ${beat.title}` : ''}
                      </span>
                      <span style={{ fontSize: 11, color: '#9ca3af' }}>
                        {beat.acceptedProseVersionId
                          ? 'Sudah diterima'
                          : latest
                            ? canAccept
                              ? 'Siap accept'
                              : blockers.length > 0
                                ? 'Blocker — perlu repair'
                                : 'Draft ada'
                            : 'Belum ada draft AI'}
                      </span>
                    </div>
                    {beat.summary ? (
                      <div
                        style={{
                          fontSize: 12,
                          color: '#6b7280',
                          marginBottom: 8,
                        }}
                      >
                        {beat.summary}
                      </div>
                    ) : null}

                    {/* Latest AI / prose version */}
                    {latest && (
                      <div
                        style={{
                          border: '1px solid #e5e7eb',
                          borderRadius: 6,
                          padding: 12,
                          marginBottom: 10,
                          backgroundColor: '#fafafa',
                        }}
                      >
                        <div
                          style={{
                            fontSize: 12,
                            fontWeight: 600,
                            marginBottom: 6,
                            color: '#374151',
                          }}
                        >
                          Draft AI v{latest.version}{' '}
                          <span style={{ fontWeight: 400, color: '#9ca3af' }}>
                            ({latest.status})
                          </span>
                          {latest.report && (
                            <span
                              style={{
                                marginLeft: 8,
                                color: latest.report.passed ? '#059669' : '#b91c1c',
                              }}
                            >
                              · validasi:{' '}
                              {latest.report.passed ? 'lolos' : 'gagal'}
                            </span>
                          )}
                        </div>
                        <pre
                          style={{
                            whiteSpace: 'pre-wrap',
                            fontFamily: 'Georgia, serif',
                            fontSize: 13,
                            lineHeight: 1.55,
                            margin: '0 0 10px',
                            color: '#111827',
                            maxHeight: 220,
                            overflow: 'auto',
                          }}
                        >
                          {latest.content}
                        </pre>

                        {(blockers.length > 0 || warnings.length > 0) && (
                          <div style={{ marginBottom: 10 }}>
                            <div
                              style={{
                                fontSize: 12,
                                fontWeight: 600,
                                marginBottom: 4,
                              }}
                            >
                              Findings
                            </div>
                            <ul
                              style={{
                                margin: 0,
                                paddingLeft: 18,
                                fontSize: 12,
                              }}
                            >
                              {[...blockers, ...warnings].map((f, i) => (
                                <li
                                  key={`${f.code}-${i}`}
                                  style={{
                                    color: severityColor(f.severity),
                                    marginBottom: 2,
                                  }}
                                >
                                  <strong>{f.severity}</strong> · {f.code}
                                  {f.message ? ` — ${f.message}` : ''}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}

                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                          <form action={submitProseForAcceptAction}>
                            <input type="hidden" name="projectId" value={projectId} />
                            <input type="hidden" name="beatId" value={beat.beatId} />
                            <input
                              type="hidden"
                              name="proseVersionId"
                              value={latest.id}
                            />
                            <button
                              type="submit"
                              disabled={!canAccept}
                              style={{
                                padding: '6px 14px',
                                backgroundColor: canAccept ? '#059669' : '#d1d5db',
                                color: '#fff',
                                border: 'none',
                                borderRadius: 4,
                                fontSize: 12,
                                fontWeight: 600,
                                cursor: canAccept ? 'pointer' : 'not-allowed',
                              }}
                              title={
                                canAccept
                                  ? 'Accept ke canon (backend enforce)'
                                  : 'Tidak bisa accept saat ada blocker'
                              }
                            >
                              Accept
                            </button>
                          </form>

                          {blockers.length > 0 && (
                            <form action={repairProseAction}>
                              <input
                                type="hidden"
                                name="projectId"
                                value={projectId}
                              />
                              <input
                                type="hidden"
                                name="beatId"
                                value={beat.beatId}
                              />
                              <input
                                type="hidden"
                                name="proseVersionId"
                                value={latest.id}
                              />
                              <button
                                type="submit"
                                style={{
                                  padding: '6px 14px',
                                  backgroundColor: '#d97706',
                                  color: '#fff',
                                  border: 'none',
                                  borderRadius: 4,
                                  fontSize: 12,
                                  fontWeight: 600,
                                  cursor: 'pointer',
                                }}
                              >
                                Repair (versi baru)
                              </button>
                            </form>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Older versions (collapsed list) */}
                    {beat.proseVersions.length > 1 && (
                      <details style={{ marginBottom: 10, fontSize: 12 }}>
                        <summary style={{ cursor: 'pointer', color: '#6b7280' }}>
                          Versi sebelumnya ({beat.proseVersions.length - 1})
                        </summary>
                        <ul style={{ margin: '8px 0 0', paddingLeft: 18 }}>
                          {beat.proseVersions.slice(1).map((pv) => (
                            <li key={pv.id} style={{ marginBottom: 4 }}>
                              v{pv.version} · {pv.status}
                              {pv.report
                                ? ` · validasi ${pv.report.passed ? 'lolos' : 'gagal'}`
                                : ''}
                              {' · '}
                              {pv.content.slice(0, 80).replace(/\s+/g, ' ')}
                              …
                            </li>
                          ))}
                        </ul>
                      </details>
                    )}

                    <form action={saveWorkingDraftAction} style={{ marginBottom: 8 }}>
                      <input type="hidden" name="projectId" value={projectId} />
                      <input type="hidden" name="beatId" value={beat.beatId} />
                      <textarea
                        name="content"
                        rows={4}
                        defaultValue={beat.workingDraft?.content ?? ''}
                        placeholder="Tulis draft di sini, atau gunakan AI untuk generate..."
                        style={{
                          display: 'block',
                          width: '100%',
                          padding: '8px 10px',
                          fontSize: 13,
                          borderRadius: 4,
                          border: '1px solid #d1d5db',
                          boxSizing: 'border-box',
                          fontFamily: 'monospace',
                          resize: 'vertical',
                          marginBottom: 8,
                        }}
                      />
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        <button
                          type="submit"
                          style={{
                            padding: '6px 12px',
                            backgroundColor: '#6b7280',
                            color: '#fff',
                            border: 'none',
                            borderRadius: 4,
                            fontSize: 12,
                            fontWeight: 600,
                            cursor: 'pointer',
                          }}
                        >
                          Simpan Draft
                        </button>
                      </div>
                    </form>

                    <div style={{ display: 'flex', gap: 8 }}>
                      <form action={requestBeatWriteAction}>
                        <input type="hidden" name="projectId" value={projectId} />
                        <input type="hidden" name="beatId" value={beat.beatId} />
                        <input
                          type="hidden"
                          name="chapterId"
                          value={beat.chapterId}
                        />
                        <input
                          type="hidden"
                          name="beatNumber"
                          value={String(beat.beatNumber)}
                        />
                        <button
                          type="submit"
                          style={{
                            padding: '6px 14px',
                            backgroundColor: '#8b5cf6',
                            color: '#fff',
                            border: 'none',
                            borderRadius: 4,
                            fontSize: 12,
                            fontWeight: 600,
                            cursor: 'pointer',
                          }}
                        >
                          Minta AI Tulis
                        </button>
                      </form>

                      {beat.workingDraft?.content ? (
                        <form action={submitProseForAcceptAction}>
                          <input type="hidden" name="projectId" value={projectId} />
                          <input type="hidden" name="beatId" value={beat.beatId} />
                          <button
                            type="submit"
                            style={{
                              padding: '6px 14px',
                              backgroundColor: '#2563eb',
                              color: '#fff',
                              border: 'none',
                              borderRadius: 4,
                              fontSize: 12,
                              fontWeight: 600,
                              cursor: 'pointer',
                            }}
                          >
                            Submit draft kerja
                          </button>
                        </form>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      )}

      {completedJobs.length > 0 && (
        <div style={{ marginTop: 32 }}>
          <h2
            style={{
              fontSize: 16,
              fontWeight: 600,
              marginBottom: 8,
              color: '#374151',
            }}
          >
            Riwayat Pekerjaan
          </h2>
          {completedJobs.map((job) => (
            <div
              key={job.id}
              style={{
                border: '1px solid #e5e7eb',
                borderRadius: 6,
                padding: '8px 14px',
                marginBottom: 6,
                backgroundColor: '#f9fafb',
                display: 'flex',
                justifyContent: 'space-between',
              }}
            >
              <span
                style={{
                  fontSize: 13,
                  color: job.status === 'succeeded' ? '#059669' : '#dc2626',
                }}
              >
                {PHASE_LABELS[job.status] ?? job.status}
                <span style={{ color: '#9ca3af', marginLeft: 8 }}>
                  {job.jobType}
                </span>
              </span>
              <span style={{ fontSize: 11, color: '#9ca3af' }}>
                {new Date(job.createdAt).toLocaleString('id-ID')}
              </span>
            </div>
          ))}
        </div>
      )}

      <div style={{ marginTop: 24 }}>
        <Link
          href={`/projects/${projectId}/outline`}
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
          &larr; Kembali ke Outline
        </Link>
        <Link
          href={`/projects/${projectId}/proposals`}
          style={{
            display: 'inline-block',
            padding: '8px 16px',
            color: '#0070f3',
            textDecoration: 'none',
            border: '1px solid #0070f3',
            borderRadius: 4,
            fontSize: 14,
            marginLeft: 12,
          }}
        >
          Lihat Usulan AI &rarr;
        </Link>
      </div>
    </div>
  );
}

function Banner({
  tone,
  children,
}: {
  tone: 'error' | 'ok';
  children: React.ReactNode;
}) {
  const bg = tone === 'error' ? '#fef2f2' : '#ecfdf5';
  const border = tone === 'error' ? '#fecaca' : '#a7f3d0';
  const color = tone === 'error' ? '#991b1b' : '#065f46';
  return (
    <div
      style={{
        backgroundColor: bg,
        border: `1px solid ${border}`,
        color,
        borderRadius: 6,
        padding: '10px 14px',
        marginBottom: 16,
        fontSize: 13,
      }}
    >
      {children}
    </div>
  );
}
