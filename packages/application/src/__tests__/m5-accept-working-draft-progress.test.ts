/**
 * M5 Integration Tests: Accept Proposal, Working Draft, Validation Hash,
 * User Proposal, PublicProposalView DTO, Project Progress, Credit Summary.
 *
 * Matrix rows: accept-proposal, accept-cas-stale, accept-supersede,
 *   fact-lifecycle, working-draft, validation-hash, user-proposal,
 *   proposal-dto, override-allowlist, progress-view, credit-summary
 *
 * Uses real Postgres via DATABASE_URL in .env (port 5433).
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { config } from 'dotenv';
import { createHash } from 'node:crypto';

config({ path: '../../.env' });

// Application imports
import {
  commitCanonicalChangeSet,
  acceptProposal,
  markProposalStaleOnCasFail,
  saveWorkingDraft,
  checkValidationStaleness,
  createValidationReport,
  submitUserProse,
  mapToPublicProposalView,
  isOverridable,
  computeProjectProgress,
  getCreditSummary,
} from '../index.js';

// DB repos
import { createUserRepo } from '../../../db/src/repositories/user-repo.js';
import { createProjectRepo } from '../../../db/src/repositories/project-repo.js';
import { createFoundationRepo } from '../../../db/src/repositories/foundation-repo.js';
import { createChangeSetRepo } from '../../../db/src/repositories/change-set-repo.js';
import { createTxChangeSetRepo } from '../../../db/src/repositories/tx-change-set-repo.js';
import { createTxProjectRepo } from '../../../db/src/repositories/tx-project-repo.js';
import { createTxFoundationRepo } from '../../../db/src/repositories/tx-foundation-repo.js';
import { createTxCharacterRepo } from '../../../db/src/repositories/tx-character-repo.js';
import { createTxProposalGroupRepo } from '../../../db/src/repositories/tx-proposal-group-repo.js';
import { createTxProposalRepo } from '../../../db/src/repositories/tx-proposal-repo.js';
import { createTxWorkingDraftRepo } from '../../../db/src/repositories/tx-working-draft-repo.js';
import { createTxValidationReportRepo } from '../../../db/src/repositories/tx-validation-report-repo.js';
import { createTxFactRepo } from '../../../db/src/repositories/tx-fact-repo.js';
import { createTxBeatRepo } from '../../../db/src/repositories/tx-beat-repo.js';
import { createTxProseVersionRepo } from '../../../db/src/repositories/tx-prose-version-repo.js';
import { createLedgerRepo } from '../../../db/src/repositories/ledger-repo.js';
import { setPrisma } from '../../../db/src/client.js';

let prisma: PrismaClient;

// =============================================================================
// Test setup / teardown
// =============================================================================

beforeAll(async () => {
  const dbUrl =
    process.env.DATABASE_URL ??
    'postgresql://narraza:narraza@localhost:5433/narraza';
  prisma = new PrismaClient({ datasources: { db: { url: dbUrl } } });
  setPrisma(prisma);
});

afterAll(async () => {
  await prisma.$disconnect();
});

beforeEach(async () => {
  try {
    // Clean in reverse dependency order (FK-safe)
    await prisma.validationReport.deleteMany();
    await prisma.proseWorkingDraft.deleteMany();
    await prisma.canonicalChangeOperation.deleteMany();
    await prisma.canonicalEntityRevision.deleteMany();
    await prisma.canonicalChangeSet.deleteMany();
    await prisma.proposal.deleteMany();
    await prisma.proposalGroup.deleteMany();
    await prisma.generatedCandidate.deleteMany();
    // Null acceptedProseVersionId on beats before deleting proseVersions
    await prisma.beat.updateMany({ where: { acceptedProseVersionId: { not: null } }, data: { acceptedProseVersionId: null } });
    await prisma.proseVersion.deleteMany();
    await prisma.revealBreadcrumb.deleteMany();
    await prisma.beatForbiddenFact.deleteMany();
    await prisma.beatAllowedFact.deleteMany();
    await prisma.beat.deleteMany();
    await prisma.chapter.deleteMany();
    await prisma.chapterOutline.deleteMany();
    await prisma.reveal.deleteMany();
    await prisma.characterBelief.deleteMany();
    await prisma.characterState.deleteMany();
    await prisma.character.deleteMany();
    await prisma.fact.deleteMany();
    await prisma.foundation.deleteMany();
    await prisma.creditLedger.deleteMany();
    await prisma.project.deleteMany();
    await prisma.user.deleteMany({
      where: { email: { contains: '@m5-test.com' } },
    });
  } catch {
    // DB may be empty - safe to ignore
  }
});

// =============================================================================
// Helpers
// =============================================================================

async function createTestUser(status: string = 'active') {
  const userRepo = createUserRepo();
  const email = `m5-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@m5-test.com`;
  return userRepo.create({
    email,
    emailNormalized: email,
    status,
  });
}

async function createTestProject(userId: string) {
  const projectRepo = createProjectRepo();
  return projectRepo.create({
    ownerUserId: userId,
    title: 'M5 Test Novel',
    startMode: 'guided',
    createRequestId: `req-m5-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  });
}

function makeTxPorts(tx: any) {
  return {
    userRepo: createUserRepo(),
    projectRepo: createTxProjectRepo(tx),
    foundationRepo: createTxFoundationRepo(tx),
    characterRepo: createTxCharacterRepo(tx),
    changeSetRepo: createTxChangeSetRepo(tx),
    proposalGroupRepo: createTxProposalGroupRepo(tx),
    proposalRepo: createTxProposalRepo(tx),
    workingDraftRepo: createTxWorkingDraftRepo(tx),
    validationReportRepo: createTxValidationReportRepo(tx),
    factRepo: createTxFactRepo(tx),
    beatRepo: createTxBeatRepo(tx),
    proseVersionRepo: createTxProseVersionRepo(tx),
  };
}

interface InMemChangeSet {
  id: string;
  projectId: string;
  proposalId: string | null;
  status: string;
  appliedAt: Date | null;
  rejectedAt: Date | null;
  createdAt: Date;
}

interface InMemChangeOp {
  id: string;
  changeSetId: string;
  sequence: number;
  opType: string;
  targetType: string;
  targetId: string | null;
  payload: Record<string, unknown>;
  createdAt: Date;
}

/**
 * Build in-memory fake repos for contract-style unit tests that don't need real DB.
 */
function makeInMemPorts() {
  const changeSets: InMemChangeSet[] = [];
  const changeOps: InMemChangeOp[] = [];
  const proposals: any[] = [];
  const groups: any[] = [];
  const drafts: any[] = [];
  const reports: any[] = [];
  const entityRevisions: any[] = [];
  const projects: Map<string, any> = new Map();

  let csCounter = 0;
  let opCounter = 0;
  let propCounter = 0;
  let groupCounter = 0;

  const changeSetRepo = {
    async create(input: any) {
      const cs: InMemChangeSet = {
        id: `cs-${++csCounter}`,
        projectId: input.projectId,
        proposalId: null,
        status: input.status ?? 'pending',
        appliedAt: null,
        rejectedAt: null,
        createdAt: new Date(),
      };
      changeSets.push(cs);
      return cs;
    },
    async createOperation(input: any) {
      const op: InMemChangeOp = {
        id: `op-${++opCounter}`,
        changeSetId: input.changeSetId,
        sequence: input.sequence,
        opType: input.opType,
        targetType: input.targetType,
        targetId: input.targetId ?? null,
        payload: input.payload,
        createdAt: new Date(),
      };
      changeOps.push(op);
      return op;
    },
    async findById(id: string) {
      return changeSets.find((cs) => cs.id === id) ?? null;
    },
    async findOperationsByChangeSetId(changeSetId: string) {
      return changeOps
        .filter((op) => op.changeSetId === changeSetId)
        .sort((a, b) => a.sequence - b.sequence);
    },
    async applyChangeSet(id: string) {
      const cs = changeSets.find((c) => c.id === id);
      if (!cs || cs.status !== 'pending') return null;
      cs.status = 'applied';
      cs.appliedAt = new Date();
      return cs;
    },
    async rejectChangeSet(id: string) {
      const cs = changeSets.find((c) => c.id === id);
      if (!cs || cs.status !== 'pending') return null;
      cs.status = 'rejected';
      cs.rejectedAt = new Date();
      return cs;
    },
    async findByProjectId(projectId: string) {
      return changeSets.filter((cs) => cs.projectId === projectId);
    },
    async createEntityRevision(input: any) {
      const rev = { ...input };
      entityRevisions.push(rev);
      return rev;
    },
    async findLatestEntityRevision(
      projectId: string,
      entityType: string,
      entityId: string,
    ) {
      const matches = entityRevisions.filter(
        (r) =>
          r.projectId === projectId &&
          r.entityType === entityType &&
          r.entityId === entityId,
      );
      if (matches.length === 0) return null;
      return matches.reduce((a, b) => (a.revision > b.revision ? a : b));
    },
  };

  const projectRepo = {
    async findById(id: string) {
      return projects.get(id) ?? null;
    },
    async bumpCanonicalVersion(id: string, inc: number) {
      const p = projects.get(id);
      if (p) p.currentCanonicalVersion += inc;
      return p ?? null;
    },
    async lockForUpdate(id: string) {
      return projects.get(id) ?? null;
    },
    async updateFoundationStatus(id: string, status: string) {
      const p = projects.get(id);
      if (p) p.foundationStatus = status;
      return p ?? null;
    },
    async findByOwnerUserIdAndRequestId() { return null; },
    async create(input: any) {
      const p = {
        id: `proj-${++csCounter}`,
        ownerUserId: input.ownerUserId,
        title: input.title,
        startMode: input.startMode,
        foundationStatus: 'none',
        currentCanonicalVersion: 0,
        createRequestId: input.createRequestId,
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
      };
      projects.set(p.id, p);
      return p;
    },
    async listByOwnerUserId() { return []; },
    async softDelete() { return null; },
  };

  const proposalGroupRepo = {
    async create(input: any) {
      const g = { id: `grp-${++groupCounter}`, projectId: input.projectId, createdAt: new Date() };
      groups.push(g);
      return g;
    },
    async findById(id: string) {
      return groups.find((g) => g.id === id) ?? null;
    },
  };

  const proposalRepo = {
    async create(input: any) {
      const p = {
        id: `prop-${++propCounter}`,
        proposalGroupId: input.proposalGroupId,
        source: input.source,
        status: 'pending',
        dependencyHash: input.dependencyHash,
        operationsHash: input.operationsHash,
        revalidatedFromProposalId: input.revalidatedFromProposalId ?? null,
        changeSetId: input.changeSetId ?? null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      proposals.push(p);
      return p;
    },
    async findById(id: string) {
      return proposals.find((p) => p.id === id) ?? null;
    },
    async findByIdWithGroup(id: string) {
      const p = proposals.find((x) => x.id === id);
      if (!p) return null;
      const g = groups.find((x) => x.id === p.proposalGroupId);
      return { ...p, group: g ?? { id: 'x', projectId: 'x', createdAt: new Date() } };
    },
    async findPendingByGroupId() { return []; },
    async findByGroupId() { return []; },
    async transitionStatus(id: string, from: string, to: string) {
      const p = proposals.find((x) => x.id === id);
      if (!p || p.status !== from) return null;
      p.status = to;
      p.updatedAt = new Date();
      return p;
    },
    async supersedeSiblings(groupId: string, exceptId: string) {
      let count = 0;
      for (const p of proposals) {
        if (p.proposalGroupId === groupId && p.id !== exceptId && p.status === 'pending') {
          p.status = 'superseded';
          count++;
        }
      }
      return count;
    },
    async markStaleIfPending(id: string) {
      const p = proposals.find((x) => x.id === id);
      if (!p || p.status !== 'pending') return null;
      p.status = 'stale';
      p.updatedAt = new Date();
      return p;
    },
    async findByChangeSetId() { return []; },
    async findWithChangeSet(id: string) {
      const p = proposals.find((x) => x.id === id);
      if (!p) return null;
      const cs = changeSets.find((x) => x.id === p.changeSetId);
      return { ...p, changeSet: cs ?? null };
    },
  };

  const workingDraftRepo = {
    async save(input: any) {
      const existing = drafts.find(
        (d) => d.userId === input.userId && d.beatId === input.beatId && !d.deletedAt,
      );
      if (!existing) {
        const d = {
          id: `draft-${drafts.length + 1}`,
          userId: input.userId,
          beatId: input.beatId,
          content: input.content,
          contentHash: input.contentHash,
          version: 1,
          deletedAt: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        drafts.push(d);
        return d;
      }
      if (input.expectedVersion !== undefined && existing.version !== input.expectedVersion) {
        throw new Error(`CAS_CONFLICT: expected ${input.expectedVersion}, got ${existing.version}`);
      }
      existing.version += 1;
      existing.content = input.content;
      existing.contentHash = input.contentHash;
      existing.updatedAt = new Date();
      return existing;
    },
    async findById(id: string) { return drafts.find((d) => d.id === id) ?? null; },
    async findByUserAndBeat(userId: string, beatId: string) {
      return drafts.find((d) => d.userId === userId && d.beatId === beatId && !d.deletedAt) ?? null;
    },
    async softDelete(id: string) {
      const d = drafts.find((x) => x.id === id);
      if (d) d.deletedAt = new Date();
      return d ?? null;
    },
  };

  const validationReportRepo = {
    async create(input: any) {
      const r = {
        id: `vr-${reports.length + 1}`,
        proseVersionId: input.proseVersionId,
        candidateId: input.candidateId ?? null,
        passed: input.passed,
        findings: input.findings,
        contentHash: input.contentHash,
        createdAt: new Date(),
      };
      reports.push(r);
      return r;
    },
    async findById(id: string) { return reports.find((r) => r.id === id) ?? null; },
    async findByProseVersionId(pid: string) {
      return reports.find((r) => r.proseVersionId === pid) ?? null;
    },
    async findLatestByProseVersionId(pid: string) {
      const all = reports.filter((r) => r.proseVersionId === pid);
      return all.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0] ?? null;
    },
    async findValidReport(pid: string, contentHash: string) {
      return (
        reports.find(
          (r) => r.proseVersionId === pid && r.contentHash === contentHash && r.passed,
        ) ?? null
      );
    },
  };

  const users = new Map<string, any>();

  const inMemUserRepo = {
    async findByEmailNormalized() { return null; },
    async findById(id: string) {
      if (users.has(id)) return users.get(id);
      const u = { id, email: `${id}@test.com`, emailNormalized: `${id}@test.com`, name: null, status: 'active', createdAt: new Date(), updatedAt: new Date(), deletedAt: null };
      users.set(id, u);
      return u;
    },
    async create(input: any) {
      const u = { id: `u-${users.size + 1}`, email: input.email, emailNormalized: input.emailNormalized, name: null, status: input.status ?? 'active', createdAt: new Date(), updatedAt: new Date(), deletedAt: null };
      users.set(u.id, u);
      return u;
    },
  };

  return {
    changeSets,
    changeOps,
    proposals,
    groups,
    drafts,
    reports,
    entityRevisions,
    projects,
    changeSetRepo,
    projectRepo,
    proposalGroupRepo,
    proposalRepo,
    workingDraftRepo,
    validationReportRepo,
    userRepo: inMemUserRepo,
  };
}

// =============================================================================
// M5.1: commitCanonicalChangeSet
// =============================================================================

describe('commitCanonicalChangeSet', () => {
  it('applies change set operations and bumps canonical version (fact-lifecycle)', async () => {
    const ports = makeInMemPorts();
    const project = await ports.projectRepo.create({
      ownerUserId: 'u1',
      title: 'Test',
      startMode: 'guided',
      createRequestId: 'r1',
    });

    const cs = await ports.changeSetRepo.create({ projectId: project.id });

    await ports.changeSetRepo.createOperation({
      changeSetId: cs.id,
      sequence: 1,
      opType: 'upsert',
      targetType: 'fact',
      targetId: 'fact-1',
      payload: { truth: 'The sky is blue', factKey: 'sky_color' },
    });

    await ports.changeSetRepo.createOperation({
      changeSetId: cs.id,
      sequence: 2,
      opType: 'upsert',
      targetType: 'character',
      targetId: 'char-1',
      payload: { name: 'Alice' },
    });

    const result = await commitCanonicalChangeSet(
      { projectRepo: ports.projectRepo, changeSetRepo: ports.changeSetRepo },
      { changeSetId: cs.id, projectId: project.id, userId: 'u1' },
    );

    expect(result.operationsApplied).toBe(2);
    expect(result.entitiesRevised).toBe(2);
    expect(result.newCanonicalVersion).toBe(1);

    // Check change set is applied
    const csAfter = await ports.changeSetRepo.findById(cs.id);
    expect(csAfter?.status).toBe('applied');
    expect(csAfter?.appliedAt).not.toBeNull();

    // Check entity revisions
    expect(ports.entityRevisions).toHaveLength(2);
    expect(ports.entityRevisions[0]?.entityType).toBe('fact');
    expect(ports.entityRevisions[0]?.revision).toBe(1);
    expect(ports.entityRevisions[1]?.entityType).toBe('character');
    expect(ports.entityRevisions[1]?.revision).toBe(1);
  });

  it('rejects applying already-applied change set', async () => {
    const ports = makeInMemPorts();
    const project = await ports.projectRepo.create({
      ownerUserId: 'u1', title: 'T', startMode: 'guided', createRequestId: 'r1',
    });
    const cs = await ports.changeSetRepo.create({ projectId: project.id });
    await ports.changeSetRepo.createOperation({
      changeSetId: cs.id, sequence: 1, opType: 'upsert',
      targetType: 'fact', targetId: 'f1', payload: {},
    });

    // Apply once
    await commitCanonicalChangeSet(
      { projectRepo: ports.projectRepo, changeSetRepo: ports.changeSetRepo },
      { changeSetId: cs.id, projectId: project.id, userId: 'u1' },
    );

    // Apply again should fail
    await expect(
      commitCanonicalChangeSet(
        { projectRepo: ports.projectRepo, changeSetRepo: ports.changeSetRepo },
        { changeSetId: cs.id, projectId: project.id, userId: 'u1' },
      ),
    ).rejects.toMatchObject({ code: 'TERMINAL_STATE_CONFLICT' });
  });

  it('rejects empty change set', async () => {
    const ports = makeInMemPorts();
    const project = await ports.projectRepo.create({
      ownerUserId: 'u1', title: 'T', startMode: 'guided', createRequestId: 'r1',
    });
    const cs = await ports.changeSetRepo.create({ projectId: project.id });

    await expect(
      commitCanonicalChangeSet(
        { projectRepo: ports.projectRepo, changeSetRepo: ports.changeSetRepo },
        { changeSetId: cs.id, projectId: project.id, userId: 'u1' },
      ),
    ).rejects.toMatchObject({ code: 'VALIDATION' });
  });

  it('entity revision increments for repeated entity type', async () => {
    const ports = makeInMemPorts();
    const project = await ports.projectRepo.create({
      ownerUserId: 'u1', title: 'T', startMode: 'guided', createRequestId: 'r1',
    });
    const cs = await ports.changeSetRepo.create({ projectId: project.id });

    // Two ops on the same entity type/ID
    await ports.changeSetRepo.createOperation({
      changeSetId: cs.id, sequence: 1, opType: 'update',
      targetType: 'fact', targetId: 'fact-1', payload: { rev: 1 },
    });
    await ports.changeSetRepo.createOperation({
      changeSetId: cs.id, sequence: 2, opType: 'update',
      targetType: 'fact', targetId: 'fact-1', payload: { rev: 2 },
    });

    await commitCanonicalChangeSet(
      { projectRepo: ports.projectRepo, changeSetRepo: ports.changeSetRepo },
      { changeSetId: cs.id, projectId: project.id, userId: 'u1' },
    );

    expect(ports.entityRevisions).toHaveLength(2);
    expect(ports.entityRevisions[0]?.revision).toBe(1);
    expect(ports.entityRevisions[1]?.revision).toBe(2);
  });
});

// =============================================================================
// M5.1: acceptProposal
// =============================================================================

describe('acceptProposal', () => {
  it('accepts pending proposal with valid change set (accept-proposal)', async () => {
    const ports = makeInMemPorts();
    const project = await ports.projectRepo.create({
      ownerUserId: 'u1', title: 'T', startMode: 'guided', createRequestId: 'r1',
    });

    const hash = createHash('sha256').update('test').digest('hex');
    const cs = await ports.changeSetRepo.create({ projectId: project.id });
    await ports.changeSetRepo.createOperation({
      changeSetId: cs.id, sequence: 1, opType: 'prose_accept',
      targetType: 'beat', targetId: 'b1', payload: { content: 'Hello world' },
    });

    const group = await ports.proposalGroupRepo.create({ projectId: project.id });
    const proposal = await ports.proposalRepo.create({
      proposalGroupId: group.id,
      source: 'ai',
      dependencyHash: hash,
      operationsHash: hash,
      changeSetId: cs.id,
    });

    // Create another pending proposal in same group (should be superseded)
    const proposal2 = await ports.proposalRepo.create({
      proposalGroupId: group.id,
      source: 'ai',
      dependencyHash: hash,
      operationsHash: hash,
      changeSetId: cs.id,
    });

    const result = await acceptProposal(ports as any, {
      userId: 'u1',
      projectId: project.id,
      proposalId: proposal.id,
    });

    expect(result.newStatus).toBe('accepted');
    expect(result.operationsApplied).toBe(1);
    expect(result.siblingsSuperseded).toBe(1);

    // Verify proposal status
    const p = await ports.proposalRepo.findById(proposal.id);
    expect(p?.status).toBe('accepted');

    // Verify sibling superseded
    const p2 = await ports.proposalRepo.findById(proposal2.id);
    expect(p2?.status).toBe('superseded');
  });

  it('rejects accepting non-pending proposal (accept-cas-stale)', async () => {
    const ports = makeInMemPorts();
    const project = await ports.projectRepo.create({
      ownerUserId: 'u1', title: 'T', startMode: 'guided', createRequestId: 'r1',
    });

    const hash = createHash('sha256').update('test').digest('hex');
    const cs = await ports.changeSetRepo.create({ projectId: project.id });
    await ports.changeSetRepo.createOperation({
      changeSetId: cs.id, sequence: 1, opType: 'prose_accept',
      targetType: 'beat', targetId: 'b1', payload: {},
    });

    const group = await ports.proposalGroupRepo.create({ projectId: project.id });
    const proposal = await ports.proposalRepo.create({
      proposalGroupId: group.id,
      source: 'ai',
      dependencyHash: hash,
      operationsHash: hash,
      changeSetId: cs.id,
    });

    // Mark as stale first
    await ports.proposalRepo.markStaleIfPending(proposal.id);

    await expect(
      acceptProposal(ports as any, {
        userId: 'u1',
        projectId: project.id,
        proposalId: proposal.id,
      }),
    ).rejects.toMatchObject({ code: 'TERMINAL_STATE_CONFLICT' });
  });

  it('markProposalStaleOnCasFail transitions pending to stale', async () => {
    const ports = makeInMemPorts();
    const project = await ports.projectRepo.create({
      ownerUserId: 'u1', title: 'T', startMode: 'guided', createRequestId: 'r1',
    });
    const hash = createHash('sha256').update('test').digest('hex');

    const group = await ports.proposalGroupRepo.create({ projectId: project.id });
    const proposal = await ports.proposalRepo.create({
      proposalGroupId: group.id,
      source: 'ai',
      dependencyHash: hash,
      operationsHash: hash,
      changeSetId: null,
    });

    await markProposalStaleOnCasFail(
      { proposalRepo: ports.proposalRepo },
      proposal.id,
    );

    const p = await ports.proposalRepo.findById(proposal.id);
    expect(p?.status).toBe('stale');
  });

  it('supersedes all pending siblings when accepting (accept-supersede)', async () => {
    const ports = makeInMemPorts();
    const project = await ports.projectRepo.create({
      ownerUserId: 'u1', title: 'T', startMode: 'guided', createRequestId: 'r1',
    });

    const hash = createHash('sha256').update('supersede-test').digest('hex');
    const cs = await ports.changeSetRepo.create({ projectId: project.id });
    await ports.changeSetRepo.createOperation({
      changeSetId: cs.id, sequence: 1, opType: 'prose_accept',
      targetType: 'beat', targetId: 'b1', payload: {},
    });

    const group = await ports.proposalGroupRepo.create({ projectId: project.id });

    const p1 = await ports.proposalRepo.create({
      proposalGroupId: group.id, source: 'ai',
      dependencyHash: hash, operationsHash: hash, changeSetId: cs.id,
    });
    const p2 = await ports.proposalRepo.create({
      proposalGroupId: group.id, source: 'ai',
      dependencyHash: hash, operationsHash: hash, changeSetId: cs.id,
    });
    const p3 = await ports.proposalRepo.create({
      proposalGroupId: group.id, source: 'ai',
      dependencyHash: hash, operationsHash: hash, changeSetId: cs.id,
    });

    // Accept p2 (the middle one)
    const result = await acceptProposal(ports as any, {
      userId: 'u1',
      projectId: project.id,
      proposalId: p2.id,
    });

    expect(result.siblingsSuperseded).toBe(2);

    const r1 = await ports.proposalRepo.findById(p1.id);
    const r2 = await ports.proposalRepo.findById(p2.id);
    const r3 = await ports.proposalRepo.findById(p3.id);

    expect(r1?.status).toBe('superseded');
    expect(r2?.status).toBe('accepted');
    expect(r3?.status).toBe('superseded');
  });
});

// =============================================================================
// M5.2: ProseWorkingDraft autosave CAS
// =============================================================================

describe('saveWorkingDraft', () => {
  it('creates new working draft (working-draft)', async () => {
    const ports = makeInMemPorts();

    const result = await saveWorkingDraft(
      {
        userRepo: ports.userRepo,
        projectRepo: ports.projectRepo as any,
        workingDraftRepo: ports.workingDraftRepo,
      },
      { userId: 'u1', beatId: 'beat-1', content: 'Chapter one' },
    );

    expect(result.version).toBe(1);
    expect(result.userId).toBe('u1');
    expect(result.beatId).toBe('beat-1');

    // Check hash is computed
    expect(result.contentHash).toBe(
      createHash('sha256').update('Chapter one').digest('hex'),
    );
  });

  it('updates existing draft and bumps version', async () => {
    const ports = makeInMemPorts();

    const repo = {
      userRepo: ports.userRepo,
      projectRepo: ports.projectRepo as any,
      workingDraftRepo: ports.workingDraftRepo,
    };

    const v1 = await saveWorkingDraft(repo, {
      userId: 'u1', beatId: 'beat-2', content: 'First write',
    });

    const v2 = await saveWorkingDraft(repo, {
      userId: 'u1', beatId: 'beat-2', content: 'Revised write',
      expectedVersion: 1,
    });

    expect(v2.version).toBe(2);
    expect(v2.content).toBe('Revised write');
    expect(v2.contentHash).not.toBe(v1.contentHash);
  });

  it('CAS conflict when expectedVersion mismatches', async () => {
    const ports = makeInMemPorts();

    const repo = {
      userRepo: ports.userRepo,
      projectRepo: ports.projectRepo as any,
      workingDraftRepo: ports.workingDraftRepo,
    };

    await saveWorkingDraft(repo, {
      userId: 'u1', beatId: 'beat-3', content: 'Write 1',
    });

    await expect(
      saveWorkingDraft(repo, {
        userId: 'u1',
        beatId: 'beat-3',
        content: 'Write 2',
        expectedVersion: 99,
      }),
    ).rejects.toMatchObject({ code: 'CAS_CONFLICT' });
  });

  it('no-op if content hash matches existing', async () => {
    const ports = makeInMemPorts();

    const repo = {
      userRepo: ports.userRepo,
      projectRepo: ports.projectRepo as any,
      workingDraftRepo: ports.workingDraftRepo,
    };

    const v1 = await saveWorkingDraft(repo, {
      userId: 'u1', beatId: 'beat-4', content: 'Same content',
    });

    const v2 = await saveWorkingDraft(repo, {
      userId: 'u1', beatId: 'beat-4', content: 'Same content',
    });

    expect(v2.version).toBe(v1.version); // No version bump
  });
});

// =============================================================================
// M5.3: Validation hash binding
// =============================================================================

describe('validation hash binding', () => {
  it('report is stale after content hash change (validation-hash)', async () => {
    const ports = makeInMemPorts();

    const hashPorts = {
      userRepo: ports.userRepo,
      validationReportRepo: ports.validationReportRepo,
      workingDraftRepo: ports.workingDraftRepo,
    };

    const content = 'Initial content';
    const contentHash = createHash('sha256').update(content).digest('hex');
    const newHash = createHash('sha256').update('Modified content').digest('hex');

    // Create a validation report
    await createValidationReport(hashPorts, {
      proseVersionId: 'pv-1',
      candidateId: null,
      findings: [],
      content,
    });

    // Check staleness with matching hash
    const fresh = await checkValidationStaleness(hashPorts, {
      userId: 'u1',
      proseVersionId: 'pv-1',
      currentContentHash: contentHash,
    });
    expect(fresh.isStale).toBe(false);

    // Check staleness with different hash
    const stale = await checkValidationStaleness(hashPorts, {
      userId: 'u1',
      proseVersionId: 'pv-1',
      currentContentHash: newHash,
    });
    expect(stale.isStale).toBe(true);
  });

  it('returns stale when no report exists', async () => {
    const ports = makeInMemPorts();

    const result = await checkValidationStaleness(
      {
        userRepo: ports.userRepo,
        validationReportRepo: ports.validationReportRepo,
        workingDraftRepo: ports.workingDraftRepo,
      },
      {
        userId: 'u1',
        proseVersionId: 'no-report',
        currentContentHash: 'any-hash',
      },
    );

    expect(result.isStale).toBe(true);
    expect(result.reportId).toBeNull();
  });

  it('creating report with blocking finding sets passed=false', async () => {
    const ports = makeInMemPorts();

    const hashPorts = {
      userRepo: ports.userRepo,
      validationReportRepo: ports.validationReportRepo,
      workingDraftRepo: ports.workingDraftRepo,
    };

    const report = await createValidationReport(hashPorts, {
      proseVersionId: 'pv-2',
      findings: [
        {
          code: 'structural.repetition',
          severity: 'blocker',
          source: 'deterministic' as const,
          message: 'Repetition detected',
          publicMessageCode: 'error.repetition',
          deterministic: true,
        },
      ],
      content: 'test',
    });

    expect(report.passed).toBe(false);
    expect(report.findings).toHaveLength(1);
  });
});

// =============================================================================
// M5.4: user-origin Proposal
// =============================================================================

describe('submitUserProse', () => {
  it('creates user-origin proposal from working draft (user-proposal)', async () => {
    const ports = makeInMemPorts();
    const project = await ports.projectRepo.create({
      ownerUserId: 'u1', title: 'T', startMode: 'guided', createRequestId: 'r1',
    });

    // Create a working draft first
    await ports.workingDraftRepo.save({
      userId: 'u1',
      beatId: 'beat-1',
      content: 'My user-written prose',
      contentHash: createHash('sha256').update('My user-written prose').digest('hex'),
    });

    const result = await submitUserProse(ports as any, {
      userId: 'u1',
      projectId: project.id,
      beatId: 'beat-1',
    });

    expect(result.proposalGroupId).toBeTruthy();
    expect(result.proposalId).toBeTruthy();
    expect(result.changeSetId).toBeTruthy();

    // Verify proposal source is user
    const proposal = await ports.proposalRepo.findById(result.proposalId);
    expect(proposal?.source).toBe('user');
  });

  it('rejects when no working draft exists', async () => {
    const ports = makeInMemPorts();
    const project = await ports.projectRepo.create({
      ownerUserId: 'u1', title: 'T', startMode: 'guided', createRequestId: 'r1',
    });

    await expect(
      submitUserProse(ports as any, {
        userId: 'u1',
        projectId: project.id,
        beatId: 'no-draft-beat',
      }),
    ).rejects.toMatchObject({ code: 'VALIDATION' });
  });
});

// =============================================================================
// M5.5: PublicProposalView DTO
// =============================================================================

describe('PublicProposalView DTO', () => {
  it('strips service_restricted details (proposal-dto)', () => {
    const view = mapToPublicProposalView({
      proposal: {
        id: 'p1',
        proposalGroupId: 'g1',
        source: 'ai',
        status: 'pending',
        dependencyHash: 'abc',
        operationsHash: 'def',
        revalidatedFromProposalId: null,
        changeSetId: 'cs1',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      group: {
        id: 'g1',
        projectId: 'proj1',
        createdAt: new Date(),
      },
      changeSet: {
        id: 'cs1',
        projectId: 'proj1',
        proposalId: 'p1',
        status: 'pending',
        appliedAt: null,
        rejectedAt: null,
        createdAt: new Date(),
      },
      validationReport: {
        id: 'vr1',
        proseVersionId: 'pv1',
        candidateId: null,
        passed: true,
        findings: [
          {
            code: 'internal.forbidden_truth_leak',
            severity: 'blocker' as const,
            source: 'deterministic' as const,
            message: 'SECRET_INTERNAL: The butler did it',
            publicMessageCode: 'error.continuity_issue',
            deterministic: true,
          },
        ],
        contentHash: 'hash',
        createdAt: new Date(),
      },
      projectCanonicalVersion: 5,
      currentDependencyHash: 'abc',
    });

    // No internal messages in output
    expect(JSON.stringify(view)).not.toContain('SECRET_INTERNAL');
    expect(JSON.stringify(view)).not.toContain('The butler did it');
    expect(JSON.stringify(view)).not.toContain('service_restricted');
    expect(JSON.stringify(view)).not.toContain('forbidden_truth_leak');

    // Only publicMessageCode
    expect(view.findings[0]?.code).toBe('error.continuity_issue');
    expect(view.availableActions).toContain('accept');
    expect(view.availableActions).toContain('reject');
  });

  it('availableActions when proposal is stale', () => {
    const view = mapToPublicProposalView({
      proposal: {
        id: 'p1', proposalGroupId: 'g1', source: 'ai', status: 'pending',
        dependencyHash: 'old-hash', operationsHash: 'def',
        revalidatedFromProposalId: null, changeSetId: 'cs1',
        createdAt: new Date(), updatedAt: new Date(),
      },
      group: { id: 'g1', projectId: 'proj1', createdAt: new Date() },
      changeSet: null,
      validationReport: null,
      projectCanonicalVersion: 1,
      currentDependencyHash: 'new-hash', // Different!
    });

    expect(view.isStale).toBe(true);
    expect(view.availableActions).toContain('revalidate');
    expect(view.availableActions).not.toContain('accept');
  });

  it('override allowlist only for known codes (override-allowlist)', () => {
    expect(isOverridable('structural.repetition')).toBe(true);
    expect(isOverridable('structural.minor_grammar')).toBe(true);
    expect(isOverridable('semantic.unclear_pronoun')).toBe(true);
    expect(isOverridable('continuity.minor_character_detail')).toBe(true);

    // Not on the allowlist
    expect(isOverridable('restricted.forbidden_truth')).toBe(false);
    expect(isOverridable('internal.raw_api_key')).toBe(false);
    expect(isOverridable('')).toBe(false);
  });

  it('override_accept available when has overridable blockers', () => {
    const view = mapToPublicProposalView({
      proposal: {
        id: 'p1', proposalGroupId: 'g1', source: 'ai', status: 'pending',
        dependencyHash: 'abc', operationsHash: 'def',
        revalidatedFromProposalId: null, changeSetId: 'cs1',
        createdAt: new Date(), updatedAt: new Date(),
      },
      group: { id: 'g1', projectId: 'proj1', createdAt: new Date() },
      changeSet: null,
      validationReport: {
        id: 'vr1', proseVersionId: 'pv1', candidateId: null,
        passed: false,
        findings: [
          {
            code: 'structural.repetition',
            severity: 'blocker' as const,
            source: 'deterministic' as const,
            message: 'Repetition found',
            publicMessageCode: 'warn.repetition',
            deterministic: true,
          },
        ],
        contentHash: 'hash',
        createdAt: new Date(),
      },
      projectCanonicalVersion: 1,
      currentDependencyHash: 'abc',
    });

    expect(view.passedValidation).toBe(false);
    expect(view.availableActions).toContain('override_accept');
    expect(view.overridableFindingCodes).toContain('warn.repetition');
  });
});

// =============================================================================
// M5.6: ProjectProgressView reducer
// =============================================================================

describe('ProjectProgressView reducer', () => {
  it('intake phase when no intake done (progress-view)', () => {
    const result = computeProjectProgress({
      hasIntake: false,
      foundationStatus: 'none',
      hasCharacters: false,
      chapterCount: 0,
      hasAcceptedProse: false,
      hasActiveJob: false,
      hasWorkingDraft: false,
    });

    expect(result.currentPhase).toBe('intake');
    expect(result.primaryCta.route).toContain('intake');
    expect(result.completionPercent).toBe(0);
  });

  it('writing phase when has working draft', () => {
    const result = computeProjectProgress({
      hasIntake: true,
      foundationStatus: 'locked',
      hasCharacters: true,
      chapterCount: 5,
      hasAcceptedProse: false,
      hasActiveJob: false,
      hasWorkingDraft: true,
    });

    expect(result.currentPhase).toBe('writing');
    expect(result.primaryCta.label).toContain('Lanjutkan');
  });

  it('complete when has accepted prose', () => {
    const result = computeProjectProgress({
      hasIntake: true,
      foundationStatus: 'locked',
      hasCharacters: true,
      chapterCount: 10,
      hasAcceptedProse: true,
      hasActiveJob: false,
      hasWorkingDraft: false,
    });

    expect(result.currentPhase).toBe('complete');
    expect(result.completionPercent).toBe(100);
  });

  it('foundation phase when draft', () => {
    const result = computeProjectProgress({
      hasIntake: true,
      foundationStatus: 'draft',
      hasCharacters: false,
      chapterCount: 0,
      hasAcceptedProse: false,
      hasActiveJob: false,
      hasWorkingDraft: false,
    });

    expect(result.currentPhase).toBe('foundation');
  });

  it('writing when active job exists', () => {
    const result = computeProjectProgress({
      hasIntake: true,
      foundationStatus: 'locked',
      hasCharacters: true,
      chapterCount: 3,
      hasAcceptedProse: false,
      hasActiveJob: true,
      hasWorkingDraft: false,
    });

    expect(result.currentPhase).toBe('writing');
    expect(result.primaryCta.label).toContain('Lihat Proses');
  });

  it('no fake writing without job or working draft', () => {
    const result = computeProjectProgress({
      hasIntake: true,
      foundationStatus: 'locked',
      hasCharacters: true,
      chapterCount: 3,
      hasAcceptedProse: false,
      hasActiveJob: false,
      hasWorkingDraft: false,
    });

    // Still "writing" phase but CTA is "Mulai Menulis" not "Lihat Proses"
    expect(result.currentPhase).toBe('writing');
    expect(result.primaryCta.label).toContain('Mulai Menulis');
  });
});

// =============================================================================
// M5.7: CreditSummary read model
// =============================================================================

describe('CreditSummary read model', () => {
  it('computes available / held / reconciling (credit-summary)', async () => {
    const userRepo = createUserRepo();
    const email = `credit-${Date.now()}@m5-test.com`;
    const user = await userRepo.create({
      email, emailNormalized: email, status: 'active',
    });

    // Add ledger entries
    const ledgerRepo = createLedgerRepo();
    await ledgerRepo.create({
      userId: user.id,
      entryType: 'grant',
      amountMicro: 1000000n,
      dedupeKey: `grant:signup:${user.id}`,
    });
    await ledgerRepo.create({
      userId: user.id,
      entryType: 'grant',
      amountMicro: 500000n,
      dedupeKey: `grant:bonus:${user.id}`,
    });
    await ledgerRepo.create({
      userId: user.id,
      entryType: 'settle',
      amountMicro: 200000n,
      dedupeKey: `settle:job1:${user.id}`,
    });

    const result = await getCreditSummary(
      {
        userRepo,
        ledgerRepo: {
          async listByUserId(userId: string) {
            return ledgerRepo.listByUserId(userId);
          },
        },
        reservationRepo: {
          async listActiveByUserId() {
            return [
              { reservedAmount: 100000n, settledAmount: 30000n, releasedAmount: 0n, openExposureAmount: 0n },
            ];
          },
        },
      },
      { userId: user.id },
    );

    expect(result.totalGrants).toBe('1500000');
    expect(result.totalSettlements).toBe('200000');
    expect(result.bookBalance).toBe('1300000');
    expect(result.heldBalance).toBe('70000');
    expect(result.reconciling).toBe('0');
    // available = 1,300,000 - 70,000 - 0 = 1,230,000
    expect(result.availableCredit).toBe('1230000');
  });

  it('rejects when user is suspended', async () => {
    const userRepo = createUserRepo();
    const email = `credit-suspend-${Date.now()}@m5-test.com`;
    const user = await userRepo.create({
      email, emailNormalized: email, status: 'suspended',
    });

    await expect(
      getCreditSummary(
        {
          userRepo,
          ledgerRepo: { async listByUserId() { return []; } },
          reservationRepo: { async listActiveByUserId() { return []; } },
        },
        { userId: user.id },
      ),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });
});
