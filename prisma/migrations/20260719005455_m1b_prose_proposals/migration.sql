-- CreateEnum
CREATE TYPE "ProseStatus" AS ENUM ('draft', 'validated', 'rejected', 'superseded');

-- CreateEnum
CREATE TYPE "ProposalSource" AS ENUM ('ai', 'user', 'system');

-- CreateEnum
CREATE TYPE "ProposalStatus" AS ENUM ('pending', 'accepted', 'rejected', 'stale', 'superseded', 'needs_revalidation');

-- (no drops needed — indexes from m1a_canon are retained)

-- CreateTable
CREATE TABLE "prose_versions" (
    "id" TEXT NOT NULL,
    "beat_id" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "content" TEXT NOT NULL,
    "content_hash" TEXT NOT NULL,
    "status" "ProseStatus" NOT NULL DEFAULT 'draft',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "prose_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "validation_reports" (
    "id" TEXT NOT NULL,
    "prose_version_id" TEXT NOT NULL,
    "candidate_id" TEXT,
    "passed" BOOLEAN NOT NULL,
    "findings" JSONB NOT NULL,
    "content_hash" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "validation_reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "generated_candidates" (
    "id" TEXT NOT NULL,
    "generation_attempt_id" TEXT,
    "candidate_index" INTEGER NOT NULL,
    "raw_response_body" TEXT,
    "parsed_output" JSONB,
    "normalized_ops" JSONB,
    "canonical_ops" JSONB,
    "operations_hash" TEXT,
    "prose_version_id" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "generated_candidates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "proposal_groups" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "proposal_groups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "proposals" (
    "id" TEXT NOT NULL,
    "proposal_group_id" TEXT NOT NULL,
    "source" "ProposalSource" NOT NULL,
    "status" "ProposalStatus" NOT NULL DEFAULT 'pending',
    "dependency_hash" TEXT NOT NULL,
    "operations_hash" TEXT NOT NULL,
    "revalidated_from_proposal_id" TEXT,
    "change_set_id" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "proposals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "canonical_change_sets" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "proposal_id" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "applied_at" TIMESTAMPTZ(3),
    "rejected_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "canonical_change_sets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "canonical_change_operations" (
    "id" TEXT NOT NULL,
    "change_set_id" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "op_type" TEXT NOT NULL,
    "target_type" TEXT NOT NULL,
    "target_id" TEXT,
    "payload" JSONB NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "canonical_change_operations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "canonical_entity_revisions" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" TEXT NOT NULL,
    "change_set_id" TEXT NOT NULL,
    "revision" INTEGER NOT NULL DEFAULT 1,
    "previous_hash" TEXT,
    "new_hash" TEXT NOT NULL,
    "operation_count" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "canonical_entity_revisions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "context_snapshots" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "beat_id" TEXT,
    "snapshot_type" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "content_hash" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "context_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "generation_context_bundles" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "beat_id" TEXT,
    "bundle_type" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "content_hash" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "generation_context_bundles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "publish_package_artifacts" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "change_set_id" TEXT NOT NULL,
    "artifact_type" TEXT NOT NULL,
    "content_hash" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "publish_package_artifacts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "prose_versions_beat_id_idx" ON "prose_versions"("beat_id");

-- CreateIndex
CREATE INDEX "validation_reports_prose_version_id_idx" ON "validation_reports"("prose_version_id");

-- CreateIndex
CREATE INDEX "validation_reports_candidate_id_idx" ON "validation_reports"("candidate_id");

-- CreateIndex
CREATE INDEX "generated_candidates_generation_attempt_id_idx" ON "generated_candidates"("generation_attempt_id");

-- CreateIndex
CREATE INDEX "proposal_groups_project_id_idx" ON "proposal_groups"("project_id");

-- CreateIndex
CREATE INDEX "proposals_proposal_group_id_idx" ON "proposals"("proposal_group_id");

-- CreateIndex
CREATE INDEX "proposals_revalidated_from_proposal_id_idx" ON "proposals"("revalidated_from_proposal_id");

-- CreateIndex
CREATE INDEX "proposals_change_set_id_idx" ON "proposals"("change_set_id");

-- CreateIndex
CREATE UNIQUE INDEX "canonical_change_sets_proposal_id_key" ON "canonical_change_sets"("proposal_id");

-- CreateIndex
CREATE INDEX "canonical_change_sets_project_id_idx" ON "canonical_change_sets"("project_id");

-- CreateIndex
CREATE UNIQUE INDEX "canonical_change_operations_change_set_id_sequence_key" ON "canonical_change_operations"("change_set_id", "sequence");

-- CreateIndex
CREATE INDEX "canonical_entity_revisions_project_id_idx" ON "canonical_entity_revisions"("project_id");

-- CreateIndex
CREATE INDEX "canonical_entity_revisions_change_set_id_idx" ON "canonical_entity_revisions"("change_set_id");

-- CreateIndex
CREATE UNIQUE INDEX "canonical_entity_revisions_entity_id_revision_key" ON "canonical_entity_revisions"("entity_id", "revision");

-- CreateIndex
CREATE INDEX "context_snapshots_project_id_idx" ON "context_snapshots"("project_id");

-- CreateIndex
CREATE INDEX "context_snapshots_beat_id_idx" ON "context_snapshots"("beat_id");

-- CreateIndex
CREATE INDEX "generation_context_bundles_project_id_idx" ON "generation_context_bundles"("project_id");

-- CreateIndex
CREATE INDEX "generation_context_bundles_beat_id_idx" ON "generation_context_bundles"("beat_id");

-- CreateIndex
CREATE INDEX "publish_package_artifacts_project_id_idx" ON "publish_package_artifacts"("project_id");

-- CreateIndex
CREATE INDEX "publish_package_artifacts_change_set_id_idx" ON "publish_package_artifacts"("change_set_id");

-- AddForeignKey
ALTER TABLE "prose_versions" ADD CONSTRAINT "prose_versions_beat_id_fkey" FOREIGN KEY ("beat_id") REFERENCES "beats"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "validation_reports" ADD CONSTRAINT "validation_reports_prose_version_id_fkey" FOREIGN KEY ("prose_version_id") REFERENCES "prose_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "validation_reports" ADD CONSTRAINT "validation_reports_candidate_id_fkey" FOREIGN KEY ("candidate_id") REFERENCES "generated_candidates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "generated_candidates" ADD CONSTRAINT "generated_candidates_prose_version_id_fkey" FOREIGN KEY ("prose_version_id") REFERENCES "prose_versions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proposal_groups" ADD CONSTRAINT "proposal_groups_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proposals" ADD CONSTRAINT "proposals_proposal_group_id_fkey" FOREIGN KEY ("proposal_group_id") REFERENCES "proposal_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proposals" ADD CONSTRAINT "proposals_revalidated_from_proposal_id_fkey" FOREIGN KEY ("revalidated_from_proposal_id") REFERENCES "proposals"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "canonical_change_sets" ADD CONSTRAINT "canonical_change_sets_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "canonical_change_sets" ADD CONSTRAINT "canonical_change_sets_proposal_id_fkey" FOREIGN KEY ("proposal_id") REFERENCES "proposals"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "canonical_change_operations" ADD CONSTRAINT "canonical_change_operations_change_set_id_fkey" FOREIGN KEY ("change_set_id") REFERENCES "canonical_change_sets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "canonical_entity_revisions" ADD CONSTRAINT "canonical_entity_revisions_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "canonical_entity_revisions" ADD CONSTRAINT "canonical_entity_revisions_change_set_id_fkey" FOREIGN KEY ("change_set_id") REFERENCES "canonical_change_sets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "context_snapshots" ADD CONSTRAINT "context_snapshots_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "context_snapshots" ADD CONSTRAINT "context_snapshots_beat_id_fkey" FOREIGN KEY ("beat_id") REFERENCES "beats"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "generation_context_bundles" ADD CONSTRAINT "generation_context_bundles_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "generation_context_bundles" ADD CONSTRAINT "generation_context_bundles_beat_id_fkey" FOREIGN KEY ("beat_id") REFERENCES "beats"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "publish_package_artifacts" ADD CONSTRAINT "publish_package_artifacts_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "publish_package_artifacts" ADD CONSTRAINT "publish_package_artifacts_change_set_id_fkey" FOREIGN KEY ("change_set_id") REFERENCES "canonical_change_sets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- M1.1b raw SQL: composite unique/FK, partial unique indexes (Prisma cannot express these)

ALTER TABLE prose_versions
  ADD CONSTRAINT prose_versions_beat_id_id_unique UNIQUE (beat_id, id);

ALTER TABLE beats
  ADD CONSTRAINT beats_accepted_prose_belongs
  FOREIGN KEY (id, accepted_prose_version_id)
  REFERENCES prose_versions (beat_id, id)
  DEFERRABLE INITIALLY DEFERRED;

CREATE UNIQUE INDEX one_accepted_proposal_per_group
  ON proposals (proposal_group_id) WHERE status = 'accepted';

CREATE UNIQUE INDEX prose_versions_beat_version
  ON prose_versions (beat_id, version);

CREATE UNIQUE INDEX generated_candidates_attempt_index
  ON generated_candidates (generation_attempt_id, candidate_index)
  WHERE generation_attempt_id IS NOT NULL;

CREATE UNIQUE INDEX proposal_revalidation_unique
  ON proposals (revalidated_from_proposal_id, dependency_hash)
  WHERE revalidated_from_proposal_id IS NOT NULL;
