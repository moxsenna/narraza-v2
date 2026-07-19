import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getSessionUser } from '../../../lib/get-session-user.js';

async function generateOutlineAction(formData: FormData): Promise<void> {
  'use server';

  const sessionUser = await getSessionUser();
  if (!sessionUser) redirect('/auth/email');

  const projectId = formData.get('projectId') as string;

  const { lockOwnedProject, requestOutlineGenerate } = await import('@narraza/application');
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

  const { lockOwnedProject, acceptOutlineBatch } = await import('@narraza/application');
  const { createProjectRepo } = await import('@narraza/db/repositories/project-repo.js');
  const { createPrismaUnitOfWork } = await import('@narraza/db/unit-of-work.js');
  const { getPrisma } = await import('@narraza/db/client.js');

  const projectRepo = createProjectRepo();
  try {
    await lockOwnedProject(projectRepo, projectId, sessionUser.userId);
  } catch {
    redirect('/dashboard');
  }

  const chapters = [
    {
      chapterNumber: 1, title: 'Awal Mula', summary: 'Detektif menerima kasus pertama di Jakarta 2045.',
      beats: [
        { beatNumber: 1, title: 'Panggilan Tengah Malam', summary: 'Telepon misterius membangunkan detektif.' },
        { beatNumber: 2, title: 'TKP Pertama', summary: 'Detektif tiba di lokasi kejadian.' },
      ],
    },
    {
      chapterNumber: 2, title: 'Bayangan Kota', summary: 'Detektif mulai menyelidiki konspirasi AI.',
      beats: [
        { beatNumber: 1, title: 'Jejak Digital', summary: 'Detektif menemukan anomali di sistem kota.' },
        { beatNumber: 2, title: 'Saksi Kunci', summary: 'Seorang programmer memberikan petunjuk penting.' },
      ],
    },
  ];

  try {
    const uow = createPrismaUnitOfWork(getPrisma());
    await uow.execute(async (ports: any) => {
      return acceptOutlineBatch(ports, { userId: sessionUser.userId, projectId, chapters });
    });
  } catch {
    // silently handled
  }
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
    orderBy: { chapterNumber: 'asc' },
  });

  const activeJobs = await prisma.generationJob.findMany({
    where: { projectId, status: { in: ['queued', 'running'] } },
    orderBy: { createdAt: 'desc' },
    take: 3,
  });

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
        <form
          action={acceptOutlineAction}
          style={{
            backgroundColor: '#fff', border: '1px solid #e5e7eb',
            borderRadius: 8, padding: 16, marginTop: 16,
          }}
        >
          <input type="hidden" name="projectId" value={projectId} />
          <p style={{ fontSize: 14, color: '#374151', marginBottom: 12 }}>
            Terima outline mock untuk pengujian (2 chapters, 4 beats).
          </p>
          <button
            type="submit"
            style={{
              padding: '8px 16px', backgroundColor: '#059669', color: '#fff',
              border: 'none', borderRadius: 4, fontSize: 13, fontWeight: 600, cursor: 'pointer',
            }}
          >
            Terima Outline Mock
          </button>
        </form>
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
