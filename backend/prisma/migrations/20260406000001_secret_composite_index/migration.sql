-- Migration: secret_composite_index
--
-- Adds a composite index on Secret(projectId, environmentId) to accelerate
-- pull queries that always filter by both columns simultaneously.
-- The existing individual indexes on each column remain for other query shapes.

CREATE INDEX IF NOT EXISTS "Secret_projectId_environmentId_idx"
  ON "Secret" ("projectId", "environmentId");
