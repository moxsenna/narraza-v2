import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getSessionUser } from '../../../lib/get-session-user';
import { lockOwnedProject, upsertCharacter } from '@narraza/application';
import type { UpsertCharacterInput } from '@narraza/application';

async function addCharacterAction(formData: FormData): Promise<void> {
  'use server';

  const sessionUser = await getSessionUser();
  if (!sessionUser) redirect('/auth/email');

  const projectId = formData.get('projectId') as string;
  const name = (formData.get('name') as string)?.trim();

  if (!name || name.length < 1) {
    return;
  }

  const { createProjectRepo } = await import('../../../lib/server/db');
  const projectRepo = createProjectRepo();
  try {
    await lockOwnedProject(projectRepo, projectId, sessionUser.userId);
  } catch {
    redirect('/dashboard');
  }

  try {
    const { createUserRepo, createCharacterRepo, createChangeSetRepo } = await import('../../../lib/server/db');

    await upsertCharacter(
      {
        userRepo: createUserRepo(),
        projectRepo,
        characterRepo: createCharacterRepo(),
        changeSetRepo: createChangeSetRepo(),
      },
      {
        userId: sessionUser.userId,
        projectId,
        name,
      },
    );
  } catch {
    // Silently handle — redirect will show updated list
  }
}

export default async function CharactersPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const sessionUser = await getSessionUser();
  if (!sessionUser) redirect('/auth/email');

  const { projectId } = await params;

  const { createProjectRepo } = await import('../../../lib/server/db');
  const projectRepo = createProjectRepo();
  try {
    await lockOwnedProject(projectRepo, projectId, sessionUser.userId);
  } catch {
    redirect('/dashboard');
  }

  const project = await projectRepo.findById(projectId);
  if (!project) redirect('/dashboard');

  if (project.foundationStatus === 'none') {
    redirect(`/projects/${projectId}/foundation`);
  }

  const { createCharacterRepo } = await import('../../../lib/server/db');
  const characterRepo = createCharacterRepo();
  const characters = await characterRepo.findActiveByProjectId(projectId);

  return (
    <div style={{ maxWidth: 640, margin: '0 auto' }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 4 }}>Karakter</h1>
      <p style={{ color: '#6b7280', marginBottom: 24, fontSize: 14 }}>
        Tambahkan karakter yang muncul dalam cerita. Karakter dapat ditambahkan kapan saja.
      </p>

      {/* Add character form */}
      <form
        action={addCharacterAction}
        style={{
          backgroundColor: '#fff',
          border: '1px solid #e5e7eb',
          borderRadius: 8,
          padding: 16,
          marginBottom: 24,
          display: 'flex',
          gap: 12,
          alignItems: 'flex-end',
        }}
      >
        <input type="hidden" name="projectId" value={projectId} />
        <div style={{ flex: 1 }}>
          <label
            style={{
              display: 'block',
              fontSize: 13,
              fontWeight: 600,
              color: '#374151',
              marginBottom: 4,
            }}
          >
            Nama Karakter
          </label>
          <input
            name="name"
            required
            placeholder="Nama karakter..."
            style={{
              display: 'block',
              width: '100%',
              padding: '8px 10px',
              fontSize: 14,
              borderRadius: 4,
              border: '1px solid #d1d5db',
              boxSizing: 'border-box',
              fontFamily: 'inherit',
            }}
          />
        </div>
        <button
          type="submit"
          style={{
            padding: '9px 18px',
            backgroundColor: '#0070f3',
            color: '#fff',
            border: 'none',
            borderRadius: 4,
            fontSize: 14,
            fontWeight: 600,
            cursor: 'pointer',
            flexShrink: 0,
            whiteSpace: 'nowrap',
          }}
        >
          + Tambah
        </button>
      </form>

      {/* Character list */}
      <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 12, color: '#374151' }}>
        Daftar Karakter ({characters.length})
      </h2>

      {characters.length === 0 ? (
        <div
          style={{
            border: '1px dashed #d1d5db',
            borderRadius: 8,
            padding: 24,
            textAlign: 'center',
            color: '#9ca3af',
            fontSize: 14,
          }}
        >
          Belum ada karakter. Tambahkan karakter pertama!
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {characters.map((char: any) => (
            <div
              key={char.id}
              style={{
                border: '1px solid #e5e7eb',
                borderRadius: 6,
                padding: '12px 16px',
                backgroundColor: '#fff',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <div>
                <span style={{ fontSize: 15, fontWeight: 600, color: '#111827' }}>
                  {char.name}
                </span>
                <span style={{ fontSize: 11, color: '#9ca3af', marginLeft: 8 }}>
                  ID: {char.id.slice(0, 8)}...
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      <div style={{ marginTop: 24 }}>
        <Link
          href={`/projects/${projectId}/foundation`}
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
          &larr; Kembali ke Fondasi
        </Link>
      </div>
    </div>
  );
}
