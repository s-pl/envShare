# Server Errors

Errors caused by server infrastructure problems: encryption key misconfiguration, database unavailability, or unexpected runtime exceptions.

These errors always indicate a problem on the **server side** — end users cannot fix them without operator intervention.

---

## `ENCRYPTION_FAILED`
**HTTP 500 Internal Server Error**

AES-256-GCM decryption threw an authentication tag mismatch. This means the ciphertext was either tampered with, or (much more commonly) the `MASTER_ENCRYPTION_KEY` was changed after secrets were stored.

```json
{
  "error": "Decryption failed — check MASTER_ENCRYPTION_KEY",
  "code": "ENCRYPTION_FAILED",
  "status": 500
}
```

### How encryption works

Each project has its own AES-256-GCM key, stored in the database **wrapped** (encrypted) with the `MASTER_ENCRYPTION_KEY`. Every secret value is encrypted with the project key.

```
secret value
    ↓ encrypt with project key
encrypted value (stored in DB)

project key
    ↓ encrypt with MASTER_ENCRYPTION_KEY
wrapped key (stored in DB)
```

If the master key changes, the server can no longer unwrap any project key, making every secret unreadable.

### Recovery

1. **Restore the original key.** Set `MASTER_ENCRYPTION_KEY` back to the value it had when secrets were first pushed.
2. Restart the server.

> **Warning:** There is no recovery if the original key is lost. Always back up your `MASTER_ENCRYPTION_KEY` securely (e.g. in a secrets manager like Vault or AWS Secrets Manager).

### Prevention

- Never change `MASTER_ENCRYPTION_KEY` in production without performing a full re-encryption migration first.
- Store the key in a dedicated secrets manager, not in a `.env` file that could be accidentally overwritten.

---

## `CONFIG_MISSING_KEY`
**HTTP 500 Internal Server Error**

A required environment variable is not set. The server refuses to start or handle requests without it.

```json
{
  "error": "Missing required environment variable: MASTER_ENCRYPTION_KEY",
  "code": "CONFIG_MISSING_KEY",
  "status": 500
}
```

**Required variables:**

| Variable | Purpose |
|----------|---------|
| `MASTER_ENCRYPTION_KEY` | Wraps per-project AES-256-GCM keys |
| `JWT_SECRET` | Signs and verifies JWT access tokens |

### Fix

Generate and set both values:

```bash
# Generate MASTER_ENCRYPTION_KEY (32 bytes = 64 hex chars)
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Generate JWT_SECRET (48 bytes, base64)
node -e "console.log(require('crypto').randomBytes(48).toString('base64'))"
```

Add them to `backend/.env` (or your container environment) and restart.

---

## `CONFIG_INVALID_KEY`
**HTTP 500 Internal Server Error**

`MASTER_ENCRYPTION_KEY` is set but has an invalid format. It must be exactly **64 hexadecimal characters** (representing 32 bytes / 256 bits).

```json
{
  "error": "MASTER_ENCRYPTION_KEY must be a 64-character hex string",
  "code": "CONFIG_INVALID_KEY",
  "status": 500
}
```

**Invalid examples:**
- Too short: `abc123`
- Contains non-hex characters: `zzzzzz...`
- Base64 encoded instead of hex: `dGVzdA==`

**Fix:**
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

The output is always exactly 64 hex characters.

---

## `DB_UNAVAILABLE`
**HTTP 503 Service Unavailable**

PostgreSQL is not reachable. The server started but cannot connect to the database, or the connection was lost at runtime.

```json
{
  "error": "Database is unavailable. Please try again later.",
  "code": "DB_UNAVAILABLE",
  "status": 503
}
```

**Prisma error codes mapped:**
- `P1001` — database server unreachable
- `PrismaClientInitializationError` — could not initialise the connection

### Fix (operators)

1. Check PostgreSQL status:
   ```bash
   pg_isready -h localhost -p 5432
   # or with Docker:
   docker compose ps db
   ```
2. Verify `DATABASE_URL` in your server environment.
3. Check firewall / security group rules between the app and the database.
4. Check PostgreSQL logs for max-connections or disk-full errors.

---

## `DB_CONSTRAINT`
**HTTP 409 Conflict**

A database-level unique or foreign key constraint was violated.

```json
{
  "error": "A record with this value already exists.",
  "code": "DB_CONSTRAINT",
  "status": 409
}
```

**Prisma error codes mapped:**
- `P2002` — unique constraint (e.g. duplicate email, duplicate project slug)
- `P2003` — foreign key constraint (e.g. referencing a project that was deleted)

This is a lower-level catch-all. Named conflict codes (`MEMBER_ALREADY_EXISTS`, `AUTH_EMAIL_TAKEN`) are returned for the most common cases; `DB_CONSTRAINT` appears for edge cases and race conditions.

---

## `DB_NOT_FOUND`
**HTTP 404 Not Found**

A Prisma query with `findUniqueOrThrow` or `update`/`delete` could not find the record (`P2025`).

```json
{
  "error": "Record not found",
  "code": "DB_NOT_FOUND",
  "status": 404
}
```

Named 404 codes (`SECRET_NOT_FOUND`, `PROJECT_NOT_FOUND`, etc.) are used when the application explicitly checks for existence. `DB_NOT_FOUND` is the fallback for any Prisma `P2025` that escapes application-level checks.

---

## `INTERNAL`
**HTTP 500 Internal Server Error**

An unhandled exception reached the error middleware. This is always a server-side bug.

```json
{
  "error": "An unexpected error occurred.",
  "code": "INTERNAL",
  "status": 500
}
```

The full stack trace is logged to `stderr` on the server. End users should report the request details and approximate timestamp so operators can correlate with server logs.

> In development mode, the actual error message and stack trace are included in the response body.
