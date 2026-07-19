import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getSessionUser } from '../../../lib/get-session-user.js';

async function acceptConceptAction(formData: FormData): Promise<void> {
  'use server';

  const sessionUser = await getSessionUser();
  if (!sessionUser) redirect('/auth/email');

  const projectId = formData.get('projectId') as string;
  const altIndex = parseInt(formData.get('altIndex') as string, 10);
  const proposalGroupId = formData.get('proposalGroupId') as string;

  if (!proposalGroupId || isNaN(altIndex) || altIndex < 1) return;

  const { lockOwnedProject, acceptConcept } = await import('@narraza/application');
  const { createProjectRepo } = await import('@narraza/db/repositories/project-repo.js');
  const { createPrismaUnitOfWork } = await import('@narraza/db/unit-of-work.js');
  const { getPrisma } = await import('@narraza/db/client.js');

  const projectRepo = createProjectRepo();
  try {
    await lockOwnedProject(projectRepo, projectId, sessionUser.userId);
  } catch {
    redirect('/dashboard');
  }

  try {
    const uow = createPrismaUnitOfWork(getPrisma());
    await uow.execute(async (ports: any) => {
      return acceptConcept(ports, { userId: sessionUser.userId, projectId, altIndex, proposalGroupId });
    });
  } catch {
    // silently handled
  }
}

async function mockSelectConceptAction(formData: FormData): Promise<void> {
  'use server';

  const sessionUser = await getSessionUser();
  if (!sessionUser) redirect('/auth/email');

  const projectId = formData.get('projectId') as string;
  const premise = formData.get('premise') as string;
  const genre = formData.get('genre') as string;
  const tone = formData.get('tone') as string;

  const { lockOwnedProject, editFoundation } = await import('@narraza/application');
  const { createProjectRepo } = await import('@narraza/db/repositories/project-repo.js');
  const { createUserRepo } = await import('@narraza/db/repositories/user-repo.js');
  const { createFoundationRepo } = await import('@narraza/db/repositories/foundation-repo.js');
  const { createChangeSetRepo } = await import('@narraza/db/repositories/change-set-repo.js');

  const projectRepo = createProjectRepo();
  try {
    await lockOwnedProject(projectRepo, projectId, sessionUser.userId);
  } catch {
    redirect('/dashboard');
  }

  try {
    await editFoundation(
      {
        userRepo: createUserRepo(),
        projectRepo,
        foundationRepo: createFoundationRepo(),
        changeSetRepo: createChangeSetRepo(),
      },
      { userId: sessionUser.userId, projectId, premise, tone, genre, body: {} },
    );
  } catch {
    // silently handled
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

  const prisma = getPrisma();

  const proposalGroups = await prisma.proposalGroup.findMany({
    where: { projectId },
    include: {
      proposals: {
        where: { status: 'pending' },
        orderBy: { createdAt: 'asc' },
      },
    },
    orderBy: { createdAt: 'desc' },
    take: 10,
  });

  const mockAlternatives = [
    {
      index: 1,
      title: 'Detektif Jakarta 2045',
      premise:
        'Seorang detektif swasta di Jakarta tahun 2045 menemukan konspirasi AI yang mengendalikan kota. Dia harus memilih antara mengungkap kebenaran atau melindungi keluarganya.',
      genre: 'Cyberpunk / Thriller',
      tone: 'Tegang dan Misterius',
    },
    {
      index: 2,
      title: 'Bayangan Digital',
      premise:
        'Ketika sistem AI kota mulai menunjukkan kesadaran, seorang programmer muda menjadi satu-satunya yang bisa berkomunikasi dengannya. Bersama, mereka mengungkap korupsi di balik sistem.',
      genre: 'Science Fiction / Drama',
      tone: 'Reflektif dan Menegangkan',
    },
    {
      index: 3,
      title: 'Kota Tanpa Nama',
      premise:
        'Di masa depan di mana identitas digital menggantikan identitas fisik, seorang hacker menemukan bahwa ingatannya sendiri telah dimanipulasi oleh AI pemerintah.',
      genre: 'Thriller Psikologis',
      tone: 'Gelap dan Introspektif',
    },
  ];

  return (
    <div style={{ maxWidth: 800, margin: '0 auto' }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 4 }}>Pilih Konsep Cerita</h1>
      <p style={{ color: '#6b7280', marginBottom: 24, fontSize: 14 }}>
        AI telah menghasilkan beberapa alternatif konsep berdasarkan ide cerita kamu. Pilih satu
        untuk melanjutkan ke tahap fondasi.
      </p>

      {proposalGroups.length > 0 ? (
        proposalGroups.map((group: any) => (
          <div key={group.id} style={{ marginBottom: 32 }}>
            <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 12, color: '#374151' }}>
              Alternatif Konsep
            </h2>
            {group.proposals.map((proposal: any, idx: number) => (
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
                <div style={{ fontSize: 14, color: '#374151', whiteSpace: 'pre-wrap' }}>
                  <p><strong>Premis:</strong> Alternatif konsep #{idx + 1} dari AI</p>
                </div>
                <button
                  type="submit"
                  style={{
                    marginTop: 12, padding: '8px 16px', backgroundColor: '#0070f3', color: '#fff',
                    border: 'none', borderRadius: 4, fontSize: 13, fontWeight: 600, cursor: 'pointer',
                  }}
                >
                  Pilih Konsep Ini
                </button>
              </form>
            ))}
          </div>
        ))
      ) : (
        <div>
          <p style={{ fontSize: 13, color: '#d97706', marginBottom: 16 }}>
            Belum ada proposal konsep dari AI. Jalankan intake terlebih dahulu, atau pilih dari
            mock alternatif di bawah untuk pengujian.
          </p>

          {mockAlternatives.map((alt) => (
            <form
              key={alt.index}
              action={mockSelectConceptAction}
              style={{
                border: '1px solid #e5e7eb',
                borderRadius: 8,
                padding: 16, marginBottom: 12, backgroundColor: '#fff',
              }}
            >
              <input type="hidden" name="projectId" value={projectId} />
              <input type="hidden" name="premise" value={alt.premise} />
              <input type="hidden" name="genre" value={alt.genre} />
              <input type="hidden" name="tone" value={alt.tone} />

              <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 4 }}>
                Alternatif #{alt.index} (Mock)
              </div>
              <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 6, color: '#111827' }}>
                {alt.title}
              </h3>
              <p style={{ fontSize: 13, color: '#4b5563', marginBottom: 6 }}>{alt.premise}</p>
              <div style={{ display: 'flex', gap: 12, fontSize: 12, color: '#6b7280' }}>
                <span>Genre: {alt.genre}</span>
                <span>Nada: {alt.tone}</span>
              </div>
              <button
                type="submit"
                style={{
                  marginTop: 12, padding: '8px 16px', backgroundColor: '#0070f3', color: '#fff',
                  border: 'none', borderRadius: 4, fontSize: 13, fontWeight: 600, cursor: 'pointer',
                }}
              >
                Pilih Konsep Ini
              </button>
            </form>
          ))}
        </div>
      )}

      <div style={{ marginTop: 24 }}>
        <Link
          href={`/projects/${projectId}/intake`}
          style={{
            display: 'inline-block', padding: '8px 16px', color: '#6b7280',
            textDecoration: 'none', border: '1px solid #d1d5db', borderRadius: 4, fontSize: 14,
          }}
        >
          &larr; Kembali ke Intake
        </Link>
      </div>
    </div>
  );
}
