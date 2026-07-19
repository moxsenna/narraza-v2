import { redirect } from 'next/navigation';
import { getSessionUser } from '../../lib/get-session-user';
import { lockOwnedProject, computeProjectProgress } from '@narraza/application';
import { createProjectRepo } from '@narraza/db/repositories/project-repo.js';
import { createFoundationRepo } from '@narraza/db/repositories/foundation-repo.js';
import { createCharacterRepo } from '@narraza/db/repositories/character-repo.js';
import { getPrisma } from '@narraza/db/client.js';

export default async function ProjectHomePage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const sessionUser = await getSessionUser();
  if (!sessionUser) redirect('/auth/email');

  const { projectId } = await params;

  const projectRepo = createProjectRepo();
  try {
    await lockOwnedProject(projectRepo, projectId, sessionUser.userId);
  } catch {
    redirect('/dashboard');
  }

  const project = await projectRepo.findById(projectId);
  if (!project) redirect('/dashboard');

  const foundationRepo = createFoundationRepo();
  const characterRepo = createCharacterRepo();
  const prisma = getPrisma();

  const foundation = await foundationRepo.findByProjectId(projectId);
  const characters = await characterRepo.findActiveByProjectId(projectId);
  const chapterCount = await prisma.chapterOutline.count({ where: { projectId } });
  const beatCount = await prisma.beat.count({
    where: { chapter: { projectId } },
  });
  const activeJobCount = await prisma.generationJob.count({
    where: { projectId, status: { in: ['queued', 'running'] } },
  });

  const progress = computeProjectProgress({
    hasIntake: foundation !== null,
    foundationStatus: project.foundationStatus,
    hasCharacters: characters.length > 0,
    chapterCount,
    hasAcceptedProse: beatCount > 0,
    hasActiveJob: activeJobCount > 0,
    hasWorkingDraft: false,
  });

  // Redirect to the appropriate phase page
  const phaseRouteMap: Record<string, string> = {
    intake: 'intake',
    concepts: 'concepts',
    foundation: 'foundation',
    characters: 'characters',
    outline: 'outline',
    writing: 'write',
    complete: 'write',
  };

  const route = phaseRouteMap[progress.currentPhase] ?? 'intake';
  redirect(`/projects/${projectId}/${route}`);
}
