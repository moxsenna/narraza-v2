import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getSessionUser } from '../lib/get-session-user.js';
import { listProjects } from '@narraza/application';
import { createProjectRepo } from '@narraza/db/repositories/project-repo.js';

export default async function DashboardPage() {
  const sessionUser = await getSessionUser();
  if (!sessionUser) {
    redirect('/auth/email');
  }

  const projects = await listProjects(
    { projectRepo: createProjectRepo() },
    sessionUser.userId,
  );

  return (
    <div style={{ maxWidth: 800, margin: '40px auto', fontFamily: 'sans-serif' }}>
      <h1>Dashboard</h1>
      <p>Welcome to Narraza!</p>

      <div style={{ marginTop: 24, marginBottom: 24 }}>
        <Link
          href="/start"
          style={{
            display: 'inline-block',
            padding: '10px 20px',
            backgroundColor: '#0070f3',
            color: '#fff',
            textDecoration: 'none',
            borderRadius: 4,
          }}
        >
          Start a new project
        </Link>
      </div>

      <h2>Your Projects</h2>
      {projects.length === 0 ? (
        <p>No projects yet. Start your first one!</p>
      ) : (
        <ul style={{ listStyle: 'none', padding: 0 }}>
          {projects.map((project) => (
	            <li
	              key={project.id}
	              style={{
                border: '1px solid #e0e0e0',
                borderRadius: 4,
                padding: '12px 16px',
                marginBottom: 8,
                transition: 'border-color 0.2s',
              }}
            >
              <Link
                href={`/projects/${project.id}`}
                style={{ textDecoration: 'none', color: 'inherit' }}
              >
                <div style={{ fontWeight: 600 }}>{project.title}</div>
                <div style={{ color: '#666', fontSize: 14, marginTop: 4 }}>
                  {project.startMode === 'guided' ? 'Guided' : 'Advanced'} on{' '}
                  {project.createdAt.toLocaleDateString()}
                </div>
                <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 4 }}>
                  Status: {project.foundationStatus === 'locked' ? 'Fondasi terkunci' : project.foundationStatus === 'draft' ? 'Fondasi draft' : 'Fondasi kosong'}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
