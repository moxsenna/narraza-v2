import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getSessionUser } from '../../../lib/get-session-user';

async function generateOutlineAction(formData: FormData): Promise<void> {
  'use server';

  const sessionUser = await getSessionUser();
  if (!sessionUser) redirect('/auth/email');

  const projectId = formData.get('projectId') as string;

  const { lockOwnedProject, requestOutlineGenerate } = await import('@narraza/application');
  const { createProjectRepo, createPrismaOperationalUnitOfWork } = await import('../../../lib/server/db');
  const { createWebAIExecutionPort } = await import('../../../lib/server/ai');

  const projectRepo = createProjectRepo();
  try {
    await lockOwnedProject(projectRepo, projectId, sessionUser.userId);
  } catch {
    redirect('/dashboard');
  }

  try {
    const uow = createPrismaOperationalUnitOfWork();
    const aiPort = createWebAIExecutionPort();
    await requestOutlineGenerate(uow, aiPort, {
      userId: sessionUser.userId,
      projectId,
      requestId: `web-outline-${Date.now()}`,
    });
  } catch {
    // silently handled
  }
}

async function acceptOutlineAction(formData: FormData): Promise<void> {
  'use server';

  const sessionUser = await getSessionUser();
  if (!sessionUser) redirect('/auth/email');

  const projectId = formData.get('projectId') as string;
  const chaptersJson = formData.get('chaptersJson') as string;

  if (!chaptersJson) return;

  let chapters: Array<{
    chapterNumber: number;
    title: string;
    summary: string;
    beats: Array<{ beatNumber: number; title: string; summary: string }>;
  }>;
  try {
    chapters = JSON.parse(chaptersJson);
  } catch {
    return;
  }

  if (!Array.isArray(chapters) || chapters.length === 0) return;

  const { lockOwnedProject, acceptOutlineBatch } = await import('@narraza/application');
  const { createProjectRepo, createPrismaUnitOfWork } = await import('../../../lib/server/db');

  const projectRepo = createProjectRepo();
  try {
    await lockOwnedProject(projectRepo, projectId, sessionUser.userId);
  } catch {
    redirect('/dashboard');
  }

  // chaptersJson must be AI pipeline output (from job result / proposal), never UI invention
  try {
    const uow = createPrismaUnitOfWork();
    await uow.execute(async (ports: any) => {
      return acceptOutlineBatch(ports, {
        userId: sessionUser.userId,
        projectId,
        chapters,
      });
    });
  } catch {
    // handled by redirect UX
  }

  redirect(`/projects/${projectId}/write`);
}

export default async function OutlinePage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const sessionUser = await getSessionUser();
  if (!sessionUser) redirect('/auth/email');

  const { projectId } = await params;

  const { lockOwnedProject } = await import('@narraza/application');
  const { createProjectRepo } = await import('../../../lib/server/db');
  const { listChapterOutlines, listGenerationJobs } = await import('../../../lib/server/project-reads');

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

  const chapters = await listChapterOutlines(projectId);

  const activeJobs = await listGenerationJobs(projectId, { statuses: ['queued', 'running'], take: 3 });

  const PHASE_LABELS: Record<string, string> = {
    queued: 'Antrian', running: 'Menulis', succeeded: 'Selesai',
    failed: 'Gagal', cancelled: 'Dibatalkan', dead: 'Gagal',
  };

  const hasOutline = chapters.length > 0;

  return (
    <div style={{ maxWidth: 720, margin: '0 auto' }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 4 }}>Jadwal Rahasia (Outline)</h1>
      <p style={{ color: '#6b7280', marginBottom: 24, fontSize: 14 }}>
        Atur struktur cerita dengan chapter dan beat. AI akan menghasilkan outline berdasarkan fondasi.
      </p>

      {!hasOutline && (
        <form
          action={generateOutlineAction}
          style={{
            backgroundColor: '#fff', border: '1px solid #e5e7eb',
            borderRadius: 8, padding: 24, marginBottom: 24,
          }}
        >
          <input type="hidden" name="projectId" value={projectId} />
          <p style={{ fontSize: 14, color: '#374151', marginBottom: 16 }}>
            Belum ada outline. AI akan menghasilkan struktur cerita berdasarkan fondasi yang telah dikunci.
          </p>
          <button
            type="submit"
            style={{
              padding: '10px 20px', backgroundColor: '#0070f3', color: '#fff',
              border: 'none', borderRadius: 4, fontSize: 14, fontWeight: 600, cursor: 'pointer',
            }}
          >
            Generate Outline
          </button>
        </form>
      )}

      {activeJobs.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 12, color: '#374151' }}>
            Status Generate
          </h2>
          {activeJobs.map((job: any) => (
            <div
              key={job.id}
              style={{
                border: '1px solid #e5e7eb', borderRadius: 6, padding: '10px 14px',
                marginBottom: 8, backgroundColor: '#f9fafb',
              }}
            >
              <span style={{ fontSize: 13, fontWeight: 600 }}>
                {PHASE_LABELS[job.status] ?? job.status}
              </span>
              <span style={{ fontSize: 11, color: '#9ca3af', marginLeft: 8 }}>
                {new Date(job.createdAt).toLocaleString('id-ID')}
              </span>
            </div>
          ))}
        </div>
      )}

      {hasOutline ? (
        <div>
          <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 12, color: '#374151' }}>
            Outline ({chapters.length} chapters)
          </h2>
          {chapters.map((ch: any) => (
            <div
              key={ch.id}
              style={{
                border: '1px solid #e5e7eb', borderRadius: 6, padding: '12px 16px',
                marginBottom: 8, backgroundColor: '#fff',
              }}
            >
              <div style={{ fontSize: 15, fontWeight: 600, color: '#111827' }}>
                Ch {ch.chapterNumber}: {ch.title}
              </div>
              <div style={{ fontSize: 13, color: '#6b7280', marginTop: 4 }}>{ch.summary}</div>
            </div>
          ))}
        </div>
      ) : (
        <p style={{ fontSize: 13, color: '#6b7280', marginTop: 16 }}>
          Belum ada outline. Klik Generate Outline — job AI (mock provider) lewat pipeline production.
          Setelah job selesai, terima usulan di halaman Usulan AI / refresh halaman ini.
        </p>
      )}

      <div style={{ marginTop: 24 }}>
        <Link
          href={`/projects/${projectId}/characters`}
          style={{
            display: 'inline-block', padding: '8px 16px', color: '#6b7280',
            textDecoration: 'none', border: '1px solid #d1d5db', borderRadius: 4, fontSize: 14,
          }}
        >
          &larr; Kembali ke Karakter
        </Link>
      </div>
    </div>
  );
}
