# Auth Errors

All errors related to registration, login, session management, and account security.

---

| Code | HTTP | When |
|------|------|------|
| `AUTH_EMAIL_TAKEN` | 409 | Email already registered |
| `AUTH_INVALID_CREDENTIALS` | 401 | Wrong email/password, or wrong current password on change |
| `AUTH_TOKEN_MISSING` | 401 | Refresh request sent without a token |
| `AUTH_REFRESH_INVALID` | 401 | Refresh token expired or revoked |
| `AUTH_ACCOUNT_LOCKED` | 423 | 10 failed logins in a row |
| `AUTH_PASSWORD_REUSE` | 400 | New password identical to current |
| `AUTH_GDPR_REQUIRED` | 400 | `consent: true` missing from register body |

---

## Registration flow

```
POST /api/v1/auth/register
{
  "email": "alice@example.com",
  "password": "MySecurePass123!",
  "name": "Alice",
  "consent": true
}
```

**Possible errors:**

- `VALIDATION_ERROR` (400) — email not valid, password < 12 chars, name < 2 chars, consent not exactly `true`.
- `AUTH_GDPR_REQUIRED` (400) — `consent` field was omitted or set to anything other than `true`.
- `AUTH_EMAIL_TAKEN` (409) — the email already has an account.

---

## Login flow

```
POST /api/v1/auth/login
{ "email": "alice@example.com", "password": "MySecurePass123!" }
```

**Possible errors:**

- `VALIDATION_ERROR` (400) — missing or malformed fields.
- `AUTH_INVALID_CREDENTIALS` (401) — wrong email or password. The error message is intentionally vague to prevent user enumeration.
- `AUTH_ACCOUNT_LOCKED` (423) — too many failed attempts. The error message includes how many minutes remain.

**Lockout policy:**
- Triggered after **10 consecutive** failed attempts.
- Lock duration: **15 minutes** from the last failed attempt.
- Successful login resets the counter.

---

## Token refresh flow

Access tokens are short-lived. The CLI automatically refreshes them when it receives a 401.

```
POST /api/v1/auth/refresh
Cookie: refreshToken=<token>
```

**Possible errors:**

- `AUTH_TOKEN_MISSING` (401) — the `refreshToken` cookie was not sent.
- `AUTH_REFRESH_INVALID` (401) — the token is expired, was invalidated by logout, or is malformed.

When the CLI receives `AUTH_REFRESH_INVALID` it deletes the stored token and prompts:
```
Error: Session expired. Please login again: envshare login
```

---

## Password change

```
PATCH /api/v1/account/password
{
  "currentPassword": "OldPass123!",
  "newPassword": "NewPass456!"
}
```

**Possible errors:**

- `AUTH_INVALID_CREDENTIALS` (400) — `currentPassword` is wrong.
- `AUTH_PASSWORD_REUSE` (400) — `newPassword` is the same as `currentPassword`.
- `VALIDATION_ERROR` (400) — `newPassword` is shorter than 12 characters.
