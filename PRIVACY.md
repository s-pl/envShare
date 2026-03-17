# Privacy Policy & Data Processing Register — envShare

> **Version:** 1.0  
> **Effective date:** 18 March 2026  
> **Applicable law:** EU GDPR (Regulation 2016/679) · UK Data Protection Act 2018 (UK GDPR)  
> **Contact:** privacy@envshare.example.com  
> **DPO:** dpo@envshare.example.com

---

## Plain-English Summary

envShare stores only the personal data strictly necessary to run the service.  
We do **not** sell data, share it with advertisers, or use it for profiling.  
You can **export or delete all your data** at any time from Account Settings.

---

## 1. Data Controller

**envShare** is the data controller responsible for personal data processed through this platform.

> **Self-hosted note:** If you are running this software on your own infrastructure for
> your organisation, *your organisation* is the data controller. You must issue your
> own privacy notice to your users and ensure you have a lawful basis for processing.

---

## 2. Personal Data We Collect

| Category | Fields | Purpose | Legal Basis |
|----------|--------|---------|-------------|
| **Identity** | `name`, `email` | Account identification | Art. 6(1)(b) — contract |
| **Credentials** | `passwordHash` (bcrypt 12 rounds) | Authentication | Art. 6(1)(b) — contract |
| **Consent record** | `consentedAt` timestamp | Prove informed consent | Art. 6(1)(c) — legal obligation |
| **Network / device** | IP address, User-Agent string | Security monitoring, account lockout, fraud detection | Art. 6(1)(f) — legitimate interests |
| **Session** | `refresh_token` (HttpOnly cookie) | Maintain authenticated session | Art. 6(1)(b) — contract |
| **Secret key names** | Encrypted key names (e.g. `DATABASE_URL`) | Core service function | Art. 6(1)(b) — contract |
| **Audit log entries** | Action, actor ID, resource ID, timestamp, IP, UA | Security trail (ISO 27001 A.12.4.1) | Art. 6(1)(f) — legitimate interests |

### Data NOT collected

- Secret **values** are AES-256-GCM encrypted; neither we nor the database can read them.
- We do **not** collect: location data, payment information, browser history, device fingerprints,
  analytics/telemetry, advertising identifiers, or social-network data.

---

## 3. Legitimate Interests Assessment (LIA)

For processing under Art. 6(1)(f) (IP addresses, User-Agent strings, failed-login logs):

| Test | Assessment |
|------|-----------|
| **Purpose test** | Detecting brute-force attacks, preventing account takeovers, security incident response. These are genuine legitimate interests. |
| **Necessity test** | IP addresses are the minimum data required to enforce rate-limiting and account lockout per-account and per-IP. User-Agents are required to display active sessions. There is no less-intrusive alternative. |
| **Balancing test** | Interests do not override data-subject rights because: (1) data is used solely for security, never for profiling or marketing; (2) retention is capped at 365 days; (3) users can request erasure at any time; (4) data subjects have a reasonable expectation that a security-sensitive platform logs access attempts. |
| **Conclusion** | Legitimate interests **prevail**. |

---

## 4. Data Retention Periods

| Data | Retention | Trigger for deletion |
|------|-----------|----------------------|
| Account data (name, email, password hash) | Until account deletion | User-initiated (Art. 17) or operator purge |
| Refresh tokens | 7 days from issuance | Automatic daily purge of expired tokens |
| Audit logs (IP, UA included) | 365 days (configurable via `AUDIT_LOG_RETENTION_DAYS`) | Automatic daily purge |
| Anonymised audit logs (post-deletion) | Indefinite | Actor replaced with `[deleted]`; IP/UA erased at time of account deletion |
| Secret key names + encrypted values | Until secret or project is deleted | User-initiated |
| Failed-login counters | Cleared on successful login or after lockout expiry | Automatic |

---

## 5. Cookies

| Name | Type | Duration | Purpose |
|------|------|----------|---------|
| `refresh_token` | Strictly necessary, HttpOnly, Secure, SameSite=Strict | 7 days (rolling) | Authenticated session management |

**No** analytics, advertising, tracking, or third-party cookies are used.

The `refresh_token` cookie is **strictly necessary** and is exempt from prior-consent requirements
under ICO guidance and UK PECR Regulation 6(1). Users are informed of its existence via the
in-app cookie notice on first visit.

The access token (JWT) is stored **in JavaScript memory only** — it is never written to
`localStorage`, `sessionStorage`, or any cookie.

---

## 6. Data Subject Rights

All rights can be exercised from **Account Settings → Data & Privacy** in the web dashboard,
or by emailing privacy@envshare.example.com.

| Right | GDPR Article | How exercised | SLA |
|-------|-------------|--------------|-----|
| Access | Art. 15 | Account Settings → "Download data export" (JSON) | Instant |
| Rectification | Art. 16 | Account Settings → update name | Instant |
| Erasure | Art. 17 | Account Settings → "Delete my account" | Instant |
| Restriction | Art. 18 | Email privacy@envshare.example.com | 30 days |
| Portability | Art. 20 | Account Settings → "Download data export" (JSON) | Instant |
| Object | Art. 21 | Email privacy@envshare.example.com | 30 days |
| Withdraw consent | Art. 7(3) | Delete account (triggers full erasure) | Instant |

### Right to Erasure — implementation detail

When a user deletes their account (Art. 17), the following happens atomically:

1. `AuditLog` rows where `actor = userId` are updated:  
   - `actor` → `"[deleted]"` (audit timeline preserved for ISO 27001 compliance — Art. 17(3)(b))  
   - `ipAddress` → `NULL` (personal data erased immediately)  
   - `userAgent` → `NULL` (personal data erased immediately)

2. `User` row is deleted, which cascades to:
   - `RefreshToken` (all active sessions)
   - `UserSecretValue` (all personal secret values)
   - `ProjectMember` (all project memberships)
   - `SecretVersion` (actor set to `NULL` via `onDelete: SetNull`)

3. A final `AuditLog` entry is created with `actor = "system"` to record the erasure event.

**What is NOT deleted:** Projects and their shared secrets. These belong to the organisation,
not the individual. The user is removed as a member; if they were the only ADMIN the project
is orphaned (users are warned to transfer admin rights before deleting).

---

## 7. Security Measures (GDPR Art. 32)

| Measure | Detail |
|---------|--------|
| Encryption at rest | AES-256-GCM per-secret. Master key never in DB. Per-secret random IVs. GCM auth tags prevent tampering. |
| Encryption in transit | HTTPS/TLS 1.2+ required in production. HSTS with `max-age=31536000; includeSubDomains; preload`. |
| Password hashing | bcrypt, 12 rounds. Plaintext never stored or logged. |
| Access tokens | JWT, 15-minute expiry, stored in JS memory only. |
| Refresh tokens | Single-use rotation. 7-day expiry. Stored as HttpOnly, Secure, SameSite=Strict cookie. |
| Account lockout | Locked after 10 consecutive failed logins for 30 minutes (ISO 27001 A.9.4.2). |
| Rate limiting | Auth endpoints: 20 req / 15 min per IP. Global: 500 req / 15 min per IP. |
| Audit logging | All security-relevant events logged with actor, action, timestamp, IP, UA. |
| Security headers | Helmet.js: CSP, HSTS, X-Frame-Options: DENY, X-Content-Type-Options: nosniff, Referrer-Policy. |
| RBAC | Project roles: ADMIN, DEVELOPER, VIEWER. All endpoints enforce role checks. |
| Trust proxy | `app.set('trust proxy', 1)` — correct IP resolution when behind nginx/Caddy. |

---

## 8. Data Breach Notification (Art. 33–34)

In the event of a personal data breach:

1. **Within 72 hours** of becoming aware: notify the relevant supervisory authority (Art. 33).  
2. **Without undue delay**: notify affected data subjects if the breach is likely to result in a
   high risk to their rights and freedoms (Art. 34).  
3. **Internal**: log the breach, its scope, likely impact, and remediation steps.

---

## 9. Data Transfers

envShare is self-hosted. Data resides on the infrastructure the operator configures.

- If that infrastructure is in the **UK or EEA**, no transfer safeguards are required.
- If that infrastructure is **outside the UK or EEA**, the operator must ensure an adequate level
  of protection (e.g. UK IDTA, EU Standard Contractual Clauses, adequacy decision — Art. 46).

---

## 10. Records of Processing Activities (ROPA — Art. 30)

| Activity | Controller | Processor | Categories | Legal basis | Retention | Transfer |
|----------|-----------|---------|-----------|-------------|---------|---------|
| User registration & authentication | envShare operator | Infrastructure provider | Identity, credentials, consent timestamp | 6(1)(b) + 6(1)(c) | Until deletion | EEA/UK infra |
| Session management | envShare operator | Infrastructure provider | Session token, IP, UA | 6(1)(b) | 7 days | EEA/UK infra |
| Secret storage | envShare operator | Infrastructure provider | Encrypted secret key names + values | 6(1)(b) | Until deleted | EEA/UK infra |
| Security logging | envShare operator | Infrastructure provider | IP, UA, action, actor | 6(1)(f) | 365 days | EEA/UK infra |
| Audit trail | envShare operator | Infrastructure provider | Actor ID, action, resource, timestamp | 6(1)(f) + 6(1)(c) | 365 days (anonymised thereafter) | EEA/UK infra |

---

## 11. Children's Data

envShare is a professional developer tool. We do not knowingly collect data from individuals
under **16 years of age**. If you become aware of such data having been collected, please
contact privacy@envshare.example.com and we will delete it without delay.

---

## 12. Changes to This Policy

Material changes will be announced in the application at least **14 days** before taking effect.
The `LAST_UPDATED` constant in `frontend/src/pages/PrivacyPage.tsx` must be updated with each
release. Version history is maintained in Git.

---

## 13. Contact & Supervisory Authority

**DPO:** dpo@envshare.example.com  
**General:** privacy@envshare.example.com

**UK:** [Information Commissioner's Office (ICO)](https://ico.org.uk/make-a-complaint/)  
**EU:** [European Data Protection Board — member DPAs](https://edpb.europa.eu/about-edpb/about-edpb/members_en)