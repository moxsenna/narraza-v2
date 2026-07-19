import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getSessionUser } from '../lib/get-session-user';

async function createProjectAction(formData: FormData) {
  'use server';

  const sessionUser = await getSessionUser();
  if (!sessionUser) {
    redirect('/auth/email');
  }

  const title = (formData.get('title') as string)?.trim();
  const startMode = formData.get('startMode') as string;

  if (!title || (startMode !== 'guided' && startMode !== 'advanced')) {
    redirect('/start');
  }

  const { createProject } = await import('@narraza/application');
  const { createProjectRepo, createUserRepo } = await import(
    '../lib/server/db'
  );

  const requestId = `web-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

  await createProject(
    {
      projectRepo: createProjectRepo(),
      userRepo: createUserRepo(),
    },
    {
      userId: sessionUser.userId,
      title,
      startMode: startMode as 'guided' | 'advanced',
      requestId,
    },
  );

  redirect('/dashboard');
}

export default async function StartPage() {
  const sessionUser = await getSessionUser();
  if (!sessionUser) {
    redirect('/auth/email');
  }

  return (
    <div style={{ maxWidth: 500, margin: '40px auto', fontFamily: 'sans-serif' }}>
      <h1>Create a New Project</h1>

      <form
        action={createProjectAction}
        style={{ marginTop: 24 }}
      >
        <div style={{ marginBottom: 16 }}>
          <label htmlFor="title" style={{ display: 'block', marginBottom: 4 }}>
            Project Title
          </label>
          <input
            id="title"
            name="title"
            type="text"
            required
            placeholder="My awesome story"
            style={{
              display: 'block',
              width: '100%',
              padding: '8px 12px',
              fontSize: 16,
              borderRadius: 4,
              border: '1px solid #ccc',
              boxSizing: 'border-box',
            }}
          />
        </div>

        <fieldset style={{ border: 'none', padding: 0, marginBottom: 16 }}>
          <legend style={{ marginBottom: 8, fontWeight: 500 }}>
            Start Mode
          </legend>
          <label style={{ display: 'block', marginBottom: 8, cursor: 'pointer' }}>
            <input
              type="radio"
              name="startMode"
              value="guided"
              defaultChecked
              style={{ marginRight: 8 }}
            />
            Guided -- walk through worldbuilding, characters, and structure step by step
          </label>
          <label style={{ display: 'block', cursor: 'pointer' }}>
            <input
              type="radio"
              name="startMode"
              value="advanced"
              style={{ marginRight: 8 }}
            />
            Advanced -- jump straight into a full-featured editor
          </label>
        </fieldset>

        <div style={{ display: 'flex', gap: 12 }}>
          <button
            type="submit"
            style={{
              padding: '10px 24px',
              backgroundColor: '#0070f3',
              color: '#fff',
              border: 'none',
              borderRadius: 4,
              fontSize: 16,
              cursor: 'pointer',
            }}
          >
            Create Project
          </button>
          <Link
            href="/dashboard"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              padding: '10px 24px',
              color: '#333',
              textDecoration: 'none',
              borderRadius: 4,
              border: '1px solid #ccc',
              fontSize: 16,
            }}
          >
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}
