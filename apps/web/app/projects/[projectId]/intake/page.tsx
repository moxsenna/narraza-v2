import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getSessionUser } from '../../../lib/get-session-user';

async function submitIntakeAction(formData: FormData): Promise<void> {
  'use server';

  const sessionUser = await getSessionUser();
  if (!sessionUser) {
    redirect('/auth/email');
  }

  const projectId = formData.get('projectId') as string;
  const userInput = (formData.get('userInput') as string)?.trim();

  if (!userInput || userInput.length < 10) {
    return;
  }

  const { lockOwnedProject, requestIntake } = await import('@narraza/application');
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

    await requestIntake(uow, aiPort, {
      userId: sessionUser.userId,
      projectId,
      userInput,
      requestId: `web-intake-${Date.now()}`,
    });
  } catch {
    // Error silently handled
  }
}

export default async function IntakePage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const sessionUser = await getSessionUser();
  if (!sessionUser) redirect('/auth/email');

  const { projectId } = await params;

  const { lockOwnedProject } = await import('@narraza/application');
  const { createProjectRepo } = await import('../../../lib/server/db');
  const { listGenerationJobs } = await import('../../../lib/server/project-reads');

  const projectRepo = createProjectRepo();
  try {
    await lockOwnedProject(projectRepo, projectId, sessionUser.userId);
  } catch {
    redirect('/dashboard');
  }

  const project = await projectRepo.findById(projectId);
  if (!project) redirect('/dashboard');

  const activeJobs = await listGenerationJobs(projectId, { statuses: ['queued', 'running'], take: 5 });

  const PHASE_LABELS: Record<string, string> = {
    queued: 'Antrian',
    running: 'Sedang Diproses',
    succeeded: 'Selesai',
    failed: 'Gagal',
    cancelled: 'Dibatalkan',
    dead: 'Gagal',
  };

  return (
    <div style={{ maxWidth: 640, margin: '0 auto' }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 8 }}>Ekstrak Cerita (Intake)</h1>
      <p style={{ color: '#6b7280', marginBottom: 24, fontSize: 14 }}>
        Ceritakan ide cerita kamu. AI akan mengekstrak konsep, karakter, dan elemen fondasi
        dari deskripsi yang kamu berikan.
      </p>

      <form
        action={submitIntakeAction}
        style={{
          backgroundColor: '#fff',
          border: '1px solid #e5e7eb',
          borderRadius: 8,
          padding: 24,
          marginBottom: 24,
        }}
      >
        <input type="hidden" name="projectId" value={projectId} />

        <div style={{ marginBottom: 16 }}>
          <label
            htmlFor="userInput"
            style={{ display: 'block', fontSize: 14, fontWeight: 600, marginBottom: 6, color: '#374151' }}
          >
            Ide Cerita
          </label>
          <textarea
            id="userInput"
            name="userInput"
            required
            minLength={10}
            rows={6}
            placeholder="Contoh: Seorang detektif swasta di Jakarta tahun 2045 menemukan bahwa AI yang mengelola kota memiliki rahasia gelap..."
            style={{
              display: 'block',
              width: '100%',
              padding: '10px 12px',
              fontSize: 14,
              borderRadius: 4,
              border: '1px solid #d1d5db',
              resize: 'vertical',
              boxSizing: 'border-box',
              fontFamily: 'inherit',
            }}
          />
        </div>

        <button
          type="submit"
          style={{
            padding: '10px 20px',
            backgroundColor: '#0070f3',
            color: '#fff',
            border: 'none',
            borderRadius: 4,
            fontSize: 14,
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          Mulai Ekstraksi
        </button>
      </form>

      {activeJobs.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 12 }}>Status Pekerjaan</h2>
          {activeJobs.map((job: any) => (
            <div
              key={job.id}
              style={{
                border: '1px solid #e5e7eb',
                borderRadius: 6,
                padding: '10px 14px',
                marginBottom: 8,
                backgroundColor: '#f9fafb',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 13, fontWeight: 600 }}>
                  {PHASE_LABELS[job.status] ?? job.status}
                </span>
                <span style={{ fontSize: 11, color: '#9ca3af' }}>
                  {new Date(job.createdAt).toLocaleString('id-ID')}
                </span>
              </div>
              <div style={{ fontSize: 12, color: '#6b7280', marginTop: 4 }}>
                ID: {job.id.slice(0, 8)}...
              </div>
              {job.status === 'succeeded' && (
                <Link
                  href={`/projects/${projectId}/concepts`}
                  style={{
                    display: 'inline-block',
                    marginTop: 8,
                    fontSize: 13,
                    color: '#0070f3',
                    textDecoration: 'none',
                  }}
                >
                  Lihat Konsep &rarr;
                </Link>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
