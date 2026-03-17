-- ─────────────────────────────────────────────────────────────────────────────
-- Migration: 20260318120000_environments
--
-- Adds the Environment model so each project can have multiple .env files
-- (e.g. .env, .env.staging, apps/api/.env) represented as named environments.
--
-- Changes:
--   1. Create "Environment" table
--   2. Insert a default "production" environment for every existing project
--   3. Add nullable "environmentId" FK to "Secret"
--   4. Back-fill existing secrets → their project's default environment
--   5. Add DELETE project cascade + performance indexes
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. Environment table ──────────────────────────────────────────────────────

CREATE TABLE "Environment" (
    "id"          TEXT        NOT NULL,
    "projectId"   TEXT        NOT NULL,
    "name"        TEXT        NOT NULL,
    "filePath"    TEXT        NOT NULL,
    "description" TEXT,
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Environment_pkey" PRIMARY KEY ("id")
);

-- Unique constraints (one name per project, one filePath per project)
CREATE UNIQUE INDEX "Environment_projectId_name_key"     ON "Environment"("projectId", "name");
CREATE UNIQUE INDEX "Environment_projectId_filePath_key" ON "Environment"("projectId", "filePath");

-- Performance index
CREATE INDEX "Environment_projectId_idx" ON "Environment"("projectId");

-- FK → Project (cascade on project delete)
ALTER TABLE "Environment"
    ADD CONSTRAINT "Environment_projectId_fkey"
    FOREIGN KEY ("projectId") REFERENCES "Project"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- ── 2. Default "production" environment for every existing project ────────────
--
-- gen_random_uuid() is available in PostgreSQL 13+ via pgcrypto extension or
-- the built-in pg_catalog. We use it here; if not available the entrypoint
-- script enables pgcrypto automatically.

INSERT INTO "Environment" ("id", "projectId", "name", "filePath", "updatedAt")
SELECT
    gen_random_uuid()::text,
    "id",
    'production',
    '.env',
    NOW()
FROM "Project";

-- ── 3. Add environmentId to Secret ───────────────────────────────────────────

ALTER TABLE "Secret"
    ADD COLUMN "environmentId" TEXT;

-- ── 4. Back-fill existing secrets → default environment of their project ──────

UPDATE "Secret" s
SET    "environmentId" = e."id"
FROM   "Environment" e
WHERE  e."projectId" = s."projectId"
  AND  e."name"      = 'production';

-- ── 5. FK + index on Secret.environmentId ────────────────────────────────────

ALTER TABLE "Secret"
    ADD CONSTRAINT "Secret_environmentId_fkey"
    FOREIGN KEY ("environmentId") REFERENCES "Environment"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "Secret_environmentId_idx" ON "Secret"("environmentId");
