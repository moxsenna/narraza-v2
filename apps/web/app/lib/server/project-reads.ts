/**
 * Project read models for web shell — no Prisma imports outside composition root.
 */

import { getPrisma } from './db';

export async function countChapterOutlines(projectId: string): Promise<number> {
  const prisma = getPrisma();
  return prisma.chapterOutline.count({ where: { projectId } });
}

export async function countBeatsForProject(projectId: string): Promise<number> {
  const prisma = getPrisma();
  return prisma.beat.count({
    where: { chapter: { projectId } },
  });
}

export async function countActiveJobs(projectId: string): Promise<number> {
  const prisma = getPrisma();
  return prisma.generationJob.count({
    where: { projectId, status: { in: ['queued', 'running'] } },
  });
}

export async function listActiveReservationsForCredit(userId: string): Promise<
  Array<{
    reservedAmount: bigint;
    settledAmount: bigint;
    releasedAmount: bigint;
    openExposureAmount: bigint;
  }>
> {
  const prisma = getPrisma();
  const rows = await prisma.creditReservation.findMany({
    where: { userId, status: { not: 'closed' } },
  });
  return rows.map((r) => ({
    reservedAmount: r.reservedAmount,
    settledAmount: r.settledAmount,
    releasedAmount: r.releasedAmount,
    openExposureAmount: 0n,
  }));
}

export async function findValidSessionUserId(
  sessionToken: string,
): Promise<string | null> {
  const prisma = getPrisma();
  const now = new Date();
  const session = await prisma.session.findFirst({
    where: {
      sessionToken,
      revokedAt: null,
      expiresAt: { gt: now },
    },
  });
  if (!session) return null;

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
  });
  if (!user || user.status !== 'active') return null;
  return user.id;
}

export async function listProposalGroupsForProject(projectId: string) {
  const prisma = getPrisma();
  return prisma.proposalGroup.findMany({
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
}

export async function listChapterOutlines(projectId: string) {
  const prisma = getPrisma();
  return prisma.chapterOutline.findMany({
    where: { projectId },
    orderBy: { chapterNumber: 'asc' },
  });
}

export async function listGenerationJobs(
  projectId: string,
  opts?: { statuses?: string[]; take?: number },
) {
  const prisma = getPrisma();
  return prisma.generationJob.findMany({
    where: {
      projectId,
      ...(opts?.statuses
        ? { status: { in: opts.statuses as never } }
        : {}),
    },
    orderBy: { createdAt: 'desc' },
    take: opts?.take ?? 20,
  });
}

export async function listPendingProposals(projectId: string) {
  const prisma = getPrisma();
  return prisma.proposal.findMany({
    where: {
      status: 'pending',
      proposalGroup: { projectId },
    },
    include: { proposalGroup: true },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });
}

export async function listChaptersWithBeats(projectId: string) {
  const prisma = getPrisma();
  return prisma.chapter.findMany({
    where: { projectId },
    include: {
      beats: { orderBy: { beatNumber: 'asc' } },
    },
    orderBy: { number: 'asc' },
  });
}

export type PublicFindingView = {
  code: string;
  severity: 'blocker' | 'warning' | 'info' | string;
  message: string;
  publicMessageCode?: string;
};

export type BeatWriteBundle = {
  beatId: string;
  chapterId: string;
  chapterNumber: number;
  beatNumber: number;
  title: string | null;
  summary: string | null;
  acceptedProseVersionId: string | null;
  workingDraft: {
    content: string;
    version: number;
    updatedAt: Date;
  } | null;
  proseVersions: Array<{
    id: string;
    version: number;
    content: string;
    contentHash: string;
    status: string;
    createdAt: Date;
    report: {
      id: string;
      passed: boolean;
      findings: PublicFindingView[];
      createdAt: Date;
    } | null;
  }>;
};

/**
 * Write Room read model: chapters/beats + drafts + prose versions + latest validation.
 * Strips internal-only finding noise for display.
 */
export async function listBeatWriteBundles(
  projectId: string,
  userId: string,
): Promise<BeatWriteBundle[]> {
  const prisma = getPrisma();
  const chapters = await prisma.chapter.findMany({
    where: { projectId },
    include: {
      beats: {
        orderBy: { beatNumber: 'asc' },
        include: {
          proseVersions: {
            orderBy: { version: 'desc' },
            take: 5,
            include: {
              validations: {
                orderBy: { createdAt: 'desc' },
                take: 1,
              },
            },
          },
          workingDrafts: {
            where: { userId, deletedAt: null },
            take: 1,
            orderBy: { updatedAt: 'desc' },
          },
        },
      },
    },
    orderBy: { number: 'asc' },
  });

  const bundles: BeatWriteBundle[] = [];
  for (const ch of chapters) {
    for (const beat of ch.beats) {
      const draft = beat.workingDrafts[0] ?? null;
      bundles.push({
        beatId: beat.id,
        chapterId: ch.id,
        chapterNumber: ch.number,
        beatNumber: beat.beatNumber,
        title: beat.title,
        summary: beat.summary,
        acceptedProseVersionId: beat.acceptedProseVersionId,
        workingDraft: draft
          ? {
              content: draft.content,
              version: draft.version,
              updatedAt: draft.updatedAt,
            }
          : null,
        proseVersions: beat.proseVersions.map((pv) => {
          const raw = pv.validations[0] ?? null;
          const findingsRaw = Array.isArray(raw?.findings)
            ? (raw!.findings as Array<Record<string, unknown>>)
            : [];
          const findings: PublicFindingView[] = findingsRaw
            .filter((f) => f && f.code !== 'META_VALIDATOR_CONTEXT')
            .map((f) => {
              const view: PublicFindingView = {
                code: String(f.code ?? 'unknown'),
                severity: String(f.severity ?? 'info'),
                message: String(f.message ?? f.publicMessageCode ?? ''),
              };
              if (typeof f.publicMessageCode === 'string') {
                view.publicMessageCode = f.publicMessageCode;
              }
              return view;
            });
          return {
            id: pv.id,
            version: pv.version,
            content: pv.content,
            contentHash: pv.contentHash,
            status: pv.status,
            createdAt: pv.createdAt,
            report: raw
              ? {
                  id: raw.id,
                  passed: raw.passed,
                  findings,
                  createdAt: raw.createdAt,
                }
              : null,
          };
        }),
      });
    }
  }
  return bundles;
}

export async function checkDbConnectivity(): Promise<boolean> {
  const prisma = getPrisma();
  const rows = await prisma.$queryRawUnsafe<Array<{ result: number }>>(
    'SELECT 1 AS result',
  );
  return rows?.[0]?.result === 1;
}

export async function countAppliedMigrations(): Promise<number> {
  const prisma = getPrisma();
  const rows = await prisma.$queryRawUnsafe<Array<{ count: bigint | number }>>(
    'SELECT COUNT(*)::int AS count FROM _prisma_migrations WHERE finished_at IS NOT NULL',
  );
  const c = rows?.[0]?.count ?? 0;
  return typeof c === 'bigint' ? Number(c) : c;
}
