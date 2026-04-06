-- Migration: hash_refresh_tokens
--
-- Refresh tokens were previously stored as plaintext 80-char hex strings.
-- They are now stored as SHA-256 hashes (64-char hex) so that a database
-- breach does not expose usable tokens.
--
-- ISO 27001 A.9.4.3 — all stored credentials/tokens must be hashed.
--
-- ACTION REQUIRED: This migration deletes all existing refresh tokens.
-- All currently logged-in users (including CLI sessions) will need to
-- authenticate again after deploying this migration.

DELETE FROM "RefreshToken";
