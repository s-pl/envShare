# Error Reference

Complete reference for all error codes returned by the envShare API.

---

## AUTH — Authentication & sessions

### `AUTH_EMAIL_TAKEN`
**HTTP 409 Conflict**

The email address is already associated with an existing account.

**Trigger:** `POST /api/v1/auth/register` with an email that is already in the database.

**Response:**
```json
{ "error": "Email already registered", "code": "AUTH_EMAIL_TAKEN", "status": 409 }
```

**Fix:** Use a different email address, or log in if you already have an account.

---

### `AUTH_INVALID_CREDENTIALS`
**HTTP 401 Unauthorized**

The email/password combination is incorrect, or the current password supplied during a password change is wrong.

**Triggers:**
- `POST /api/v1/auth/login` — wrong password.
- `PATCH /api/v1/account/password` — `currentPassword` does not match the stored hash.

**Response:**
```json
{ "error": "Invalid email or password", "code": "AUTH_INVALID_CREDENTIALS", "status": 401 }
```

**Fix:** Check credentials. After 10 consecutive failures the account is locked — see `AUTH_ACCOUNT_LOCKED`.

---

### `AUTH_TOKEN_MISSING`
**HTTP 401 Unauthorized**

The request to `/api/v1/auth/refresh` did not include a refresh token cookie.

**Trigger:** `POST /api/v1/auth/refresh` with no `refreshToken` cookie.

**Response:**
```json
{ "error": "No refresh token provided", "code": "AUTH_TOKEN_MISSING", "status": 401 }
```

**Fix (CLI):** Run `envshare login` to obtain a new session.

---

### `AUTH_REFRESH_INVALID`
**HTTP 401 Unauthorized**

The refresh token is expired, has been revoked, or does not match any stored session.

**Trigger:** `POST /api/v1/auth/refresh` with a stale or tampered cookie.

**Response:**
```json
{ "error": "Refresh token invalid or expired", "code": "AUTH_REFRESH_INVALID", "status": 401 }
```

**Fix (CLI):** Run `envshare login` to start a new session.

---

### `AUTH_ACCOUNT_LOCKED`
**HTTP 423 Locked**

The account has been temporarily locked after 10 consecutive failed login attempts. The lock lasts 15 minutes from the last failed attempt.

**Trigger:** `POST /api/v1/auth/login` after 10 failures within the lock window.

**Response:**
```json
{
  "error": "Account temporarily locked. Try again in 12 minutes.",
  "code": "AUTH_ACCOUNT_LOCKED",
  "status": 423
}
```

**Fix:** Wait for the lock window to expire. If you believe your account was attacked, change your password immediately after the lock lifts.

---

### `AUTH_PASSWORD_REUSE`
**HTTP 400 Bad Request**

The new password supplied during a password change is identical to the current password.

**Trigger:** `PATCH /api/v1/account/password` where `newPassword === currentPassword`.

**Response:**
```json
{
  "error": "New password must be different from the current password",
  "code": "AUTH_PASSWORD_REUSE",
  "status": 400
}
```

**Fix:** Choose a password that is different from your current one.

---

### `AUTH_GDPR_REQUIRED`
**HTTP 400 Bad Request**

Registration requires explicit acceptance of the Privacy Policy. The `consent` field was missing or not `true`.

**Trigger:** `POST /api/v1/auth/register` with `consent` not equal to `true`.

**Response:**
```json
{
  "error": "You must accept the Privacy Policy to create an account.",
  "code": "AUTH_GDPR_REQUIRED",
  "status": 400
}
```

**Fix:** Include `"consent": true` in the request body.

---

## FORBIDDEN — Permissions & roles

### `FORBIDDEN`
**HTTP 403 Forbidden**

The authenticated user is not a member of the requested project.

**Triggers:** Any project-scoped endpoint when the caller has no `ProjectMember` record for that project.

**Response:**
```json
{ "error": "Access denied", "code": "FORBIDDEN", "status": 403 }
```

**Fix:** Ask a project ADMIN to add you as a member.

---

### `FORBIDDEN_ROLE`
**HTTP 403 Forbidden**

The user is a project member but their role is insufficient for the requested operation.

| Operation | Minimum role required |
|-----------|----------------------|
| Read secrets / pull | VIEWER |
| Push secrets / update values | DEVELOPER |
| Delete secrets | ADMIN |
| Add / remove members | ADMIN |
| Change member roles | ADMIN |
| View audit log | ADMIN |
| Delete project | ADMIN |

**Response:**
```json
{
  "error": "Requires DEVELOPER role or higher",
  "code": "FORBIDDEN_ROLE",
  "status": 403
}
```

**Fix:** Ask a project ADMIN to promote your role.

---

### `SELF_ROLE_CHANGE`
**HTTP 400 Bad Request**

An ADMIN attempted to change their own role via `PATCH /api/v1/projects/:id/members/:userId`.

**Response:**
```json
{
  "error": "You cannot change your own role",
  "code": "SELF_ROLE_CHANGE",
  "status": 400
}
```

**Fix:** Ask another ADMIN to change your role, or use a different account.

---

### `LAST_ADMIN`
**HTTP 400 Bad Request**

Removing this member would leave the project without any ADMIN, making it unmanageable.

**Trigger:** `DELETE /api/v1/projects/:id/members/:userId` when the target is the only remaining ADMIN.

**Response:**
```json
{
  "error": "Cannot remove the last admin. Promote another member first.",
  "code": "LAST_ADMIN",
  "status": 400
}
```

**Fix:** Promote at least one other member to ADMIN before removing this one.

---

## RESOURCE — Not found & conflicts

### `NOT_FOUND`
**HTTP 404 Not Found**

Generic resource not found. Returned when a requested user or session does not exist.

**Response:**
```json
{ "error": "User not found", "code": "NOT_FOUND", "status": 404 }
```

---

### `PROJECT_NOT_FOUND`
**HTTP 404 Not Found**

The project ID in the URL does not correspond to any existing project. This can also occur internally when the project's encryption key cannot be retrieved.

**Response:**
```json
{ "error": "Project not found", "code": "PROJECT_NOT_FOUND", "status": 404 }
```

**Fix:** Verify the project ID. If you are using the CLI, run `envshare init` again to re-link the project.

---

### `SECRET_NOT_FOUND`
**HTTP 404 Not Found**

The secret ID does not exist in the project.

**Trigger:** `PATCH`, `DELETE`, or history requests against a non-existent secret ID.

**Response:**
```json
{ "error": "Secret not found", "code": "SECRET_NOT_FOUND", "status": 404 }
```

---

### `SECRET_IS_SHARED`
**HTTP 400 Bad Request**

An attempt was made to set a personal (per-user) value on a secret that is marked as shared. Shared secrets have one value visible to all project members.

**Trigger:** `PATCH /api/v1/secrets/:id/value` when `isShared=true` on the secret **and** the request is not going through the sync push flow.

**Response:**
```json
{
  "error": "This secret is shared — update the shared value instead",
  "code": "SECRET_IS_SHARED",
  "status": 400
}
```

**Fix:** Either use the shared-value endpoint, or change the secret to personal first by removing the `# @shared` annotation in your `.env` and running `envshare push`.

---

### `ENV_NOT_FOUND`
**HTTP 404 Not Found**

The environment ID does not exist within the specified project.

**Response:**
```json
{ "error": "Environment not found", "code": "ENV_NOT_FOUND", "status": 404 }
```

---

### `ENV_LAST_REMAINING`
**HTTP 400 Bad Request**

Cannot delete the environment because it is the only one left in the project. Every project must have at least one environment.

**Trigger:** `DELETE /api/v1/projects/:id/environments/:envId` when `count(environments) === 1`.

**Response:**
```json
{
  "error": "Cannot delete the last environment. A project must have at least one.",
  "code": "ENV_LAST_REMAINING",
  "status": 400
}
```

**Fix:** Create a replacement environment before deleting this one.

---

### `MEMBER_ALREADY_EXISTS`
**HTTP 409 Conflict**

The user you are trying to add is already a member of the project.

**Trigger:** `POST /api/v1/projects/:id/members` with an email that already has a `ProjectMember` record.

**Response:**
```json
{
  "error": "alice@example.com is already a member",
  "code": "MEMBER_ALREADY_EXISTS",
  "status": 409
}
```

---

## VALIDATION — Input errors

### `VALIDATION_ERROR`
**HTTP 400 Bad Request**

Request body or query parameters failed schema validation. All field-level errors are returned in the `fields` array.

**Common validation rules:**

| Field | Rule |
|-------|------|
| `email` | Valid email format |
| `password` | Minimum 12 characters |
| `name` | 2–100 characters |
| `consent` | Must be exactly `true` |
| `role` | One of `ADMIN`, `DEVELOPER`, `VIEWER` |
| `slug` | Lowercase alphanumeric + hyphens only |
| Environment `name` | 1–64 characters |
| Environment `filePath` | 1–255 characters |
| Audit `limit` | 1–200 |

**Response:**
```json
{
  "error": "password: String must contain at least 12 character(s)",
  "code": "VALIDATION_ERROR",
  "status": 400,
  "fields": [
    {
      "field": "password",
      "message": "String must contain at least 12 character(s)"
    }
  ]
}
```

---

## DATABASE — Prisma errors

### `DB_CONSTRAINT`
**HTTP 409 Conflict**

A unique or foreign-key constraint was violated in the database. Usually means a duplicate record or an invalid reference.

**Prisma codes:** `P2002` (unique), `P2003` (foreign key).

**Response:**
```json
{ "error": "A record with this value already exists.", "code": "DB_CONSTRAINT", "status": 409 }
```

---

### `DB_NOT_FOUND`
**HTTP 404 Not Found**

A Prisma operation attempted to find or update a record that does not exist (`P2025`).

**Response:**
```json
{ "error": "Record not found", "code": "DB_NOT_FOUND", "status": 404 }
```

---

### `DB_UNAVAILABLE`
**HTTP 503 Service Unavailable**

The server cannot connect to PostgreSQL. This is a server-side infrastructure problem.

**Prisma codes:** `P1001` (unreachable), `PrismaClientInitializationError`.

**Response:**
```json
{ "error": "Database is unavailable. Please try again later.", "code": "DB_UNAVAILABLE", "status": 503 }
```

**Fix (operators):** Check that PostgreSQL is running and the `DATABASE_URL` environment variable is correct.

---

## SERVER — Encryption & configuration

### `ENCRYPTION_FAILED`
**HTTP 500 Internal Server Error**

AES-256-GCM decryption failed. This almost always means the `MASTER_ENCRYPTION_KEY` was rotated or changed after secrets were stored, making it impossible to unwrap the per-project key.

**Response:**
```json
{ "error": "Decryption failed — check MASTER_ENCRYPTION_KEY", "code": "ENCRYPTION_FAILED", "status": 500 }
```

**Fix (operators):** Restore the original `MASTER_ENCRYPTION_KEY`. Never rotate this key without a full re-encryption migration.

---

### `CONFIG_MISSING_KEY`
**HTTP 500 Internal Server Error**

A required environment variable (`JWT_SECRET` or `MASTER_ENCRYPTION_KEY`) is not set on the server.

**Response:**
```json
{ "error": "Missing required environment variable: MASTER_ENCRYPTION_KEY", "code": "CONFIG_MISSING_KEY", "status": 500 }
```

**Fix (operators):** Set the missing variable in your `.env` or container environment and restart the server.

---

### `CONFIG_INVALID_KEY`
**HTTP 500 Internal Server Error**

`MASTER_ENCRYPTION_KEY` is set but does not conform to the required format (64 hexadecimal characters = 32 bytes).

**Response:**
```json
{ "error": "MASTER_ENCRYPTION_KEY must be a 64-character hex string", "code": "CONFIG_INVALID_KEY", "status": 500 }
```

**Fix (operators):** Generate a valid key:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

---

### `INTERNAL`
**HTTP 500 Internal Server Error**

An unexpected error occurred that was not handled by any specific case. This is always a server-side bug.

**Response:**
```json
{ "error": "An unexpected error occurred.", "code": "INTERNAL", "status": 500 }
```

**Fix:** Check the server logs for the full stack trace and open an issue.
