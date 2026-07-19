import { redirect } from 'next/navigation';
import { getSessionUser } from '../../lib/get-session-user';
import { lockOwnedProject, computeProjectProgress } from '@narraza/application';
import { createProjectRepo, createFoundationRepo, createCharacterRepo } from '../../lib/server/db';
import {
  countChapterOutlines,
  countBeatsForProject,
  countActiveJobs,
} from '../../lib/server/project-reads';

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

  const foundation = await foundationRepo.findByProjectId(projectId);
  const characters = await characterRepo.findActiveByProjectId(projectId);
  const chapterCount = await countChapterOutlines(projectId);
  const beatCount = await countBeatsForProject(projectId);
  const activeJobCount = await countActiveJobs(projectId);

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
