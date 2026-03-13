# Security Architecture — envShare

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

## Key Management

| Key | Storage | Rotation |
|-----|---------|----------|
| MASTER_ENCRYPTION_KEY | Environment variable / KMS | Re-encrypt all project keys |
| Project Key | DB (wrapped by master key) | Re-encrypt all secrets in project |
| JWT_SECRET | Environment variable | Invalidates all sessions |

## Recommendations

1. **Store MASTER_ENCRYPTION_KEY in a KMS** (AWS KMS, HashiCorp Vault, GCP Secret Manager).
   Never store it in the database or commit it to source control.

2. **Enable database encryption at rest** (PostgreSQL with pgcrypto extension or cloud-managed TLS).

3. **Use TLS in production** — configure your reverse proxy (nginx, Caddy) with valid certificates.

4. **Rotate the MASTER_ENCRYPTION_KEY periodically** — implement a key rotation job that:
   - Decrypts each project key with the old master key
   - Re-encrypts with the new master key
   - Atomic swap in the DB (transaction)

5. **Audit logs** — every secret read/write/delete is logged with actor, IP, timestamp.

6. **Rate limiting** — auth endpoints are limited to 10 req/15min per IP.

7. **Minimum password length** — enforced at 12 characters.

8. **Refresh token rotation** — each refresh token is single-use; invalidated on use.

## Threat Model

| Threat | Mitigation |
|--------|-----------|
| DB compromise | Secrets are AES-256-GCM encrypted; master key not in DB |
| Token theft | Short-lived access tokens (15min); refresh token rotation |
| Brute force | bcrypt(12) + rate limiting |
| MITM | TLS in transit; HSTS headers |
| Secret leakage in logs | Values never logged; only key names in audit logs |
| Replay attacks | GCM auth tags; refresh token single-use |
