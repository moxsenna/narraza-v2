import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getSessionUser } from '../../../lib/get-session-user';

async function editFoundationAction(formData: FormData): Promise<void> {
  'use server';

  const sessionUser = await getSessionUser();
  if (!sessionUser) redirect('/auth/email');

  const projectId = formData.get('projectId') as string;
  const premise = (formData.get('premise') as string)?.trim() || null;
  const tone = (formData.get('tone') as string)?.trim() || null;
  const genre = (formData.get('genre') as string)?.trim() || null;
  const targetAudience = (formData.get('targetAudience') as string)?.trim() || null;
  const pov = (formData.get('pov') as string)?.trim() || null;
  const emotionalPromise = (formData.get('emotionalPromise') as string)?.trim() || null;
  const protagonist = (formData.get('protagonist') as string)?.trim() || null;
  const mainConflict = (formData.get('mainConflict') as string)?.trim() || null;
  const canonFactsRaw = (formData.get('canonFacts') as string)?.trim() || '';
  const targetChapterCountRaw = (formData.get('targetChapterCount') as string)?.trim() || '';
  const endingDirection = (formData.get('endingDirection') as string)?.trim() || null;
  const hasTwist = formData.get('hasTwist') === 'true' || formData.get('hasTwist') === 'on';
  const primarySecret = (formData.get('primarySecret') as string)?.trim() || null;
  const secretRevealChapterRaw = (formData.get('secretRevealChapter') as string)?.trim() || '';
  const characterNamingRules = (formData.get('characterNamingRules') as string)?.trim() || null;

  const { lockOwnedProject, editFoundation } = await import('@narraza/application');
  const { createProjectRepo, createUserRepo, createFoundationRepo, createChangeSetRepo } = await import('../../../lib/server/db');

  const projectRepo = createProjectRepo();
  try {
    await lockOwnedProject(projectRepo, projectId, sessionUser.userId);
  } catch {
    redirect('/dashboard');
  }

  const body: Record<string, unknown> = {};
  if (targetAudience) body['targetAudience'] = targetAudience;
  if (pov) body['pov'] = pov;
  if (emotionalPromise) body['emotionalPromise'] = emotionalPromise;
  if (protagonist) body['protagonist'] = protagonist;
  if (mainConflict) body['mainConflict'] = mainConflict;
  if (canonFactsRaw) {
    body['canonFacts'] = canonFactsRaw
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean);
  }
  if (targetChapterCountRaw) body['targetChapterCount'] = Number(targetChapterCountRaw);
  if (endingDirection) body['endingDirection'] = endingDirection;
  body['hasTwist'] = hasTwist;
  if (primarySecret) body['primarySecret'] = primarySecret;
  if (secretRevealChapterRaw) body['secretRevealChapter'] = Number(secretRevealChapterRaw);
  if (characterNamingRules) body['characterNamingRules'] = characterNamingRules;

  try {
    await editFoundation(
      {
        userRepo: createUserRepo(),
        projectRepo,
        foundationRepo: createFoundationRepo(),
        changeSetRepo: createChangeSetRepo(),
      },
      {
        userId: sessionUser.userId,
        projectId,
        premise,
        tone,
        genre,
        body: Object.keys(body).length > 0 ? body : null,
      },
    );
  } catch {
    // silently handled
  }
}

async function lockFoundationAction(formData: FormData): Promise<void> {
  'use server';

  const sessionUser = await getSessionUser();
  if (!sessionUser) redirect('/auth/email');

  const projectId = formData.get('projectId') as string;
  const confirm = formData.get('confirm') === 'true';

  const { lockOwnedProject, lockFoundation } = await import('@narraza/application');
  const { createProjectRepo, createUserRepo, createFoundationRepo } = await import('../../../lib/server/db');

  const projectRepo = createProjectRepo();
  try {
    await lockOwnedProject(projectRepo, projectId, sessionUser.userId);
  } catch {
    redirect('/dashboard');
  }

  try {
    await lockFoundation(
      {
        userRepo: createUserRepo(),
        projectRepo,
        foundationRepo: createFoundationRepo(),
      },
      {
        userId: sessionUser.userId,
        projectId,
        confirm,
      },
    );
  } catch {
    // silently handled
  }
}

export default async function FoundationPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const sessionUser = await getSessionUser();
  if (!sessionUser) redirect('/auth/email');

  const { projectId } = await params;

  const { lockOwnedProject } = await import('@narraza/application');
  const { createProjectRepo, createFoundationRepo } = await import('../../../lib/server/db');

  const projectRepo = createProjectRepo();
  try {
    await lockOwnedProject(projectRepo, projectId, sessionUser.userId);
  } catch {
    redirect('/dashboard');
  }

  const project = await projectRepo.findById(projectId);
  if (!project) redirect('/dashboard');

  const foundationRepo = createFoundationRepo();
  const foundation = await foundationRepo.findByProjectId(projectId);
  const isLocked = project.foundationStatus === 'locked';

  const premise = foundation?.premise ?? '';
  const tone = foundation?.tone ?? '';
  const genre = foundation?.genre ?? '';
  const body = (foundation?.body ?? {}) as Record<string, unknown>;
  const targetAudience = String(body['targetAudience'] ?? '');
  const pov = String(body['pov'] ?? '');
  const emotionalPromise = String(body['emotionalPromise'] ?? '');
  const protagonist = String(body['protagonist'] ?? '');
  const mainConflict = String(body['mainConflict'] ?? '');
  const canonFacts = Array.isArray(body['canonFacts'])
    ? (body['canonFacts'] as string[]).join('\n')
    : String(body['canonFacts'] ?? '');
  const targetChapterCount =
    body['targetChapterCount'] != null ? String(body['targetChapterCount']) : '';
  const endingDirection = String(body['endingDirection'] ?? '');
  const hasTwist = body['hasTwist'] === true || body['hasTwist'] === 'true';
  const primarySecret = String(body['primarySecret'] ?? '');
  const secretRevealChapter =
    body['secretRevealChapter'] != null ? String(body['secretRevealChapter']) : '';
  const characterNamingRules = String(body['characterNamingRules'] ?? '');

  return (
    <div style={{ maxWidth: 720, margin: '0 auto' }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 4 }}>Fondasi Cerita</h1>
      <p style={{ color: '#6b7280', marginBottom: 24, fontSize: 14 }}>
        {isLocked
          ? 'Fondasi sudah dikunci. Tidak dapat diubah.'
          : 'Lengkapi fondasi cerita. Setelah semua field terisi, kunci fondasi untuk melanjutkan.'}
      </p>

      {isLocked && (
        <div
          style={{
            backgroundColor: '#ecfdf5',
            border: '1px solid #86efac',
            borderRadius: 6,
            padding: '12px 16px',
            marginBottom: 20,
            fontSize: 14,
            color: '#065f46',
          }}
        >
          Fondasi Cerita terkunci. Karakter dan outline kini dapat diisi.
        </div>
      )}

      <form
        action={editFoundationAction}
        style={{
          backgroundColor: '#fff',
          border: '1px solid #e5e7eb',
          borderRadius: 8,
          padding: 24,
          marginBottom: 24,
        }}
      >
        <input type="hidden" name="projectId" value={projectId} />

        <div style={{ marginBottom: 12 }}>
          <label style={labelStyle}>
            Premis <span style={{ color: '#ef4444' }}>*</span>
          </label>
          <textarea
            name="premise"
            rows={3}
            defaultValue={premise}
            disabled={isLocked}
            placeholder="Ringkasan cerita dalam 1-3 kalimat..."
            style={inputStyle}
          />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
          <div>
            <label style={labelStyle}>
              Genre <span style={{ color: '#ef4444' }}>*</span>
            </label>
            <input
              name="genre"
              defaultValue={genre}
              disabled={isLocked}
              placeholder="Science Fiction, Fantasy..."
              style={inputStyle}
            />
          </div>
          <div>
            <label style={labelStyle}>
              Nada <span style={{ color: '#ef4444' }}>*</span>
            </label>
            <input
              name="tone"
              defaultValue={tone}
              disabled={isLocked}
              placeholder="Tegang, Humor Gelap..."
              style={inputStyle}
            />
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
          <div>
            <label style={labelStyle}>
              Target Pembaca <span style={{ color: '#ef4444' }}>*</span>
            </label>
            <input
              name="targetAudience"
              defaultValue={targetAudience}
              disabled={isLocked}
              placeholder="Dewasa muda, Umum..."
              style={inputStyle}
            />
          </div>
          <div>
            <label style={labelStyle}>
              Sudut Pandang <span style={{ color: '#ef4444' }}>*</span>
            </label>
            <input
              name="pov"
              defaultValue={pov}
              disabled={isLocked}
              placeholder="Orang pertama, Orang ketiga..."
              style={inputStyle}
            />
          </div>
        </div>

        <div style={{ marginBottom: 12 }}>
          <label style={labelStyle}>
            Janji Emosional <span style={{ color: '#ef4444' }}>*</span>
          </label>
          <input
            name="emotionalPromise"
            defaultValue={emotionalPromise}
            disabled={isLocked}
            placeholder="Harapan setelah pengorbanan..."
            style={inputStyle}
          />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
          <div>
            <label style={labelStyle}>
              Tokoh Utama <span style={{ color: '#ef4444' }}>*</span>
            </label>
            <input
              name="protagonist"
              defaultValue={protagonist}
              disabled={isLocked}
              placeholder="Nama / identitas singkat"
              style={inputStyle}
            />
          </div>
          <div>
            <label style={labelStyle}>
              Konflik Utama <span style={{ color: '#ef4444' }}>*</span>
            </label>
            <input
              name="mainConflict"
              defaultValue={mainConflict}
              disabled={isLocked}
              placeholder="Apa yang dipertaruhkan"
              style={inputStyle}
            />
          </div>
        </div>

        <div style={{ marginBottom: 12 }}>
          <label style={labelStyle}>
            Fakta Canon (min. 3 baris) <span style={{ color: '#ef4444' }}>*</span>
          </label>
          <textarea
            name="canonFacts"
            rows={3}
            defaultValue={canonFacts}
            disabled={isLocked}
            placeholder={'Satu fakta per baris\nContoh: Kota punya pelabuhan\nProtagonis yatim'}
            style={inputStyle}
          />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
          <div>
            <label style={labelStyle}>
              Target Jumlah Bab <span style={{ color: '#ef4444' }}>*</span>
            </label>
            <input
              name="targetChapterCount"
              type="number"
              min={1}
              defaultValue={targetChapterCount}
              disabled={isLocked}
              placeholder="30"
              style={inputStyle}
            />
          </div>
          <div>
            <label style={labelStyle}>
              Arah Ending <span style={{ color: '#ef4444' }}>*</span>
            </label>
            <input
              name="endingDirection"
              defaultValue={endingDirection}
              disabled={isLocked}
              placeholder="Bittersweet victory..."
              style={inputStyle}
            />
          </div>
        </div>

        <div style={{ marginBottom: 12 }}>
          <label style={{ ...labelStyle, display: 'flex', alignItems: 'center', gap: 8 }}>
            <input
              type="checkbox"
              name="hasTwist"
              value="true"
              defaultChecked={hasTwist}
              disabled={isLocked}
            />
            Ada twist / rahasia utama
          </label>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
          <div>
            <label style={labelStyle}>Rahasia Utama</label>
            <input
              name="primarySecret"
              defaultValue={primarySecret}
              disabled={isLocked}
              placeholder="Jika ada twist"
              style={inputStyle}
            />
          </div>
          <div>
            <label style={labelStyle}>Bab Reveal Rahasia</label>
            <input
              name="secretRevealChapter"
              type="number"
              min={1}
              defaultValue={secretRevealChapter}
              disabled={isLocked}
              placeholder="25"
              style={inputStyle}
            />
          </div>
        </div>

        <div style={{ marginBottom: 12 }}>
          <label style={labelStyle}>Aturan Panggilan Karakter</label>
          <input
            name="characterNamingRules"
            defaultValue={characterNamingRules}
            disabled={isLocked}
            placeholder="Gelar hanya untuk bangsawan..."
            style={inputStyle}
          />
        </div>

        <button
          type="submit"
          disabled={isLocked}
          style={{
            padding: '10px 20px',
            backgroundColor: isLocked ? '#d1d5db' : '#0070f3',
            color: '#fff',
            border: 'none',
            borderRadius: 4,
            fontSize: 14,
            fontWeight: 600,
            cursor: isLocked ? 'not-allowed' : 'pointer',
          }}
        >
          Simpan Fondasi
        </button>
      </form>

      {!isLocked && (
        <div
          style={{
            backgroundColor: '#fff',
            border: '1px solid #fbbf24',
            borderRadius: 8,
            padding: 24,
          }}
        >
          <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 8, color: '#92400e' }}>
            Kunci Fondasi
          </h2>
          <p style={{ fontSize: 13, color: '#6b7280', marginBottom: 16 }}>
            Setelah dikunci, fondasi tidak dapat diubah. Pastikan semua field di atas sudah benar.
            Premis, genre, nada, target pembaca, dan sudut pandang wajib diisi.
          </p>

          <form action={lockFoundationAction}>
            <input type="hidden" name="projectId" value={projectId} />
            <input type="hidden" name="confirm" value="true" />
            <button
              type="submit"
              style={{
                padding: '10px 24px',
                backgroundColor: '#d97706',
                color: '#fff',
                border: 'none',
                borderRadius: 4,
                fontSize: 14,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Konfirmasi & Kunci Fondasi
            </button>
          </form>

          <p style={{ fontSize: 11, color: '#9ca3af', marginTop: 8 }}>
            Tombol ini mengonfirmasi bahwa kamu yakin ingin mengunci fondasi.
          </p>
        </div>
      )}

      <div style={{ marginTop: 24 }}>
        <Link
          href={`/projects/${projectId}/concepts`}
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
          &larr; Kembali ke Konsep
        </Link>
      </div>
    </div>
  );
}

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: 13,
  fontWeight: 600,
  color: '#374151',
  marginBottom: 4,
};

const inputStyle: React.CSSProperties = {
  display: 'block',
  width: '100%',
  padding: '8px 10px',
  fontSize: 14,
  borderRadius: 4,
  border: '1px solid #d1d5db',
  boxSizing: 'border-box',
  fontFamily: 'inherit',
};
