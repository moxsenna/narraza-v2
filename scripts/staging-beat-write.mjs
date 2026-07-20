/**
 * Staging live beat-write against 9router.
 * Usage: node scripts/staging-beat-write.mjs
 * Requires: Postgres up, .env with AI_* and DATABASE_URL*
 */

import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash, randomUUID } from 'node:crypto';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');

function loadEnv(path) {
  if (!existsSync(path)) return {};
  const out = {};
  for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith('#') || !t.includes('=')) continue;
    const i = t.indexOf('=');
    out[t.slice(0, i).trim()] = t.slice(i + 1).trim();
  }
  return out;
}

// Load .env into process.env without printing secrets
const fileEnv = loadEnv(resolve(root, '.env'));
for (const [k, v] of Object.entries(fileEnv)) {
  if (process.env[k] == null) process.env[k] = v;
}

// Prefer worker URL; Prisma client often uses DATABASE_URL
if (!process.env.DATABASE_URL && process.env.DATABASE_URL_WORKER) {
  process.env.DATABASE_URL = process.env.DATABASE_URL_WORKER;
}

const HIDDEN = 'The mayor is the cult leader';

async function main() {
  const { PrismaClient } = await import('@prisma/client');
  const { setPrisma } = await import('../packages/db/dist/client.js');
  const { createPrismaOperationalUnitOfWork } = await import(
    '../packages/db/dist/unit-of-work.js'
  );
  const { createGenerationJobRepo } = await import(
    '../packages/db/dist/repositories/generation-job-repo.js'
  );
  const { createAIExecutionPort } = await import(
    '../packages/ai/dist/create-ai-execution-port.js'
  );
  const {
    requestBeatWrite,
    executeBeatJob,
    claimJob,
  } = await import('../packages/application/dist/index.js');

  const prisma = new PrismaClient();
  setPrisma(prisma);

  const stamp = Date.now();
  const email = `staging-beat-${stamp}@narraza.local`;

  console.log(
    JSON.stringify({
      step: 'config',
      mock: process.env.AI_ENABLE_MOCK,
      baseUrl: process.env.AI_BASE_URL,
      model: process.env.AI_MODEL,
      fallback: process.env.AI_FALLBACK_MODEL,
      keyPresent: Boolean(process.env.AI_API_KEY || process.env.OPENROUTER_API_KEY),
      db: (process.env.DATABASE_URL || '').replace(/:[^:@/]+@/, ':***@'),
    }),
  );

  if (process.env.AI_ENABLE_MOCK === 'true') {
    throw new Error('AI_ENABLE_MOCK=true — set false for live staging');
  }

  const user = await prisma.user.create({
    data: {
      email,
      emailNormalized: email.toLowerCase(),
      status: 'active',
    },
  });

  const project = await prisma.project.create({
    data: {
      ownerUserId: user.id,
      title: `Staging Beat ${stamp}`,
      startMode: 'guided',
      foundationStatus: 'locked',
      currentCanonicalVersion: 1,
    },
  });

  const chapter = await prisma.chapter.create({
    data: {
      projectId: project.id,
      number: 3,
      title: 'Harbor Fog',
    },
  });

  const beat = await prisma.beat.create({
    data: {
      chapterId: chapter.id,
      beatNumber: 1,
      title: 'Docks at dusk',
      summary: 'Alya feels uneasy near the harbor fog.',
    },
  });

  // Seed a modest credit grant so enqueue can reserve
  try {
    await prisma.creditLedger.create({
      data: {
        userId: user.id,
        entryType: 'grant',
        amountMicroIdr: 50_000_000_000n,
        dedupeKey: `staging-grant-${stamp}`,
        reasonCode: 'staging_grant',
      },
    });
  } catch {
    // ledger shape may differ — try alternate if needed later
  }

  const aiPort = createAIExecutionPort({
    enableMock: false,
    nodeEnv: process.env.NODE_ENV || 'development',
    apiKey: process.env.AI_API_KEY || process.env.OPENROUTER_API_KEY,
    baseUrl: process.env.AI_BASE_URL,
    defaultModelId: process.env.AI_MODEL,
    fallbackModelId: process.env.AI_FALLBACK_MODEL,
    providerLabel: process.env.AI_PROVIDER_LABEL || '9router',
  });

  const uow = createPrismaOperationalUnitOfWork(prisma);

  const validationContextSnapshot = {
    projectRevision: project.currentCanonicalVersion,
    chapterId: chapter.id,
    chapterNumber: 3,
    beatId: beat.id,
    beatContract: {
      beatGoal: 'Show Alya uneasy at the foggy harbor docks',
      mustInclude: ['fog', 'harbor'],
      mustNotInclude: [HIDDEN],
      expectedEndState: 'Alya leaves the docks still uneasy',
      stopCondition: 'She turns away from the water',
    },
    forbiddenReveals: [HIDDEN],
    confirmedCanonFacts: [
      { factKey: 'setting.harbor', truth: 'The town has a harbor' },
    ],
    characterKnowledge: [
      {
        factId: 'f-major',
        truth: HIDDEN,
        knownByCharacterIds: [],
      },
    ],
    safeBreadcrumbs: ['The mayor avoids certain questions'],
    speechRules: ['Use given names for friends only'],
    readerKnownFacts: [
      { factKey: 'setting.harbor', surface: 'The town has a harbor' },
    ],
  };

  console.log(JSON.stringify({ step: 'request_beat_write', projectId: project.id, beatId: beat.id }));

  const req = await requestBeatWrite(uow, aiPort, {
    userId: user.id,
    projectId: project.id,
    chapterId: chapter.id,
    beatNumber: beat.beatNumber,
    chapterNumber: 3,
    beatId: beat.id,
    projectRevision: project.currentCanonicalVersion,
    validationContextSnapshot,
    requestId: `staging-beat-${stamp}`,
  });

  console.log(JSON.stringify({ step: 'job_enqueued', jobId: req.jobId, quoteId: req.quoteId }));

  const jobRepo = createGenerationJobRepo();
  await claimJob(jobRepo, req.jobId, `staging-worker-${randomUUID().slice(0, 8)}`, 120_000);

  const job = await prisma.generationJob.findUnique({ where: { id: req.jobId } });
  const payload = (job?.payloadJson ?? {}) ;
  const workflowPlan = payload.workflowPlan ?? {};

  console.log(
    JSON.stringify({
      step: 'execute_start',
      jobStatus: job?.status,
      hasSnapshot: Boolean(payload.validationContextSnapshot),
      planStages: Array.isArray(workflowPlan.stages) ? workflowPlan.stages.length : 0,
    }),
  );

  const t0 = Date.now();
  let execError = null;
  try {
    await executeBeatJob(uow, aiPort, req.jobId, workflowPlan);
  } catch (err) {
    execError = err instanceof Error ? err.message : String(err);
  }
  const latencyMs = Date.now() - t0;

  const jobAfter = await prisma.generationJob.findUnique({ where: { id: req.jobId } });
  const proseVersions = await prisma.proseVersion.findMany({
    where: { beatId: beat.id },
    orderBy: { version: 'asc' },
  });
  const latestProse = proseVersions[proseVersions.length - 1] ?? null;
  const reports = latestProse
    ? await prisma.validationReport.findMany({
        where: { proseVersionId: latestProse.id },
        orderBy: { createdAt: 'desc' },
      })
    : [];
  const report = reports[0] ?? null;
  const findings = Array.isArray(report?.findings) ? report.findings : [];
  const blockers = findings.filter((f) => f?.severity === 'blocker');
  const prose = latestProse?.content ?? '';
  const leak = prose.includes(HIDDEN);

  const summary = {
    step: 'result',
    latencyMs,
    execError,
    jobStatus: jobAfter?.status,
    terminalReason: jobAfter?.terminalReasonCode ?? null,
    proseVersions: proseVersions.length,
    latestProseVersion: latestProse?.version ?? null,
    proseLen: prose.length,
    prosePreview: prose.slice(0, 220).replace(/\s+/g, ' '),
    hasFog: /fog/i.test(prose),
    hasHarbor: /harbor/i.test(prose),
    leakedHiddenTruth: leak,
    validationPassed: report?.passed ?? null,
    blockerCount: blockers.length,
    blockerCodes: blockers.map((b) => b.code).slice(0, 10),
    reportId: report?.id ?? null,
    projectId: project.id,
    userId: user.id,
    jobId: req.jobId,
  };
  console.log(JSON.stringify(summary, null, 2));

  // Basic staging assertions
  const ok =
    !execError &&
    jobAfter?.status === 'succeeded' &&
    proseVersions.length >= 1 &&
    prose.length >= 10 &&
    !leak;

  await prisma.$disconnect();
  if (!ok) {
    console.error(JSON.stringify({ step: 'staging_failed', ok: false }));
    process.exit(2);
  }
  console.log(JSON.stringify({ step: 'staging_passed', ok: true }));
  process.exit(0);
}

main().catch(async (err) => {
  console.error(
    JSON.stringify({
      step: 'fatal',
      error: err instanceof Error ? err.message : String(err),
      stack: err instanceof Error ? err.stack?.split('\n').slice(0, 6) : undefined,
    }),
  );
  process.exit(1);
});
