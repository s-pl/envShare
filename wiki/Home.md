# envShare Wiki

Welcome to the envShare documentation.

## Pages

| Page | Description |
|------|-------------|
| [Error Reference](Error-Reference) | Complete list of all error codes with HTTP status, causes and fixes |
| [Auth Errors](Auth-Errors) | Registration, login, tokens, account lockout |
| [Permission Errors](Permission-Errors) | Project roles, RBAC, forbidden operations |
| [Resource Errors](Resource-Errors) | Not found, conflicts, last-item protection |
| [Validation Errors](Validation-Errors) | Input validation, schema rules |
| [Server Errors](Server-Errors) | Encryption, database, configuration |
| [CLI Errors](CLI-Errors) | Network, TLS, connection, URL errors from the CLI |
| [Troubleshooting](Troubleshooting) | Common problems and step-by-step fixes |

## Error response format

All API errors follow this JSON shape:

```json
{
  "error": "Human-readable message",
  "code": "MACHINE_READABLE_CODE",
  "status": 400
}
```

Validation errors also include a `fields` array:

```json
{
  "error": "password: String must contain at least 12 character(s)",
  "code": "VALIDATION_ERROR",
  "status": 400,
  "fields": [
    { "field": "password", "message": "String must contain at least 12 character(s)" }
  ]
}
```

## Quick lookup

| Code | HTTP | Short description |
|------|------|-------------------|
| `AUTH_EMAIL_TAKEN` | 409 | Email already registered |
| `AUTH_INVALID_CREDENTIALS` | 401 | Wrong email or password |
| `AUTH_TOKEN_MISSING` | 401 | No refresh token |
| `AUTH_REFRESH_INVALID` | 401 | Session expired |
| `AUTH_ACCOUNT_LOCKED` | 423 | Too many failed logins |
| `AUTH_PASSWORD_REUSE` | 400 | New password same as current |
| `AUTH_GDPR_REQUIRED` | 400 | Privacy policy not accepted |
| `FORBIDDEN` | 403 | Not a project member |
| `FORBIDDEN_ROLE` | 403 | Role too low for this action |
| `SELF_ROLE_CHANGE` | 400 | Cannot change your own role |
| `LAST_ADMIN` | 400 | Would orphan the project |
| `MEMBER_ALREADY_EXISTS` | 409 | User already in project |
| `VALIDATION_ERROR` | 400 | Invalid request body |
| `NOT_FOUND` | 404 | Generic resource not found |
| `PROJECT_NOT_FOUND` | 404 | Project does not exist |
| `SECRET_NOT_FOUND` | 404 | Secret does not exist |
| `SECRET_IS_SHARED` | 400 | Cannot set personal value on a shared secret |
| `ENV_NOT_FOUND` | 404 | Environment does not exist |
| `ENV_LAST_REMAINING` | 400 | Cannot delete the only environment |
| `DB_CONSTRAINT` | 409 | Unique or FK constraint violated |
| `DB_NOT_FOUND` | 404 | Prisma record not found |
| `DB_UNAVAILABLE` | 503 | Database unreachable |
| `ENCRYPTION_FAILED` | 500 | AES-GCM decryption error |
| `CONFIG_MISSING_KEY` | 500 | Required env var not set |
| `CONFIG_INVALID_KEY` | 500 | Env var has invalid format |
| `INTERNAL` | 500 | Unexpected server error |
