# Troubleshooting

Step-by-step guidance for the most common problems.

---

## CLI cannot connect to the server

**Symptoms:** `Cannot connect to http://localhost:3001`, `503`, or `504` errors.

1. Check the configured URL:
   ```bash
   envshare config get-url
   ```
2. Make sure the backend is running:
   ```bash
   docker compose ps        # if using Docker
   # or
   cd backend && npm run dev
   ```
3. If the URL is wrong, update it:
   ```bash
   envshare config set-url https://your-server.com
   ```

---

## `AUTH_ACCOUNT_LOCKED` — cannot log in

Your account is locked for 15 minutes after 10 consecutive failed login attempts.

- Wait for the lock window to expire.
- If you believe your account was attacked, change your password immediately after unlocking.
- Server operators can manually clear `failedLoginAttempts` and `lockUntil` in the database.

---

## `ENCRYPTION_FAILED` — server error on every request

The `MASTER_ENCRYPTION_KEY` has changed since secrets were stored, breaking decryption of all per-project keys.

**DO NOT** restart with a new key — this will make things worse.

1. Restore the original key in your environment:
   ```bash
   MASTER_ENCRYPTION_KEY=<original 64-char hex value>
   ```
2. Restart the server.
3. If the original key is truly lost, all encrypted data is unrecoverable.

---

## `CONFIG_MISSING_KEY` or `CONFIG_INVALID_KEY` on startup

The server requires two environment variables:

| Variable | Format | Example generation |
|----------|--------|--------------------|
| `MASTER_ENCRYPTION_KEY` | 64 hex chars (32 bytes) | `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |
| `JWT_SECRET` | Any long random string | `node -e "console.log(require('crypto').randomBytes(48).toString('base64'))"` |

Add them to your `.env` file in the `backend/` directory and restart.

---

## Push fails: `FORBIDDEN_ROLE`

You are trying to push secrets but your role is VIEWER. The minimum role for push is DEVELOPER.

Ask a project ADMIN to run:
```
PATCH /api/v1/projects/:projectId/members/:yourUserId
{ "role": "DEVELOPER" }
```
Or use the web UI → Project Settings → Members.

---

## Push fails: `LAST_ADMIN`

You are trying to remove a member but they are the only ADMIN. The project would be unmanageable without at least one admin.

1. Promote another member to ADMIN first.
2. Then remove the original admin.

---

## Push shows too many `.env` files

The CLI searches your current directory and all subdirectories for `.env*` files. It skips common non-project directories (`node_modules`, `dist`, `docker`, `.git`, etc.) but recurses into all others.

**To push a specific file without the selector:**
```bash
envshare push path/to/.env
```

**To skip a directory permanently:** add it to your local `.envshare.config.json`:
```json
{
  "ignoredKeys": []
}
```
(Directory skipping is not yet configurable via config — open an issue if you need it.)

---

## `DB_UNAVAILABLE` in production

The backend cannot reach PostgreSQL.

1. Check PostgreSQL is running and accepting connections:
   ```bash
   psql $DATABASE_URL -c "SELECT 1"
   ```
2. Verify `DATABASE_URL` in your server environment.
3. Check network rules / security groups between the app server and database.

---

## TLS errors with self-signed certificates (development)

```
Error: TLS certificate validation failed
```

For local development only:
```bash
ENVSHARE_INSECURE=1 envshare login
```

For production, use a trusted certificate (Let's Encrypt via `certbot` or Caddy's automatic HTTPS).

---

## Session expired constantly

If your session expires very quickly:

- Check `JWT_EXPIRES_IN` and `REFRESH_TOKEN_EXPIRES_IN` in the backend configuration.
- Make sure the server clock is correct (NTP synchronised) — JWT expiry is time-based.
- If using multiple server instances, ensure all share the same `JWT_SECRET`.
