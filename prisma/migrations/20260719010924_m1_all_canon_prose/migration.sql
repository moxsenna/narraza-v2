-- CreateEnum
CREATE TYPE "FactCanonStatus" AS ENUM ('confirmed', 'deprecated', 'contradicted');

-- CreateEnum
CREATE TYPE "ProseStatus" AS ENUM ('draft', 'validated', 'rejected', 'superseded');

-- CreateEnum
CREATE TYPE "ProposalSource" AS ENUM ('ai', 'user', 'system');

-- CreateEnum
CREATE TYPE "ProposalStatus" AS ENUM ('pending', 'accepted', 'rejected', 'stale', 'superseded', 'needs_revalidation');

-- CreateTable
CREATE TABLE "foundations" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "premise" TEXT,
    "tone" TEXT,
    "genre" TEXT,
    "body" JSONB,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "foundations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "characters" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "deleted_at" TIMESTAMPTZ(3),

    CONSTRAINT "characters_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "facts" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "fact_key" TEXT NOT NULL,
    "truth" TEXT NOT NULL,
    "canon_status" "FactCanonStatus" NOT NULL DEFAULT 'confirmed',
    "revision" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "deleted_at" TIMESTAMPTZ(3),

    CONSTRAINT "facts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "character_beliefs" (
    "id" TEXT NOT NULL,
    "character_id" TEXT NOT NULL,
    "belief_key" TEXT NOT NULL,
    "effective_sequence" INTEGER NOT NULL,
    "belief_content" TEXT NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "source_fact_id" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "character_beliefs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "character_states" (
    "id" TEXT NOT NULL,
    "character_id" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "state" JSONB NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "character_states_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reveals" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "reveal_key" TEXT NOT NULL,
    "fact_id" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "deleted_at" TIMESTAMPTZ(3),

    CONSTRAINT "reveals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reveal_breadcrumbs" (
    "id" TEXT NOT NULL,
    "reveal_id" TEXT NOT NULL,
    "beat_id" TEXT NOT NULL,
    "placement" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reveal_breadcrumbs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chapter_outlines" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "chapter_number" INTEGER NOT NULL,
    "title" TEXT,
    "summary" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "chapter_outlines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chapters" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "title" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "chapters_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "beats" (
    "id" TEXT NOT NULL,
    "chapter_id" TEXT NOT NULL,
    "beat_number" INTEGER NOT NULL,
    "accepted_prose_version_id" TEXT,
    "title" TEXT,
    "summary" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "beats_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "beat_allowed_facts" (
    "id" TEXT NOT NULL,
    "beat_id" TEXT NOT NULL,
    "fact_id" TEXT NOT NULL,

    CONSTRAINT "beat_allowed_facts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "beat_forbidden_facts" (
    "id" TEXT NOT NULL,
    "beat_id" TEXT NOT NULL,
    "fact_id" TEXT NOT NULL,

    CONSTRAINT "beat_forbidden_facts_pkey" PRIMARY KEY ("id")
);

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
CREATE UNIQUE INDEX "foundations_project_id_key" ON "foundations"("project_id");

-- CreateIndex
CREATE INDEX "characters_project_id_idx" ON "characters"("project_id");

-- CreateIndex
CREATE INDEX "facts_project_id_idx" ON "facts"("project_id");

-- CreateIndex
CREATE INDEX "character_beliefs_character_id_idx" ON "character_beliefs"("character_id");

-- CreateIndex
CREATE INDEX "character_beliefs_source_fact_id_idx" ON "character_beliefs"("source_fact_id");

-- CreateIndex
CREATE UNIQUE INDEX "character_beliefs_character_id_belief_key_effective_sequenc_key" ON "character_beliefs"("character_id", "belief_key", "effective_sequence");

-- CreateIndex
CREATE UNIQUE INDEX "character_states_character_id_sequence_key" ON "character_states"("character_id", "sequence");

-- CreateIndex
CREATE INDEX "reveals_project_id_idx" ON "reveals"("project_id");

-- CreateIndex
CREATE INDEX "reveals_fact_id_idx" ON "reveals"("fact_id");

-- CreateIndex
CREATE INDEX "reveal_breadcrumbs_reveal_id_idx" ON "reveal_breadcrumbs"("reveal_id");

-- CreateIndex
CREATE INDEX "reveal_breadcrumbs_beat_id_idx" ON "reveal_breadcrumbs"("beat_id");

-- CreateIndex
CREATE INDEX "chapter_outlines_project_id_idx" ON "chapter_outlines"("project_id");

-- CreateIndex
CREATE UNIQUE INDEX "chapter_outlines_project_id_chapter_number_key" ON "chapter_outlines"("project_id", "chapter_number");

-- CreateIndex
CREATE INDEX "chapters_project_id_idx" ON "chapters"("project_id");

-- CreateIndex
CREATE UNIQUE INDEX "chapters_project_id_number_key" ON "chapters"("project_id", "number");

-- CreateIndex
CREATE INDEX "beats_chapter_id_idx" ON "beats"("chapter_id");

-- CreateIndex
CREATE UNIQUE INDEX "beats_chapter_id_beat_number_key" ON "beats"("chapter_id", "beat_number");

-- CreateIndex
CREATE UNIQUE INDEX "beat_allowed_facts_beat_id_fact_id_key" ON "beat_allowed_facts"("beat_id", "fact_id");

-- CreateIndex
CREATE UNIQUE INDEX "beat_forbidden_facts_beat_id_fact_id_key" ON "beat_forbidden_facts"("beat_id", "fact_id");

-- CreateIndex
CREATE INDEX "prose_versions_beat_id_idx" ON "prose_versions"("beat_id");

-- CreateIndex
CREATE UNIQUE INDEX "prose_versions_beat_id_id_key" ON "prose_versions"("beat_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "prose_versions_beat_id_version_key" ON "prose_versions"("beat_id", "version");

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
ALTER TABLE "foundations" ADD CONSTRAINT "foundations_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "characters" ADD CONSTRAINT "characters_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "facts" ADD CONSTRAINT "facts_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "character_beliefs" ADD CONSTRAINT "character_beliefs_character_id_fkey" FOREIGN KEY ("character_id") REFERENCES "characters"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "character_beliefs" ADD CONSTRAINT "character_beliefs_source_fact_id_fkey" FOREIGN KEY ("source_fact_id") REFERENCES "facts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "character_states" ADD CONSTRAINT "character_states_character_id_fkey" FOREIGN KEY ("character_id") REFERENCES "characters"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reveals" ADD CONSTRAINT "reveals_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reveals" ADD CONSTRAINT "reveals_fact_id_fkey" FOREIGN KEY ("fact_id") REFERENCES "facts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reveal_breadcrumbs" ADD CONSTRAINT "reveal_breadcrumbs_reveal_id_fkey" FOREIGN KEY ("reveal_id") REFERENCES "reveals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reveal_breadcrumbs" ADD CONSTRAINT "reveal_breadcrumbs_beat_id_fkey" FOREIGN KEY ("beat_id") REFERENCES "beats"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chapter_outlines" ADD CONSTRAINT "chapter_outlines_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chapters" ADD CONSTRAINT "chapters_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "beats" ADD CONSTRAINT "beats_chapter_id_fkey" FOREIGN KEY ("chapter_id") REFERENCES "chapters"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "beat_allowed_facts" ADD CONSTRAINT "beat_allowed_facts_beat_id_fkey" FOREIGN KEY ("beat_id") REFERENCES "beats"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "beat_allowed_facts" ADD CONSTRAINT "beat_allowed_facts_fact_id_fkey" FOREIGN KEY ("fact_id") REFERENCES "facts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "beat_forbidden_facts" ADD CONSTRAINT "beat_forbidden_facts_beat_id_fkey" FOREIGN KEY ("beat_id") REFERENCES "beats"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "beat_forbidden_facts" ADD CONSTRAINT "beat_forbidden_facts_fact_id_fkey" FOREIGN KEY ("fact_id") REFERENCES "facts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

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

-- =============================================================================
-- Raw SQL: Prisma cannot express partial unique indexes, CHECK constraints,
--          or composite deferred FKs
-- =============================================================================

-- soft-delete partial unique indexes (WHERE deleted_at IS NULL)
CREATE UNIQUE INDEX facts_active_key_unique
  ON facts (project_id, fact_key) WHERE deleted_at IS NULL;

CREATE UNIQUE INDEX characters_active_name_unique
  ON characters (project_id, name) WHERE deleted_at IS NULL;

CREATE UNIQUE INDEX reveals_active_key_unique
  ON reveals (project_id, reveal_key) WHERE deleted_at IS NULL;

-- CHECK constraint on confidence
ALTER TABLE character_beliefs
  ADD CONSTRAINT character_beliefs_confidence_range
  CHECK (confidence >= 0 AND confidence <= 1);

-- composite FK: beats accepted prose must belong to same beat
ALTER TABLE beats
  ADD CONSTRAINT beats_accepted_prose_belongs
  FOREIGN KEY (id, accepted_prose_version_id)
  REFERENCES prose_versions (beat_id, id)
  DEFERRABLE INITIALLY DEFERRED;

-- partial unique: only one accepted proposal per group
CREATE UNIQUE INDEX one_accepted_proposal_per_group
  ON proposals (proposal_group_id) WHERE status = 'accepted';

-- partial unique: candidate index within generation attempt
CREATE UNIQUE INDEX generated_candidates_attempt_index
  ON generated_candidates (generation_attempt_id, candidate_index)
  WHERE generation_attempt_id IS NOT NULL;

-- partial unique: only one revalidation per source+deps
CREATE UNIQUE INDEX proposal_revalidation_unique
  ON proposals (revalidated_from_proposal_id, dependency_hash)
  WHERE revalidated_from_proposal_id IS NOT NULL;
