import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getSessionUser } from '../../../lib/get-session-user';

const PHASE_LABELS: Record<string, string> = {
  queued: 'Antrian', running: 'Menulis', succeeded: 'Selesai',
  failed: 'Gagal', cancelled: 'Dibatalkan', dead: 'Gagal',
};

async function requestBeatWriteAction(formData: FormData): Promise<void> {
  'use server';

  const sessionUser = await getSessionUser();
  if (!sessionUser) redirect('/auth/email');

  const projectId = formData.get('projectId') as string;
  const beatId = formData.get('beatId') as string;
  if (!beatId) return;

  const { lockOwnedProject, requestBeatWrite } = await import('@narraza/application');
  const { createProjectRepo } = await import('@narraza/db/repositories/project-repo.js');
  const { createPrismaOperationalUnitOfWork } = await import('@narraza/db/unit-of-work.js');
  const { getPrisma } = await import('@narraza/db/client.js');
  const { createMockAIExecutionPort } = await import('@narraza/ai');

  const projectRepo = createProjectRepo();
  try {
    await lockOwnedProject(projectRepo, projectId, sessionUser.userId);
  } catch {
    redirect('/dashboard');
  }

  try {
    const uow = createPrismaOperationalUnitOfWork(getPrisma());
    const aiPort = createMockAIExecutionPort();
    await requestBeatWrite(uow, aiPort, {
      userId: sessionUser.userId, projectId, beatId, requestId: `web-beat-${Date.now()}`,
    });
  } catch {
    // silently handled
  }
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
  const { createProjectRepo } = await import('@narraza/db/repositories/project-repo.js');
  const { getPrisma } = await import('@narraza/db/client.js');

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
        data: { userId: sessionUser.userId, beatId, content, contentHash, version: 1 },
      });
    }
  } catch {
    // silently handled
  }
}

export default async function WritePage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const sessionUser = await getSessionUser();
  if (!sessionUser) redirect('/auth/email');

  const { projectId } = await params;

  const { lockOwnedProject } = await import('@narraza/application');
  const { createProjectRepo } = await import('@narraza/db/repositories/project-repo.js');
  const { getPrisma } = await import('@narraza/db/client.js');

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

  const prisma = getPrisma();

  const chapters = await prisma.chapterOutline.findMany({
    where: { projectId },
    include: { beats: { orderBy: { beatNumber: 'asc' } } },
    orderBy: { chapterNumber: 'asc' },
  });

  const activeJobs = await prisma.generationJob.findMany({
    where: { projectId, status: { in: ['queued', 'running'] } },
    orderBy: { createdAt: 'desc' }, take: 5,
  });

  const completedJobs = await prisma.generationJob.findMany({
    where: { projectId, status: { in: ['succeeded', 'failed', 'dead'] } },
    orderBy: { createdAt: 'desc' }, take: 5,
  });

  return (
    <div style={{ maxWidth: 900, margin: '0 auto' }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 4 }}>Adegan (Write Room)</h1>
      <p style={{ color: '#6b7280', marginBottom: 24, fontSize: 14 }}>
        Tulis dan perbaiki adegan (beat) per chapter. Gunakan AI untuk menghasilkan draft dan melanjutkan dari draft kerja kamu.
      </p>

      {activeJobs.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 8, color: '#374151' }}>
            Sedang Diproses ({activeJobs.length})
          </h2>
          {activeJobs.map((job: any) => (
            <div
              key={job.id}
              style={{
                border: '1px solid #fbbf24', borderRadius: 6, padding: '10px 14px',
                marginBottom: 6, backgroundColor: '#fffbeb',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              }}
            >
              <div>
                <span style={{ fontSize: 13, fontWeight: 600, color: '#92400e' }}>
                  {PHASE_LABELS[job.status] ?? job.status}
                </span>
              </div>
              <span style={{ fontSize: 11, color: '#9ca3af' }}>
                {new Date(job.createdAt).toLocaleString('id-ID')}
              </span>
            </div>
          ))}
        </div>
      )}

      {chapters.length === 0 ? (
        <div
          style={{
            border: '1px dashed #d1d5db', borderRadius: 8, padding: 32,
            textAlign: 'center', color: '#9ca3af', fontSize: 14,
          }}
        >
          Belum ada chapter dan beat. Buat outline terlebih dahulu.
          <div style={{ marginTop: 12 }}>
            <Link
              href={`/projects/${projectId}/outline`}
              style={{
                display: 'inline-block', padding: '8px 16px',
                backgroundColor: '#0070f3', color: '#fff',
                textDecoration: 'none', borderRadius: 4, fontSize: 13,
              }}
            >
              Buat Outline
            </Link>
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {chapters.map((ch: any) => (
            <div
              key={ch.id}
              style={{
                border: '1px solid #e5e7eb', borderRadius: 8, overflow: 'hidden', backgroundColor: '#fff',
              }}
            >
              <div
                style={{
                  padding: '10px 16px', backgroundColor: '#f3f4f6',
                  fontWeight: 600, fontSize: 14, color: '#374151',
                }}
              >
                Chapter {ch.chapterNumber}: {ch.title}
              </div>

              {ch.beats.map((beat: any) => (
                <div key={beat.id} style={{ padding: '12px 16px', borderTop: '1px solid #f3f4f6' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: '#111827' }}>
                      Beat {beat.beatNumber}: {beat.title ?? ''}
                    </span>
                    <span style={{ fontSize: 11, color: '#9ca3af' }}>
                      {beat.acceptedProseVersionId ? 'Sudah diterima' : 'Belum ditulis'}
                    </span>
                  </div>
                  <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 8 }}>{beat.summary ?? ''}</div>

                  <form action={saveWorkingDraftAction} style={{ marginBottom: 8 }}>
                    <input type="hidden" name="projectId" value={projectId} />
                    <input type="hidden" name="beatId" value={beat.id} />
                    <textarea
                      name="content"
                      rows={4}
                      placeholder="Tulis draft di sini, atau gunakan AI untuk generate..."
                      style={{
                        display: 'block', width: '100%', padding: '8px 10px', fontSize: 13,
                        borderRadius: 4, border: '1px solid #d1d5db', boxSizing: 'border-box',
                        fontFamily: 'monospace', resize: 'vertical', marginBottom: 8,
                      }}
                    />
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button
                        type="submit"
                        style={{
                          padding: '6px 12px', backgroundColor: '#6b7280', color: '#fff',
                          border: 'none', borderRadius: 4, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                        }}
                      >
                        Simpan Draft
                      </button>
                    </div>
                  </form>

                  <form action={requestBeatWriteAction}>
                    <input type="hidden" name="projectId" value={projectId} />
                    <input type="hidden" name="beatId" value={beat.id} />
                    <button
                      type="submit"
                      style={{
                        padding: '6px 14px', backgroundColor: '#8b5cf6', color: '#fff',
                        border: 'none', borderRadius: 4, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                      }}
                    >
                      Minta AI Tulis
                    </button>
                  </form>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}

      {completedJobs.length > 0 && (
        <div style={{ marginTop: 32 }}>
          <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 8, color: '#374151' }}>
            Riwayat Pekerjaan
          </h2>
          {completedJobs.map((job: any) => (
            <div
              key={job.id}
              style={{
                border: '1px solid #e5e7eb', borderRadius: 6, padding: '8px 14px',
                marginBottom: 6, backgroundColor: '#f9fafb',
                display: 'flex', justifyContent: 'space-between',
              }}
            >
              <span style={{ fontSize: 13, color: job.status === 'succeeded' ? '#059669' : '#dc2626' }}>
                {PHASE_LABELS[job.status] ?? job.status}
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
            display: 'inline-block', padding: '8px 16px', color: '#6b7280',
            textDecoration: 'none', border: '1px solid #d1d5db', borderRadius: 4, fontSize: 14,
          }}
        >
          &larr; Kembali ke Outline
        </Link>
        <Link
          href={`/projects/${projectId}/proposals`}
          style={{
            display: 'inline-block', padding: '8px 16px', color: '#0070f3',
            textDecoration: 'none', border: '1px solid #0070f3', borderRadius: 4,
            fontSize: 14, marginLeft: 12,
          }}
        >
          Lihat Usulan AI &rarr;
        </Link>
      </div>
    </div>
  );
}
