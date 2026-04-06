# Security Architecture — envShare

> **ISO 27001 aligned** · **GDPR / UK DPA 2018 compliant**  
> See [`PRIVACY.md`](PRIVACY.md) for the full data-processing register and GDPR rights implementation.

---

## Encryption Model

```
MASTER_ENCRYPTION_KEY (env var — validated at startup, never stored in DB)
        │
        ▼  wrapKey(projectKey) → AES-256-GCM
  projects.encryptedKey  (JSON: { encryptedData, iv, tag })
        │
        ▼  unwrapKey() on each request
  Project Key  (32 random bytes, per project, decrypted in memory)
        │
        ├──► encrypt(secretKeyName)   → secrets.encryptedKey  + keyIV  + keyTag
        ├──► encrypt(sharedValue)     → secrets.sharedEncryptedValue + sharedValueIV + sharedValueTag
        ├──► encrypt(personalValue)   → userSecretValues.encryptedValue + valueIV + valueTag
        └──► HMAC-SHA256(keyName)     → secrets.keyHash  (deduplication index, not reversible)
```

### Algorithms

| Purpose | Algorithm | Details |
|---------|-----------|---------|
| Secret encryption | AES-256-GCM | Per-secret random 128-bit IV. Auth tag prevents silent tampering. |
| Key wrapping | AES-256-GCM | Same algorithm, separate IV for each wrap operation. |
| Key deduplication | HMAC-SHA256 | Keyed with the project key — cannot be inverted without it. |
| Password hashing | bcrypt | 12 rounds (~300ms per hash on a modern CPU). |
| Refresh token storage | SHA-256 | Tokens are long random values; SHA-256 sufficient without bcrypt cost. |

---

## Key Management

| Key | Storage | Rotation |
|-----|---------|----------|
| `MASTER_ENCRYPTION_KEY` | Environment variable / KMS | Re-encrypt all project keys |
| Project Key | DB (wrapped by master key) | Re-encrypt all secrets in project |
| `JWT_SECRET` | Environment variable | Invalidates all sessions |

### Recommendations

1. **Store `MASTER_ENCRYPTION_KEY` in a KMS** (AWS KMS, HashiCorp Vault, GCP Secret Manager).
   Never store it in the database or commit it to source control.

2. **Enable database encryption at rest** (PostgreSQL with pgcrypto extension or cloud-managed TLS).

3. **Use TLS in production** — configure your reverse proxy (nginx, Caddy) with valid certificates.

4. **Rotate the `MASTER_ENCRYPTION_KEY` periodically** — implement a key rotation job that:
   - Decrypts each project key with the old master key
   - Re-encrypts with the new master key
   - Atomic swap in the DB (transaction)

5. **Audit logs** — every secret read/write/delete is logged with actor, IP, timestamp.

6. **Rate limiting** — auth endpoints are limited to 20 req / 15 min per IP.

7. **Minimum password length** — enforced at 12 characters.

8. **Refresh token rotation** — each refresh token is single-use; invalidated on use.

---

## ISO 27001 Controls

| Control | ID | Implementation |
|---------|----|---------------|
| Access control policy | A.9.1.1 | RBAC: ADMIN / DEVELOPER / VIEWER per project. All endpoints enforce role checks. |
| User registration & de-provisioning | A.9.2.1 | Registration requires explicit GDPR consent. Account deletion (Art. 17) immediately revokes all sessions and removes all personal data. |
| Secure log-on | A.9.4.2 | Account locked for **30 minutes** after **10** consecutive failed login attempts. Lockout state stored in DB (survives restarts, scales horizontally). |
| Password management | A.9.4.3 | Minimum 12 characters enforced. Passwords hashed with bcrypt (12 rounds). Password-change endpoint verifies current password and rejects reuse. All sessions invalidated on password change. |
| Cryptographic controls | A.10.1 | AES-256-GCM + per-secret IVs. bcrypt for passwords. All keys managed outside the database. |
| Information transfer | A.13.2.1 | TLS 1.2+ in production. HSTS with 1-year max-age + preload. SameSite=Strict cookies. |
| Secure development | A.14.2.1 | Input validation via Zod. Parameterised queries via Prisma ORM. No raw SQL. |
| Security engineering principles | A.14.2.5 | Helmet.js security headers: CSP, HSTS, X-Frame-Options: DENY, X-Content-Type-Options: nosniff, Referrer-Policy. `trust proxy` correctly configured for IP resolution behind reverse proxies. |
| Event logging | A.12.4.1 | All security events logged: logins (success/failure), logouts, account lockouts, secret operations, member changes, password changes, session revocations, account deletions. Each entry captures: actor (userId), action, resource, timestamp, IP address, User-Agent. |
| Log protection | A.12.4.2 | Audit logs are append-only at the application layer (no update/delete API). Purged only by the automated retention job after the configured window. |
| Monitoring | A.12.4.3 | Failed login attempts, account lockouts, and anomalous access patterns are logged with IP addresses for SIEM ingestion. |
| Clock synchronisation | A.12.4.4 | All timestamps stored in UTC (PostgreSQL `TIMESTAMP(3)` + Node.js `Date`). |
| Vulnerability management | A.12.6.1 | Rate limiting on all endpoints. Dependency updates via `npm audit`. |
| Network segregation | A.13.1.3 | Docker Compose: `internal` network for DB (not exposed). `external` network for API and frontend only. PostgreSQL port 5432 not published in production compose. |
| Supplier relationships | A.15.1.1 | Infrastructure providers act as data processors under Art. 28 GDPR. DPA required. |
| Incident management | A.16.1.1 | See GDPR Art. 33/34 data breach notification procedure in `PRIVACY.md §8`. |
| Business continuity | A.17.1.1 | Stateless backend (secrets are in PostgreSQL). Database backup policy is operator's responsibility. |
| Compliance — data protection | A.18.1.4 | Full GDPR / UK DPA 2018 compliance. See `PRIVACY.md`. |

---

## Threat Model

| Threat | Mitigation |
|--------|-----------|
| **Database compromise** | Secrets encrypted with AES-256-GCM; master key not in DB; refresh tokens stored as SHA-256 hashes only |
| **Token theft** | Short-lived access tokens (15 min, memory only); refresh token single-use rotation; HttpOnly cookies for browser path |
| **Brute force — password** | bcrypt(12) + rate limiting (20 req/15 min per IP) + account lockout (10 attempts → 30 min lock, persists across restarts) |
| **Brute force — token** | Refresh tokens are 40 random bytes (80 hex chars); SHA-256 stored; single-use |
| **Misconfiguration** | Server validates `JWT_SECRET` (≥32 bytes) and `MASTER_ENCRYPTION_KEY` (64 hex chars) at startup and exits immediately if invalid |
| **MITM** | TLS in transit; HSTS max-age=1y + preload; SameSite=Strict cookie |
| **Secret leakage in logs** | Values never logged; only key names appear in audit entries |
| **Replay attacks** | GCM auth tags validate ciphertext integrity; refresh token single-use rotation |
| **CSRF** | SameSite=Strict cookie; access token in Authorization header (not cookie) |
| **XSS** | HttpOnly refresh token cookie; access token in JS memory only (not localStorage); CSP headers via Helmet |
| **Clickjacking** | X-Frame-Options: DENY |
| **MIME sniffing** | X-Content-Type-Options: nosniff |
| **IP spoofing** | `trust proxy` explicitly scoped; unsafe to enable globally |
| **Privilege escalation** | Role enforced per-request; `requireProjectAccess()` middleware validates minimum role before any handler runs |
| **Account takeover** | Account lockout; password-change revokes all sessions; all login events logged with IP |
| **Insider threat** | Admins cannot read other users' personal secrets (per-user encryption); full audit trail with actor + IP |
| **Data over-retention** | Daily retention job (single DB transaction) purges expired tokens and audit logs older than `AUDIT_LOG_RETENTION_DAYS` |
| **Path traversal on pull** | CLI validates that all output paths resolve inside `process.cwd()` before writing |

---

## Authentication Flow

```
Client (browser / CLI)                        API                    DB
─────────────────────────────────────────────────────────────────────────

POST /auth/login {email, password}
  [x-client: cli] → token pair in body   ──►  bcrypt.compare(pw, hash)
  [browser]        → token in cookie          check lockedUntil
                                              INSERT refresh_token {
                                                token: SHA256(rawToken),
                                                expiresAt, ip, ua
                                              }
                                         ◄──  {accessToken}
                                              Set-Cookie: refresh_token=<raw>; HttpOnly; SameSite=Strict

GET /api/v1/* Authorization: Bearer <accessToken>
                                         ──►  jwt.verify(token, JWT_SECRET)
                                         ◄──  200 OK

[access token expires — 15 min]

POST /auth/refresh
  body: {refreshToken: <raw>}  (CLI)     ──►  findUnique({token: SHA256(raw)})
  cookie: refresh_token=<raw>  (browser)      DELETE old record  ← single-use
                                              INSERT new_record {token: SHA256(newRaw)}
                                         ◄──  {accessToken, refreshToken: newRaw}  (CLI)
                                              Set-Cookie: refresh_token=<newRaw>    (browser)
```

---

## Session Management (ISO 27001 A.9.4)

- Users can **view all active sessions** (with IP and User-Agent) from Account Settings.
- Users can **revoke individual sessions** or **sign out all devices** at any time.
- **Password change** automatically revokes all active sessions (forces re-authentication).
- **Account deletion** revokes all sessions instantly.
- Expired refresh tokens are purged daily by the data-retention job.

---

## GDPR Rights (Quick Reference)

| Right | Article | Endpoint | Response time |
|-------|---------|---------|--------------|
| Access | Art. 15 | `GET /api/v1/account/export` | Immediate |
| Rectification | Art. 16 | `PATCH /api/v1/account/me` | Immediate |
| Erasure | Art. 17 | `DELETE /api/v1/account` | Immediate |
| Portability | Art. 20 | `GET /api/v1/account/export` (JSON) | Immediate |
| Sessions list | — | `GET /api/v1/account/sessions` | Immediate |
| Revoke all sessions | — | `DELETE /api/v1/account/sessions` | Immediate |

Full privacy policy: `/privacy` (in-app) or `PRIVACY.md`.

---

## Environment Variables Reference (Security-relevant)

| Variable | Required | Description |
|----------|----------|-------------|
| `MASTER_ENCRYPTION_KEY` | ✓ | 64-char hex string (32 bytes) — root encryption key. **Store in KMS, never commit.** |
| `JWT_SECRET` | ✓ | 64-char hex string for signing JWTs. Rotation invalidates all access tokens. |
| `POSTGRES_PASSWORD` | ✓ | Database password. |
| `ALLOWED_ORIGINS` | ✓ | CORS origins (comma-separated). Must match the exact frontend origin. |
| `TRUST_PROXY` | — | Express trust proxy setting. Keep `false` unless traffic comes through a trusted reverse proxy (e.g. `uniquelocal`, `1`). |
| `NODE_ENV` | — | Set to `production` to enable HTTPS-only cookies and file logging. |
| `COOKIE_PATH` | — | Override the refresh-token cookie path (default: `/api/v1/auth`). |
| `AUDIT_LOG_RETENTION_DAYS` | — | Days to retain audit logs before purge (default: `365`). Minimum recommended: `90`. |
| `TOKEN_CLEANUP` | — | Set to `false` to disable automatic expired-token cleanup (default: enabled). |
| `LOG_LEVEL` | — | Winston log level: `error`, `warn`, `info`, `debug` (default: `info`). |
```

