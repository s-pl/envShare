-- Migration: secret_per_environment_key
--
-- Allows the same key to exist in multiple environments within a project.
-- Previously @@unique([projectId, keyHash]) prevented a key from appearing in
-- more than one .env file. The new constraint is
-- @@unique([projectId, keyHash, environmentId]), so DATABASE_URL in .env and
-- DATABASE_URL in apps/backend/.env are two independent secrets.
--
-- Steps:
--   1. Assign any secrets with NULL environmentId to their project's oldest
--      environment (the default "production" env created at project setup).
--   2. Drop the old two-column unique constraint.
--   3. Make environmentId NOT NULL.
--   4. Add the new three-column unique constraint.

-- Step 1: migrate orphaned secrets
UPDATE "Secret" s
SET "environmentId" = (
  SELECT e.id
  FROM "Environment" e
  WHERE e."projectId" = s."projectId"
  ORDER BY e."createdAt" ASC
  LIMIT 1
)
WHERE s."environmentId" IS NULL;

-- Step 2: drop old unique constraint
DROP INDEX IF EXISTS "Secret_projectId_keyHash_key";

-- Step 3: make environmentId NOT NULL
ALTER TABLE "Secret" ALTER COLUMN "environmentId" SET NOT NULL;

-- Step 4: new three-column unique constraint
CREATE UNIQUE INDEX "Secret_projectId_keyHash_environmentId_key"
  ON "Secret" ("projectId", "keyHash", "environmentId");
