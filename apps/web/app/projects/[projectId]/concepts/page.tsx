import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getSessionUser } from '../../../lib/get-session-user';

async function acceptConceptAction(formData: FormData): Promise<void> {
  'use server';

  const sessionUser = await getSessionUser();
  if (!sessionUser) redirect('/auth/email');

  const projectId = formData.get('projectId') as string;
  const altIndex = parseInt(formData.get('altIndex') as string, 10);
  const proposalGroupId = formData.get('proposalGroupId') as string;

  if (!proposalGroupId || isNaN(altIndex) || altIndex < 1) return;

  const { lockOwnedProject, acceptConcept } = await import('@narraza/application');
  const { createProjectRepo, createPrismaUnitOfWork } = await import('../../../lib/server/db');

  const projectRepo = createProjectRepo();
  try {
    await lockOwnedProject(projectRepo, projectId, sessionUser.userId);
  } catch {
    redirect('/dashboard');
  }

  try {
    const uow = createPrismaUnitOfWork();
    await uow.execute(async (ports: any) => {
      return acceptConcept(ports, {
        userId: sessionUser.userId,
        projectId,
        altIndex,
        proposalGroupId,
      });
    });
  } catch {
    // handled by redirect UX
  }

  redirect(`/projects/${projectId}/foundation`);
}

export default async function ConceptsPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const sessionUser = await getSessionUser();
  if (!sessionUser) redirect('/auth/email');

  const { projectId } = await params;

  const { lockOwnedProject } = await import('@narraza/application');
  const { createProjectRepo } = await import('../../../lib/server/db');
  const { listProposalGroupsForProject } = await import('../../../lib/server/project-reads');

  const projectRepo = createProjectRepo();
  try {
    await lockOwnedProject(projectRepo, projectId, sessionUser.userId);
  } catch {
    redirect('/dashboard');
  }

  const project = await projectRepo.findById(projectId);
  if (!project) redirect('/dashboard');

  const proposalGroups = await listProposalGroupsForProject(projectId);

  return (
    <div style={{ maxWidth: 800, margin: '0 auto' }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 4 }}>Pilih Konsep Cerita</h1>
      <p style={{ color: '#6b7280', marginBottom: 24, fontSize: 14 }}>
        AI menghasilkan alternatif konsep melalui pipeline production (mock provider di
        development). Pilih satu untuk menulis fondasi draft — belum terkunci.
      </p>

      {proposalGroups.length > 0 ? (
        proposalGroups.map((group: { id: string; proposals: Array<{ id: string }> }) => (
          <div key={group.id} style={{ marginBottom: 32 }}>
            <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 12, color: '#374151' }}>
              Alternatif Konsep
            </h2>
            {group.proposals.map((proposal, idx: number) => (
              <form
                key={proposal.id}
                action={acceptConceptAction}
                style={{
                  border: '1px solid #e5e7eb',
                  borderRadius: 8,
                  padding: 16,
                  marginBottom: 12,
                  backgroundColor: '#fff',
                }}
              >
                <input type="hidden" name="projectId" value={projectId} />
                <input type="hidden" name="altIndex" value={idx + 1} />
                <input type="hidden" name="proposalGroupId" value={group.id} />

                <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 4 }}>
                  Alternatif #{idx + 1}
                </div>
                <div style={{ fontSize: 14, color: '#374151' }}>
                  <p>
                    <strong>Usulan AI</strong> — pilih untuk membuat fondasi draft
                  </p>
                </div>
                <button
                  type="submit"
                  style={{
                    marginTop: 12,
                    padding: '8px 16px',
                    backgroundColor: '#0070f3',
                    color: '#fff',
                    border: 'none',
                    borderRadius: 4,
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  Pilih Konsep Ini
                </button>
              </form>
            ))}
          </div>
        ))
      ) : (
        <div
          style={{
            backgroundColor: '#fffbeb',
            border: '1px solid #fcd34d',
            borderRadius: 8,
            padding: 16,
          }}
        >
          <p style={{ fontSize: 14, color: '#92400e', marginBottom: 12 }}>
            Belum ada usulan konsep. Jalankan intake dulu — AI mock akan membuat proposal lewat
            pipeline job production yang sama.
          </p>
          <Link
            href={`/projects/${projectId}/intake`}
            style={{
              display: 'inline-block',
              padding: '8px 16px',
              backgroundColor: '#0070f3',
              color: '#fff',
              textDecoration: 'none',
              borderRadius: 4,
              fontSize: 13,
              fontWeight: 600,
            }}
          >
            Ke Intake
          </Link>
        </div>
      )}

      <div style={{ marginTop: 24 }}>
        <Link
          href={`/projects/${projectId}/intake`}
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
          ← Intake
        </Link>
      </div>
    </div>
  );
}
