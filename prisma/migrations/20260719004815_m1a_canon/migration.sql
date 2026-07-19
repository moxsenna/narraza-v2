-- CreateEnum
CREATE TYPE "FactCanonStatus" AS ENUM ('confirmed', 'deprecated', 'contradicted');

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
CREATE INDEX "chapters_project_id_idx" ON "chapters"("project_id");

-- CreateIndex
CREATE INDEX "beats_chapter_id_idx" ON "beats"("chapter_id");

-- CreateIndex
CREATE UNIQUE INDEX "beat_allowed_facts_beat_id_fact_id_key" ON "beat_allowed_facts"("beat_id", "fact_id");

-- CreateIndex
CREATE UNIQUE INDEX "beat_forbidden_facts_beat_id_fact_id_key" ON "beat_forbidden_facts"("beat_id", "fact_id");

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

-- M1.1a raw SQL: partial unique indexes and CHECK constraints (Prisma cannot express these)

CREATE UNIQUE INDEX facts_active_key_unique
  ON facts (project_id, fact_key) WHERE deleted_at IS NULL;

CREATE UNIQUE INDEX characters_active_name_unique
  ON characters (project_id, name) WHERE deleted_at IS NULL;

CREATE UNIQUE INDEX reveals_active_key_unique
  ON reveals (project_id, reveal_key) WHERE deleted_at IS NULL;

CREATE UNIQUE INDEX chapter_outlines_project_number
  ON chapter_outlines (project_id, chapter_number);

CREATE UNIQUE INDEX chapters_project_number
  ON chapters (project_id, number);

CREATE UNIQUE INDEX beats_chapter_beat_number
  ON beats (chapter_id, beat_number);

CREATE UNIQUE INDEX character_beliefs_stream
  ON character_beliefs (character_id, belief_key, effective_sequence);

ALTER TABLE character_beliefs
  ADD CONSTRAINT character_beliefs_confidence_range
  CHECK (confidence >= 0 AND confidence <= 1);
