-- Removes the BlockedIp table (panic mode feature has been removed).
-- IF EXISTS makes this safe for fresh installs that never had the table.
DROP INDEX IF EXISTS "BlockedIp_lastDetectedAt_idx";
DROP INDEX IF EXISTS "BlockedIp_ipAddress_key";
DROP TABLE IF EXISTS "BlockedIp";
