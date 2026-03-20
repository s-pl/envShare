# Security Architecture — envShare

> **ISO 27001 aligned** · **GDPR / UK DPA 2018 compliant**  
> See [`PRIVACY.md`](PRIVACY.md) for the full data-processing register and GDPR rights implementation.

---

## Encryption Model

```
MASTER_ENCRYPTION_KEY (env var, never in DB)
        │
        ▼
  wrapKey(projectKey)  ──► stored as JSON in projects.encryptedKey
        │
        ▼
  Project Key (32-byte random, per project)
        │
        ├──► encrypt(secretKey)   ──► secrets.encryptedKey + keyIV + keyTag
        └──► encrypt(secretValue) ──► secrets.encryptedValue + valueIV + valueTag
```

### Algorithm
- **AES-256-GCM** for all secret encryption
- Per-secret random IVs (128-bit)
- Authentication tags prevent silent tampering
- bcrypt (rounds=12) for password hashing

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
| Database compromise | Secrets encrypted with AES-256-GCM; master key not in DB |
| Token theft | Short-lived access tokens (15 min); refresh token rotation; HttpOnly cookies |
| Brute force — password | bcrypt(12) + rate limiting (20 req/15 min per IP) + **account lockout** (10 attempts → 30 min lock) |
| Brute force — token | Refresh tokens are cryptographically random 40-byte hex strings |
| MITM | TLS in transit; HSTS headers; SameSite=Strict cookie |
| Secret leakage in logs | Values never logged; only key names in audit logs |
| Replay attacks | GCM auth tags; refresh token single-use rotation |
| CSRF | SameSite=Strict cookie; access token in Authorization header (not cookie) |
| XSS | HttpOnly refresh token cookie; access token in JS memory only (not localStorage); CSP headers |
| Clickjacking | X-Frame-Options: DENY |
| MIME sniffing | X-Content-Type-Options: nosniff |
| IP spoofing | `trust proxy 1` (trust exactly one upstream hop); nginx sets `X-Forwarded-For` |
| Privilege escalation | Role checked on every request; `requireProjectAccess` middleware enforces minimum role |
| Account takeover | Account lockout; password-change revokes all sessions; login events logged with IP |
| Insider threat | Audit logs with actor + IP; admins cannot read other users' personal secrets (per-user encryption) |
| Data over-retention | Automated daily retention job purges expired tokens and audit logs older than `AUDIT_LOG_RETENTION_DAYS` |

---

## Authentication Flow

```
┌─────────┐                              ┌─────────┐
│ Browser │                              │  API    │
└────┬────┘                              └────┬────┘
     │  POST /auth/login {email, pass}        │
     │ ─────────────────────────────────────► │  1. Verify password (bcrypt)
     │                                        │  2. Check account lockout
     │                                        │  3. Issue JWT (15 min) + refresh token (7 days)
     │                                        │  4. Set HttpOnly cookie
     │ ◄───────────────────────────────────── │
     │  {accessToken}  +  Set-Cookie          │
     │                                        │
     │  GET /api/v1/projects                  │
     │  Authorization: Bearer <accessToken>   │
     │ ─────────────────────────────────────► │
     │                                        │
     │  [token expires after 15 min]          │
     │                                        │
     │  POST /auth/refresh (cookie sent auto) │
     │ ─────────────────────────────────────► │  1. Validate refresh token
     │                                        │  2. Delete old token (single-use)
     │                                        │  3. Issue new token pair
     │ ◄───────────────────────────────────── │
     │  {accessToken}  +  new Set-Cookie      │
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

