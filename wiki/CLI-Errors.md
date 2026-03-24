# CLI Errors

Errors produced by the `envshare` CLI client. These are network and transport errors — they are not returned by the API but generated locally when the CLI cannot communicate with the server.

---

## URL / configuration errors

### Invalid URL format
**Exit code 1 · HTTP-like status 400**

The configured API URL is not a valid URL.

```
Error: Invalid URL. Use a full URL like http://localhost:3001 or https://secrets.example.com
```

**Fix:** Run `envshare config set-url https://your-server.com`.

---

### URL missing scheme
**Exit code 1 · HTTP-like status 400**

The URL does not start with `http://` or `https://`.

```
Error: URL must start with http:// or https://
```

**Fix:** Include the scheme: `envshare config set-url https://secrets.example.com`.

---

### URL contains path segment
**Exit code 1 · HTTP-like status 400**

The configured URL includes a path like `/api` or `/api/v1`. Only the base origin should be set.

```
Error: Use the server base URL only (without /api or /api/v1 path segments)
```

**Fix:** Strip the path: `envshare config set-url https://secrets.example.com` (no trailing path).

---

### Server health check failed
**Exit code 1 · HTTP-like status 400**

The server at the given URL responded but did not return the expected envShare health payload (`{ status: "ok", service: "envshare-api" }`).

```
Error: Server at https://... did not return the expected envShare health payload.
```

**Possible causes:**
- The URL points to a different service (nginx default page, another API, etc.)
- The server is running but `envShare` is not deployed there.
- A reverse proxy is returning a custom error page instead of forwarding.

---

### Expected endpoints not found
**Exit code 1 · HTTP-like status 400**

The server's health payload was valid but the expected auth routes (`/api/v1/auth/login`, `/api/v1/auth/register`) were not reachable.

```
Error: Server at https://... does not expose the expected envShare auth endpoints.
```

**Fix:** Verify the server version is up to date and the API router is mounted correctly.

---

## Connection errors

### Connection refused
**Exit code 1 · HTTP-like status 503**

The CLI could not establish a TCP connection to the server. The server is likely not running.

```
Error: Cannot connect to http://localhost:3001. Verify the backend is running and reachable.
```

**Error codes mapped:** `ECONNREFUSED`, `ENOTFOUND`, `EAI_AGAIN`

**Fix:**
1. Start the backend: `cd backend && npm run dev` (or `docker compose up`).
2. Verify the URL: `envshare config get-url`.

---

### Connection timeout
**Exit code 1 · HTTP-like status 504**

The TCP connection was established but no response arrived within the timeout window.

```
Error: Connection to https://... timed out. Verify network access and server availability.
```

**Error codes mapped:** `ETIMEDOUT`, `TimeoutError`, `UND_ERR_CONNECT_TIMEOUT`

**Fix:** Check that:
- There is no firewall blocking port 443/80.
- The server is not overloaded.
- A VPN or proxy is not interfering.

---

### Non-HTTP response
**Exit code 1 · HTTP-like status 502**

The server accepted the connection but replied with something that is not HTTP/1.1. Typically a raw TCP service (like PostgreSQL or Redis) is listening on the configured port.

```
Error: Could not talk to https://.... The endpoint answered with a non-HTTP/1.1 stream.
```

**Fix:** Make sure the URL points to the envShare HTTP API, not a database or other service.

---

## TLS / HTTPS errors

### Self-signed certificate
**Exit code 1 · HTTP-like status 495**

The server's TLS certificate is self-signed or signed by an untrusted CA.

```
Error: TLS certificate validation failed for https://.... If using a self-signed cert, either install
the CA into your system trust store or set ENVSHARE_INSECURE=1 (not recommended for production).
```

**Error codes mapped:** `DEPTH_ZERO_SELF_SIGNED_CERT`, `UNABLE_TO_VERIFY_LEAF_SIGNATURE`

**Fix (development):** Set `ENVSHARE_INSECURE=1` in your shell before running CLI commands.
**Fix (production):** Use a certificate from a trusted CA (Let's Encrypt is free).

---

## Session errors

### Not authenticated
**Exit code 1 · HTTP-like status 401**

The CLI has no stored refresh token. You need to log in first.

```
Error: Not authenticated. Run: envshare login
```

**Fix:** `envshare login`

---

### Session expired
**Exit code 1 · HTTP-like status 401**

The stored refresh token has expired or been revoked by the server.

```
Error: Session expired. Please login again: envshare login
```

**Fix:** `envshare login`

---

### Invalid refresh response
**Exit code 1 · HTTP-like status 502**

The server returned a 200 on the token refresh endpoint but the response body was missing the expected `accessToken` or `refreshToken` fields. This indicates a server-side bug.

```
Error: Server returned an invalid refresh response.
```

---

### Non-JSON response
**Exit code 1 · HTTP-like status 502**

The server returned a non-JSON body for an API request. This usually means the URL points to a static file server, a different application, or a misconfigured reverse proxy.

```
Error: Server returned a non-JSON response. Check if the URL points to envShare API.
```

---

## Common CLI error scenarios

### `envshare push` fails with `FORBIDDEN_ROLE`

Your account is a VIEWER. Only DEVELOPER and ADMIN can push secrets. Ask a project ADMIN to promote your role.

### `envshare pull` refuses to write a file

The server-provided `filePath` resolves to a location outside the current working directory. This is a path-traversal protection. Use a server you trust.

### `envshare push` — `SECRET_IS_SHARED`

A variable that was previously pushed as `# @shared` is now being pushed without that annotation. The backend automatically handles this since version 1.0.7 by syncing the `isShared` flag. If you still see this error, update your CLI.

### `envshare update` — many unexpected files appear

Only `.env`, `.env.local`, `.env.production`, etc. are listed. Files like `.env.template`, `.env.example`, `.env.bak` are excluded. Directories named `docker`, `node_modules`, `dist`, `.git` etc. are skipped entirely.
