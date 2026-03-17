-- ─────────────────────────────────────────────────────────────────────────────
-- Migration: 20260318000000_gdpr_iso_compliance
--
-- Changes:
--   1. User: add consentedAt (GDPR Art.7), failedLoginAttempts + lockedUntil
--            (ISO 27001 A.9.4.2 account lockout)
--   2. RefreshToken: add ipAddress + userAgent (ISO 27001 A.12.4 session audit)
--   3. AuditLog: add ipAddress + userAgent (ISO 27001 A.12.4.1 event logging)
--   4. Performance indexes on high-traffic query paths
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. User — GDPR consent + ISO account lockout ─────────────────────────────

ALTER TABLE "User"
  ADD COLUMN "consentedAt"          TIMESTAMP(3),
  ADD COLUMN "failedLoginAttempts"  INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "lockedUntil"          TIMESTAMP(3);

-- ── 2. RefreshToken — session provenance ─────────────────────────────────────

ALTER TABLE "RefreshToken"
  ADD COLUMN "userAgent" TEXT,
  ADD COLUMN "ipAddress" TEXT;

-- ── 3. AuditLog — event source context ───────────────────────────────────────

ALTER TABLE "AuditLog"
  ADD COLUMN "ipAddress" TEXT,
  ADD COLUMN "userAgent" TEXT;

-- ── 4. Performance indexes ────────────────────────────────────────────────────

-- ProjectMember: look up memberships by user (used on every authenticated request)
CREATE INDEX "ProjectMember_userId_idx" ON "ProjectMember"("userId");

-- Secret: list secrets for a project
CREATE INDEX "Secret_projectId_idx" ON "Secret"("projectId");

-- UserSecretValue: get personal values for a user
CREATE INDEX "UserSecretValue_userId_idx" ON "UserSecretValue"("userId");

-- SecretVersion: get history for a secret
CREATE INDEX "SecretVersion_secretId_idx" ON "SecretVersion"("secretId");

-- RefreshToken: look up tokens by user (logout-all) + purge expired tokens
CREATE INDEX "RefreshToken_userId_idx"    ON "RefreshToken"("userId");
CREATE INDEX "RefreshToken_expiresAt_idx" ON "RefreshToken"("expiresAt");

-- AuditLog: filtered queries (by actor, resourceType, resourceId, date range)
CREATE INDEX "AuditLog_actor_idx"        ON "AuditLog"("actor");
CREATE INDEX "AuditLog_resourceType_idx" ON "AuditLog"("resourceType");
CREATE INDEX "AuditLog_resourceId_idx"   ON "AuditLog"("resourceId");
CREATE INDEX "AuditLog_createdAt_idx"    ON "AuditLog"("createdAt");
