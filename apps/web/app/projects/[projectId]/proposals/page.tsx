import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getSessionUser } from '../../../lib/get-session-user';

async function acceptProposalAction(formData: FormData): Promise<void> {
  'use server';

  const sessionUser = await getSessionUser();
  if (!sessionUser) redirect('/auth/email');

  const projectId = formData.get('projectId') as string;
  const proposalId = formData.get('proposalId') as string;
  if (!proposalId) return;

  const { lockOwnedProject, acceptProposal } = await import('@narraza/application');
  const { createProjectRepo, createUserRepo, createPrismaUnitOfWork, getPrisma } = await import('../../../lib/server/db');

  const projectRepo = createProjectRepo();
  try {
    await lockOwnedProject(projectRepo, projectId, sessionUser.userId);
  } catch {
    redirect('/dashboard');
  }

  try {
    const uow = createPrismaUnitOfWork(getPrisma());
    await uow.execute(async (ports: any) => {
      return acceptProposal(
        { ...ports, userRepo: createUserRepo() },
        { userId: sessionUser.userId, projectId, proposalId },
      );
    });
  } catch {
    // silently handled
  }
}

async function rejectProposalAction(formData: FormData): Promise<void> {
  'use server';

  const sessionUser = await getSessionUser();
  if (!sessionUser) redirect('/auth/email');

  const projectId = formData.get('projectId') as string;
  const proposalId = formData.get('proposalId') as string;
  if (!proposalId) return;

  const { lockOwnedProject } = await import('@narraza/application');
  const { createProjectRepo, getPrisma } = await import('../../../lib/server/db');

  const projectRepo = createProjectRepo();
  try {
    await lockOwnedProject(projectRepo, projectId, sessionUser.userId);
  } catch {
    redirect('/dashboard');
  }

  try {
    const prisma = getPrisma();
    await prisma.proposal.update({
      where: { id: proposalId, status: 'pending' },
      data: { status: 'rejected' },
    });
  } catch {
    // silently handled
  }
}

export default async function ProposalsPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const sessionUser = await getSessionUser();
  if (!sessionUser) redirect('/auth/email');

  const { projectId } = await params;

  const { lockOwnedProject } = await import('@narraza/application');
  const { createProjectRepo, getPrisma } = await import('../../../lib/server/db');

  const projectRepo = createProjectRepo();
  try {
    await lockOwnedProject(projectRepo, projectId, sessionUser.userId);
  } catch {
    redirect('/dashboard');
  }

  const project = await projectRepo.findById(projectId);
  if (!project) redirect('/dashboard');

  const prisma = getPrisma();

  const proposals = await prisma.proposal.findMany({
    where: { proposalGroup: { projectId } },
    include: { proposalGroup: true },
    orderBy: { createdAt: 'desc' },
    take: 20,
  });

  // Build simple public views - NO raw ops, NO service_restricted
  const publicViews = proposals.map((p: any) => ({
    id: p.id,
    groupId: p.proposalGroupId,
    source: p.source as string,
    status: p.status as string,
    createdAt: p.createdAt.toISOString(),
    summary: `Proposal ${p.source} — status: ${p.status}`,
    availableActions: (() => {
      const actions: string[] = [];
      if (p.status === 'pending') { actions.push('accept'); actions.push('reject'); }
      if (p.status === 'accepted' || p.status === 'rejected') actions.push('view_details');
      return actions;
    })(),
    findings: [] as Array<{ code: string; severity: string; overridable: boolean }>,
  }));

  const PENDING = publicViews.filter((v: any) => v.status === 'pending');
  const DONE = publicViews.filter((v: any) => v.status !== 'pending');

  return (
    <div style={{ maxWidth: 800, margin: '0 auto' }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 4 }}>Usulan AI (Proposals)</h1>
      <p style={{ color: '#6b7280', marginBottom: 24, fontSize: 14 }}>
        Tinjau dan terima/tolak usulan dari AI. Hanya data publik yang ditampilkan -- tidak ada data internal atau rahasia yang bocor ke klien.
      </p>

      {PENDING.length > 0 && (
        <div style={{ marginBottom: 32 }}>
          <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 12, color: '#374151' }}>
            Menunggu Review ({PENDING.length})
          </h2>
          {PENDING.map((pv: any) => (
            <div
              key={pv.id}
              style={{
                border: '1px solid #e5e7eb', borderRadius: 8,
                padding: 16, marginBottom: 12, backgroundColor: '#fff',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <div>
                  <span style={{
                    display: 'inline-block', padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 600,
                    backgroundColor: pv.source === 'ai' ? '#dbeafe' : '#f3f4f6',
                    color: pv.source === 'ai' ? '#1e40af' : '#374151', marginRight: 8,
                  }}>
                    {pv.source === 'ai' ? 'AI' : pv.source === 'user' ? 'User' : 'System'}
                  </span>
                  <span style={{ fontSize: 13, color: '#374151' }}>{pv.summary}</span>
                </div>
                <span style={{ fontSize: 11, color: '#9ca3af' }}>
                  {new Date(pv.createdAt).toLocaleString('id-ID')}
                </span>
              </div>

              <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                {pv.availableActions.includes('accept') && (
                  <form action={acceptProposalAction}>
                    <input type="hidden" name="projectId" value={projectId} />
                    <input type="hidden" name="proposalId" value={pv.id} />
                    <button
                      type="submit"
                      style={{
                        padding: '6px 14px', backgroundColor: '#059669', color: '#fff',
                        border: 'none', borderRadius: 4, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                      }}
                    >
                      Terima
                    </button>
                  </form>
                )}
                {pv.availableActions.includes('reject') && (
                  <form action={rejectProposalAction}>
                    <input type="hidden" name="projectId" value={projectId} />
                    <input type="hidden" name="proposalId" value={pv.id} />
                    <button
                      type="submit"
                      style={{
                        padding: '6px 14px', backgroundColor: '#fff', color: '#dc2626',
                        border: '1px solid #dc2626', borderRadius: 4, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                      }}
                    >
                      Tolak
                    </button>
                  </form>
                )}
                {pv.availableActions.includes('view_details') && (
                  <span style={{ fontSize: 12, color: '#9ca3af', padding: '6px 0' }}>
                    Sudah diproses
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {DONE.length > 0 && (
        <div style={{ marginBottom: 32 }}>
          <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 12, color: '#374151' }}>
            Sudah Diproses ({DONE.length})
          </h2>
          {DONE.map((pv: any) => (
            <div
              key={pv.id}
              style={{
                border: '1px solid #e5e7eb', borderRadius: 8,
                padding: 12, marginBottom: 8, backgroundColor: '#f9fafb', opacity: 0.7,
              }}
            >
              <span style={{ fontSize: 12, color: pv.status === 'accepted' ? '#059669' : '#dc2626' }}>
                {pv.status === 'accepted' ? 'Diterima' : 'Ditolak'}
              </span>
              <span style={{ fontSize: 12, color: '#6b7280', marginLeft: 8 }}>{pv.summary}</span>
            </div>
          ))}
        </div>
      )}

      {publicViews.length === 0 && (
        <div
          style={{
            border: '1px dashed #d1d5db', borderRadius: 8, padding: 32,
            textAlign: 'center', color: '#9ca3af', fontSize: 14,
          }}
        >
          Belum ada usulan AI. Jalankan penulisan beat untuk menghasilkan proposal.
        </div>
      )}

      <div style={{ marginTop: 24 }}>
        <Link
          href={`/projects/${projectId}/write`}
          style={{
            display: 'inline-block', padding: '8px 16px', color: '#6b7280',
            textDecoration: 'none', border: '1px solid #d1d5db', borderRadius: 4, fontSize: 14,
          }}
        >
          &larr; Kembali ke Write Room
        </Link>
      </div>
    </div>
  );
}
