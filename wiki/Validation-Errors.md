# Validation Errors

All input validation is done with Zod. When a request body or query string fails validation, the server returns `VALIDATION_ERROR` with field-level details.

---

## Response format

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

Multiple fields can fail at once — all are reported in `fields`.

---

## Field rules by endpoint

### `POST /api/v1/auth/register`

| Field | Type | Rules |
|-------|------|-------|
| `email` | string | Must be a valid email address |
| `password` | string | Minimum **12 characters** |
| `name` | string | 2–100 characters |
| `consent` | literal | Must be exactly `true` |

> **Note:** The CLI also validates password length client-side before sending the request, showing a clear error before the API call is made.

---

### `POST /api/v1/auth/login`

| Field | Type | Rules |
|-------|------|-------|
| `email` | string | Valid email format |
| `password` | string | At least 1 character |

---

### `PATCH /api/v1/account/password`

| Field | Type | Rules |
|-------|------|-------|
| `currentPassword` | string | At least 1 character |
| `newPassword` | string | Minimum **12 characters** |

---

### `POST /api/v1/projects`

| Field | Type | Rules |
|-------|------|-------|
| `name` | string | 2–100 characters |
| `slug` | string | 2–100 characters, lowercase alphanumeric and hyphens only (`^[a-z0-9-]+$`) |

---

### `POST /api/v1/projects/:id/members`

| Field | Type | Rules |
|-------|------|-------|
| `email` | string | Valid email format |
| `role` | enum | One of `ADMIN`, `DEVELOPER`, `VIEWER` (default: `DEVELOPER`) |

---

### `PATCH /api/v1/projects/:id/members/:userId`

| Field | Type | Rules |
|-------|------|-------|
| `role` | enum | One of `ADMIN`, `DEVELOPER`, `VIEWER` |

---

### `POST /api/v1/projects/:id/environments`

| Field | Type | Rules |
|-------|------|-------|
| `name` | string | 1–64 characters |
| `filePath` | string | 1–255 characters |
| `description` | string | Optional, max 255 characters |

---

### `POST /api/v1/sync/:id/push`

| Field | Type | Rules |
|-------|------|-------|
| `secrets` | array | Array of `{ key, value, isShared }` |
| `secrets[].key` | string | Non-empty string |
| `secrets[].value` | string | Any string (including empty) |
| `secrets[].isShared` | boolean | `true` or `false` |
| `filePath` | string | Optional |
| `environmentName` | string | Optional |

---

### `GET /api/v1/audit`

Query parameters:

| Parameter | Type | Rules |
|-----------|------|-------|
| `limit` | integer | 1–200 (default: 50) |
| `offset` | integer | ≥ 0 (default: 0) |
| `from` | date string | Optional ISO date |
| `to` | date string | Optional ISO date |

> **CLI note:** The CLI validates `--from` and `--to` date arguments before sending the request, exiting with a user-friendly error if the date is unparseable.

---

## Common validation mistakes

| Mistake | Error message |
|---------|---------------|
| Password too short | `password: String must contain at least 12 character(s)` |
| Missing `consent` field | `AUTH_GDPR_REQUIRED` (separate code, not `VALIDATION_ERROR`) |
| Invalid email | `email: Invalid email` |
| Role not recognised | `role: Invalid enum value. Expected 'ADMIN' \| 'DEVELOPER' \| 'VIEWER'` |
| Slug with uppercase or spaces | `slug: Invalid` |
| Audit `limit` out of range | `limit: Number must be less than or equal to 200` |
