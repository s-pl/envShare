# envShare Documentation

Self-hosted secret management for development teams. This wiki covers everything from first-time setup to the complete API error reference.

---

## Pages

| Page | What it covers |
|------|----------------|
| [User Guide](User-Guide.md) | Roles, permissions, and day-to-day workflows for ADMIN, DEVELOPER, and VIEWER |
| [Error Reference](Error-Reference.md) | Every error code — HTTP status, cause, and fix |
| [Auth Errors](Auth-Errors.md) | Registration, login, tokens, account lockout |
| [Permission Errors](Permission-Errors.md) | Project roles, RBAC, forbidden operations |
| [Resource Errors](Resource-Errors.md) | Not found, conflicts, last-item protection |
| [Validation Errors](Validation-Errors.md) | Input validation and schema rules |
| [Server Errors](Server-Errors.md) | Encryption, database, configuration |
| [CLI Errors](CLI-Errors.md) | Network, TLS, connection, and URL errors from the CLI |
| [Troubleshooting](Troubleshooting.md) | Common problems and step-by-step fixes |

---

## API error format

All API errors return a consistent JSON shape:

```json
{
  "error": "Human-readable message",
  "code":  "MACHINE_READABLE_CODE",
  "status": 400
}
```

Validation errors also include a `fields` array describing which inputs failed:

```json
{
  "error":  "password: String must contain at least 12 character(s)",
  "code":   "VALIDATION_ERROR",
  "status": 400,
  "fields": [
    { "field": "password", "message": "String must contain at least 12 character(s)" }
  ]
}
```

---

## Error code quick reference

### Auth

| Code | HTTP | Description |
|------|:----:|-------------|
| `AUTH_EMAIL_TAKEN` | 409 | Email already registered |
| `AUTH_INVALID_CREDENTIALS` | 401 | Wrong email or password |
| `AUTH_TOKEN_MISSING` | 401 | No Authorization header or refresh token |
| `AUTH_TOKEN_INVALID` | 401 | Token malformed or expired |
| `AUTH_REFRESH_INVALID` | 401 | Refresh token not found or already used |
| `AUTH_ACCOUNT_LOCKED` | 423 | Too many failed logins — wait 30 minutes |
| `AUTH_PASSWORD_REUSE` | 400 | New password must differ from current |
| `AUTH_GDPR_REQUIRED` | 400 | Privacy Policy consent required at registration |

### Access control

| Code | HTTP | Description |
|------|:----:|-------------|
| `FORBIDDEN` | 403 | Not a member of this project |
| `FORBIDDEN_ROLE` | 403 | Role too low for this operation |
| `SELF_ROLE_CHANGE` | 400 | Cannot change your own role |
| `LAST_ADMIN` | 400 | Removing this member would leave the project without an ADMIN |
| `MEMBER_ALREADY_EXISTS` | 409 | User is already a member of this project |

### Resources

| Code | HTTP | Description |
|------|:----:|-------------|
| `NOT_FOUND` | 404 | Resource not found |
| `PROJECT_NOT_FOUND` | 404 | Project does not exist |
| `SECRET_NOT_FOUND` | 404 | Secret does not exist |
| `SECRET_IS_SHARED` | 400 | Cannot set a personal value on a shared secret |
| `ENV_NOT_FOUND` | 404 | Environment does not exist |
| `ENV_LAST_REMAINING` | 400 | Cannot delete the only environment in a project |

### Validation & server

| Code | HTTP | Description |
|------|:----:|-------------|
| `VALIDATION_ERROR` | 400 | Invalid request body — see `fields` for details |
| `DB_CONSTRAINT` | 409 | Unique or foreign-key constraint violated |
| `DB_NOT_FOUND` | 404 | Prisma record not found |
| `DB_UNAVAILABLE` | 503 | Database unreachable |
| `ENCRYPTION_FAILED` | 500 | AES-GCM decryption failed (wrong key or tampered data) |
| `CONFIG_MISSING_KEY` | 500 | Required environment variable not set on the server |
| `CONFIG_INVALID_KEY` | 500 | Environment variable has an invalid format |
| `INTERNAL` | 500 | Unexpected server error |
