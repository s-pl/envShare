import { Shield, ArrowLeft, ExternalLink } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "../components/ui/button";

const LAST_UPDATED = "18 March 2026";
const CONTROLLER_NAME = "envShare";
const CONTACT_EMAIL = "privacy@envshare.example.com";
const DPO_EMAIL = "dpo@envshare.example.com";

function Section({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-20 space-y-3">
      <h2 className="text-base font-bold text-foreground border-b border-border/60 pb-2">
        {title}
      </h2>
      <div className="space-y-3 text-sm text-muted-foreground leading-relaxed">
        {children}
      </div>
    </section>
  );
}

function TableRow({ cells }: { cells: React.ReactNode[] }) {
  return (
    <tr className="border-b border-border/40 last:border-0">
      {cells.map((cell, i) => (
        <td
          key={i}
          className={`py-2.5 px-3 text-xs align-top ${i === 0 ? "font-medium text-foreground w-1/4" : "text-muted-foreground"}`}
        >
          {cell}
        </td>
      ))}
    </tr>
  );
}

const TOC = [
  { id: "who-we-are", label: "1. Who we are" },
  { id: "what-data", label: "2. Data we collect" },
  { id: "legal-basis", label: "3. Legal basis" },
  { id: "how-we-use", label: "4. How we use your data" },
  { id: "cookies", label: "5. Cookies" },
  { id: "retention", label: "6. Retention periods" },
  { id: "sharing", label: "7. Sharing & transfers" },
  { id: "rights", label: "8. Your rights" },
  { id: "security", label: "9. Security" },
  { id: "children", label: "10. Children" },
  { id: "changes", label: "11. Changes to this policy" },
  { id: "contact", label: "12. Contact & complaints" },
];

export function PrivacyPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      {/* ── Header ── */}
      <header className="sticky top-0 z-20 border-b border-border/60 bg-card/90 backdrop-blur-md">
        <div className="max-w-4xl mx-auto px-6 h-14 flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate(-1)}
            className="h-8 gap-1.5 text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span className="text-xs">Back</span>
          </Button>

          <div className="flex items-center gap-2 ml-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10">
              <Shield className="h-3.5 w-3.5 text-primary" />
            </div>
            <span className="font-semibold text-sm text-foreground">
              Privacy Policy
            </span>
          </div>

          <span className="ml-auto text-[11px] text-muted-foreground hidden sm:block">
            Last updated: {LAST_UPDATED}
          </span>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-6 py-10 lg:grid lg:grid-cols-[220px_1fr] lg:gap-12">
        {/* ── Sidebar TOC ── */}
        <aside className="hidden lg:block">
          <div className="sticky top-20 space-y-1">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/60 mb-3">
              Contents
            </p>
            {TOC.map(({ id, label }) => (
              <a
                key={id}
                href={`#${id}`}
                className="
                  block text-xs text-muted-foreground hover:text-foreground
                  hover:underline underline-offset-2 transition-colors py-0.5
                "
              >
                {label}
              </a>
            ))}
          </div>
        </aside>

        {/* ── Main content ── */}
        <main className="space-y-10 animate-fade-in">
          {/* Title */}
          <div className="space-y-2">
            <h1 className="text-2xl font-bold text-foreground tracking-tight">
              Privacy Policy
            </h1>
            <p className="text-xs text-muted-foreground">
              Last updated:{" "}
              <strong className="text-foreground">{LAST_UPDATED}</strong>
              {" · "}
              Effective immediately upon publication.
            </p>
            <div className="rounded-xl border border-primary/20 bg-primary/5 px-4 py-3 mt-4">
              <p className="text-xs text-muted-foreground leading-relaxed">
                <span className="font-semibold text-foreground">
                  Summary (plain English):
                </span>{" "}
                envShare stores only the personal data strictly necessary to run
                the service. We do not sell your data, share it with
                advertisers, or use it for profiling. You can export or delete
                all your data at any time from Account Settings. This policy
                complies with the{" "}
                <strong className="text-foreground">
                  EU General Data Protection Regulation (GDPR)
                </strong>{" "}
                and the{" "}
                <strong className="text-foreground">
                  UK Data Protection Act 2018 (UK GDPR)
                </strong>
                .
              </p>
            </div>
          </div>

          {/* 1 */}
          <Section id="who-we-are" title="1. Who we are (Data Controller)">
            <p>
              <strong className="text-foreground">{CONTROLLER_NAME}</strong> is
              the data controller responsible for your personal data. References
              to <em>"we"</em>, <em>"us"</em>, or <em>"our"</em> throughout this
              policy refer to {CONTROLLER_NAME}.
            </p>
            <p>
              envShare is a self-hosted secrets-management platform that allows
              teams to share environment variables securely. All data is stored
              on the infrastructure you (the operator) control. If you are using
              a hosted instance operated by a third party, that third party is
              the data controller for the purposes of this policy, and you
              should request their privacy policy.
            </p>
            <p>
              <span className="font-medium text-foreground">
                Data Protection Officer (DPO):
              </span>{" "}
              <a
                href={`mailto:${DPO_EMAIL}`}
                className="text-primary underline underline-offset-2 hover:text-primary/80"
              >
                {DPO_EMAIL}
              </a>
            </p>
            <p>
              <span className="font-medium text-foreground">
                General privacy enquiries:
              </span>{" "}
              <a
                href={`mailto:${CONTACT_EMAIL}`}
                className="text-primary underline underline-offset-2 hover:text-primary/80"
              >
                {CONTACT_EMAIL}
              </a>
            </p>
          </Section>

          {/* 2 */}
          <Section id="what-data" title="2. Personal data we collect">
            <p>
              We collect only the data necessary to provide the service (data
              minimisation — GDPR Art. 5(1)(c) / UK GDPR Art. 5(1)(c)).
            </p>

            <div className="overflow-hidden rounded-lg border border-border/60">
              <table className="w-full">
                <thead>
                  <tr className="bg-muted/50 text-left">
                    <th className="py-2.5 px-3 text-xs font-semibold text-foreground">
                      Data
                    </th>
                    <th className="py-2.5 px-3 text-xs font-semibold text-foreground">
                      Purpose
                    </th>
                    <th className="py-2.5 px-3 text-xs font-semibold text-foreground">
                      Source
                    </th>
                  </tr>
                </thead>
                <tbody>
                  <TableRow
                    cells={[
                      "Name & email address",
                      "Account identification, communication about the service.",
                      "Provided by you at registration.",
                    ]}
                  />
                  <TableRow
                    cells={[
                      "Password (hashed)",
                      "Authentication. We store only a bcrypt(12) hash — the plaintext is never stored.",
                      "Provided by you at registration or password change.",
                    ]}
                  />
                  <TableRow
                    cells={[
                      "Consent timestamp",
                      "Record that you accepted this Privacy Policy (GDPR Art. 7 compliance).",
                      "Recorded automatically at registration.",
                    ]}
                  />
                  <TableRow
                    cells={[
                      "IP address",
                      "Security monitoring, fraud detection, account-lockout enforcement (ISO 27001 A.12.4.1). Never used for profiling or advertising.",
                      "Captured automatically from each HTTP request.",
                    ]}
                  />
                  <TableRow
                    cells={[
                      "User-Agent string",
                      'Session display ("Chrome on macOS"), security anomaly detection.',
                      "Sent automatically by your browser or CLI client.",
                    ]}
                  />
                  <TableRow
                    cells={[
                      "Secret key names",
                      "Core service function — the names of environment variables you manage (e.g. DATABASE_URL). Values are encrypted; only key names appear in data exports.",
                      "Uploaded by you via the dashboard or CLI.",
                    ]}
                  />
                  <TableRow
                    cells={[
                      "Audit log entries",
                      "Compliance, security monitoring, incident response (ISO 27001 A.12.4.1). Includes action, actor ID, resource ID, timestamp, IP, and User-Agent.",
                      "Generated automatically on every security-relevant action.",
                    ]}
                  />
                  <TableRow
                    cells={[
                      "Session token (refresh_token cookie)",
                      "Maintains authenticated sessions without repeated password entry. HttpOnly — inaccessible to JavaScript.",
                      "Issued by the server on login and rotated on every use.",
                    ]}
                  />
                </tbody>
              </table>
            </div>

            <p>
              <strong className="text-foreground">Secret values</strong> (the
              actual content of your environment variables) are encrypted with
              AES-256-GCM using a key that is never stored in the database.
              Secret values are{" "}
              <strong className="text-foreground">not personal data</strong>{" "}
              under GDPR and are excluded from data exports. They cannot be read
              by us even if we had access to the database.
            </p>
          </Section>

          {/* 3 */}
          <Section id="legal-basis" title="3. Legal basis for processing">
            <p>
              We rely on the following legal bases under GDPR Art. 6 / UK GDPR
              Art. 6:
            </p>

            <div className="overflow-hidden rounded-lg border border-border/60">
              <table className="w-full">
                <thead>
                  <tr className="bg-muted/50 text-left">
                    <th className="py-2.5 px-3 text-xs font-semibold text-foreground">
                      Processing activity
                    </th>
                    <th className="py-2.5 px-3 text-xs font-semibold text-foreground">
                      Legal basis
                    </th>
                  </tr>
                </thead>
                <tbody>
                  <TableRow
                    cells={[
                      "Account creation and authentication",
                      "Art. 6(1)(b) — Performance of a contract (providing the service you signed up for).",
                    ]}
                  />
                  <TableRow
                    cells={[
                      "Storing and displaying name & email",
                      "Art. 6(1)(b) — Contractual necessity.",
                    ]}
                  />
                  <TableRow
                    cells={[
                      "Recording GDPR consent timestamp",
                      "Art. 6(1)(c) — Legal obligation (Art. 7(1) requires us to demonstrate consent).",
                    ]}
                  />
                  <TableRow
                    cells={[
                      "IP address and User-Agent in audit logs and session records",
                      "Art. 6(1)(f) — Legitimate interests: detecting and preventing unauthorised access, fraud, and abuse. We have conducted a legitimate-interests assessment (LIA) and concluded these interests are not overridden by your rights because: the data is used solely for security purposes, not for profiling or marketing; retention is time-limited (365 days); and you can request erasure at any time.",
                    ]}
                  />
                  <TableRow
                    cells={[
                      "Failed login attempt logging",
                      "Art. 6(1)(f) — Legitimate interests: protecting user accounts from brute-force attacks.",
                    ]}
                  />
                  <TableRow
                    cells={[
                      "Retaining anonymised audit logs after account deletion",
                      "Art. 6(1)(c) + Art. 17(3)(b) — Legal obligation / public interest: maintaining an auditable security record for compliance purposes (ISO 27001, SOC 2).",
                    ]}
                  />
                </tbody>
              </table>
            </div>
          </Section>

          {/* 4 */}
          <Section id="how-we-use" title="4. How we use your data">
            <p>
              Your personal data is used exclusively for the following purposes:
            </p>
            <ul className="list-disc list-inside space-y-1.5 pl-2">
              <li>
                Creating and managing your account and project memberships.
              </li>
              <li>Authenticating your identity when you sign in.</li>
              <li>
                Enforcing access-control rules (roles: Admin, Developer,
                Viewer).
              </li>
              <li>
                Encrypting and decrypting secrets associated with your account.
              </li>
              <li>
                Generating the audit trail required by ISO 27001 A.12.4.1.
              </li>
              <li>
                Detecting and preventing brute-force attacks and account
                takeovers.
              </li>
              <li>
                Fulfilling your GDPR data-subject rights (Art. 15, 16, 17, 20).
              </li>
            </ul>
            <p>
              We will <strong className="text-foreground">never</strong>:
            </p>
            <ul className="list-disc list-inside space-y-1.5 pl-2">
              <li>Sell, rent, or trade your personal data to third parties.</li>
              <li>Use your data for advertising or behavioural profiling.</li>
              <li>
                Process your data for automated decision-making with legal or
                similarly significant effects (Art. 22).
              </li>
              <li>
                Send you marketing emails without a separate, explicit opt-in.
              </li>
            </ul>
          </Section>

          {/* 5 */}
          <Section id="cookies" title="5. Cookies and similar technologies">
            <p>
              envShare uses{" "}
              <strong className="text-foreground">one cookie only</strong>:
            </p>

            <div className="overflow-hidden rounded-lg border border-border/60">
              <table className="w-full">
                <thead>
                  <tr className="bg-muted/50 text-left">
                    <th className="py-2.5 px-3 text-xs font-semibold text-foreground">
                      Name
                    </th>
                    <th className="py-2.5 px-3 text-xs font-semibold text-foreground">
                      Type
                    </th>
                    <th className="py-2.5 px-3 text-xs font-semibold text-foreground">
                      Duration
                    </th>
                    <th className="py-2.5 px-3 text-xs font-semibold text-foreground">
                      Purpose
                    </th>
                  </tr>
                </thead>
                <tbody>
                  <TableRow
                    cells={[
                      <code className="font-mono text-[11px]">
                        refresh_token
                      </code>,
                      "Strictly necessary, HttpOnly, Secure, SameSite=Strict",
                      "7 days (rolling)",
                      "Maintains your authenticated session. Without this cookie the service cannot function. You cannot opt out of this cookie while using the service.",
                    ]}
                  />
                </tbody>
              </table>
            </div>

            <p>
              This cookie is{" "}
              <strong className="text-foreground">strictly necessary</strong>{" "}
              and is exempt from prior-consent requirements under ICO guidance
              and PECR Regulation 6(1). We still inform you of its existence via
              the cookie notice shown on your first visit.
            </p>
            <p>
              We do <strong className="text-foreground">not</strong> use
              analytics cookies, tracking pixels, third-party scripts, or any
              other form of persistent tracking technology. The access token
              (JWT) used for API authentication is stored exclusively in
              JavaScript memory and is{" "}
              <strong className="text-foreground">never</strong> written to
              cookies, localStorage, or sessionStorage.
            </p>
          </Section>

          {/* 6 */}
          <Section id="retention" title="6. Data retention periods">
            <p>
              We retain personal data only as long as necessary for the purpose
              for which it was collected (GDPR Art. 5(1)(e) — storage
              limitation).
            </p>

            <div className="overflow-hidden rounded-lg border border-border/60">
              <table className="w-full">
                <thead>
                  <tr className="bg-muted/50 text-left">
                    <th className="py-2.5 px-3 text-xs font-semibold text-foreground">
                      Data
                    </th>
                    <th className="py-2.5 px-3 text-xs font-semibold text-foreground">
                      Retention period
                    </th>
                    <th className="py-2.5 px-3 text-xs font-semibold text-foreground">
                      Basis
                    </th>
                  </tr>
                </thead>
                <tbody>
                  <TableRow
                    cells={[
                      "Account data (name, email, password hash)",
                      "Until account deletion.",
                      "Art. 6(1)(b) — contract.",
                    ]}
                  />
                  <TableRow
                    cells={[
                      "Session tokens (refresh_token)",
                      "7 days from issuance. Expired tokens are purged daily.",
                      "Art. 6(1)(b) — contract.",
                    ]}
                  />
                  <TableRow
                    cells={[
                      "Audit logs (including IP addresses)",
                      "365 days (configurable via AUDIT_LOG_RETENTION_DAYS). Automatically purged.",
                      "Art. 6(1)(f) — legitimate interests (security monitoring).",
                    ]}
                  />
                  <TableRow
                    cells={[
                      "Anonymised audit logs (after account deletion)",
                      'The actor field is replaced with "[deleted]". IP addresses are erased immediately. Anonymised records may be retained indefinitely for compliance.',
                      "Art. 17(3)(b) — legal obligation.",
                    ]}
                  />
                  <TableRow
                    cells={[
                      "Secret key names & encrypted values",
                      "Until the secret or project is deleted.",
                      "Art. 6(1)(b) — contract.",
                    ]}
                  />
                </tbody>
              </table>
            </div>
          </Section>

          {/* 7 */}
          <Section id="sharing" title="7. Sharing and international transfers">
            <p>
              We do <strong className="text-foreground">not share</strong> your
              personal data with any third party, except:
            </p>
            <ul className="list-disc list-inside space-y-1.5 pl-2">
              <li>
                <strong className="text-foreground">
                  Infrastructure providers
                </strong>{" "}
                — the cloud or bare-metal provider hosting the PostgreSQL
                database and application server. These providers process data
                solely on your instructions (data processor relationship under
                Art. 28). Ensure you have a Data Processing Agreement (DPA) in
                place with your infrastructure provider.
              </li>
              <li>
                <strong className="text-foreground">Law enforcement</strong> —
                if required by applicable law or court order, we may disclose
                data to the relevant authorities. We will notify you where
                legally permitted.
              </li>
            </ul>
            <p>
              <strong className="text-foreground">
                International transfers.
              </strong>{" "}
              envShare is self-hosted. Data resides on the infrastructure you
              (the operator) configure. If that infrastructure is located
              outside the UK or EEA, you are responsible for ensuring an
              adequate level of protection (e.g. Standard Contractual Clauses —
              Art. 46 GDPR) for any transfers.
            </p>
          </Section>

          {/* 8 */}
          <Section
            id="rights"
            title="8. Your rights under GDPR and the UK DPA 2018"
          >
            <p>
              You have the following rights in relation to your personal data.
              Most can be exercised instantly from{" "}
              <strong className="text-foreground">
                Account Settings → Data &amp; Privacy
              </strong>
              .
            </p>

            <div className="overflow-hidden rounded-lg border border-border/60">
              <table className="w-full">
                <thead>
                  <tr className="bg-muted/50 text-left">
                    <th className="py-2.5 px-3 text-xs font-semibold text-foreground">
                      Right
                    </th>
                    <th className="py-2.5 px-3 text-xs font-semibold text-foreground">
                      Article
                    </th>
                    <th className="py-2.5 px-3 text-xs font-semibold text-foreground">
                      How to exercise
                    </th>
                  </tr>
                </thead>
                <tbody>
                  <TableRow
                    cells={[
                      "Right of access — obtain a copy of all personal data we hold about you.",
                      "Art. 15",
                      'Account Settings → Data & Privacy → "Download data export". Fulfilled instantly.',
                    ]}
                  />
                  <TableRow
                    cells={[
                      "Right to rectification — correct inaccurate or incomplete data.",
                      "Art. 16",
                      "Account Settings → update your name. Email changes require contacting us.",
                    ]}
                  />
                  <TableRow
                    cells={[
                      'Right to erasure ("right to be forgotten") — delete your account and all personal data.',
                      "Art. 17",
                      'Account Settings → Data & Privacy → "Delete my account". Fulfilled immediately. Note: anonymised audit log entries are retained under Art. 17(3).',
                    ]}
                  />
                  <TableRow
                    cells={[
                      "Right to restriction of processing — restrict how we use your data.",
                      "Art. 18",
                      <span>
                        Email{" "}
                        <a
                          href={`mailto:${CONTACT_EMAIL}`}
                          className="text-primary underline underline-offset-2 hover:text-primary/80"
                        >
                          {CONTACT_EMAIL}
                        </a>
                        . We will respond within 30 days.
                      </span>,
                    ]}
                  />
                  <TableRow
                    cells={[
                      "Right to data portability — receive your data in a structured, machine-readable format.",
                      "Art. 20",
                      'Account Settings → Data & Privacy → "Download data export". Provided as JSON.',
                    ]}
                  />
                  <TableRow
                    cells={[
                      "Right to object — object to processing based on legitimate interests.",
                      "Art. 21",
                      <span>
                        Email{" "}
                        <a
                          href={`mailto:${CONTACT_EMAIL}`}
                          className="text-primary underline underline-offset-2 hover:text-primary/80"
                        >
                          {CONTACT_EMAIL}
                        </a>
                        . We will cease processing unless we can demonstrate
                        compelling legitimate grounds.
                      </span>,
                    ]}
                  />
                  <TableRow
                    cells={[
                      "Right to withdraw consent — withdraw the consent given at registration.",
                      "Art. 7(3)",
                      "Delete your account (this withdraws consent and triggers erasure). Note: withdrawal does not affect the lawfulness of processing before withdrawal.",
                    ]}
                  />
                </tbody>
              </table>
            </div>

            <p>
              <strong className="text-foreground">Response times.</strong> We
              will respond to all requests within{" "}
              <strong className="text-foreground">30 days</strong> as required
              by Art. 12(3). Where requests are complex or numerous, we may
              extend this by a further two months with notice.
            </p>

            <p>
              <strong className="text-foreground">Orphaned projects.</strong> If
              you are the only ADMIN of a project at the time of account
              deletion, the project will be left without an admin. Shared
              secrets and team data belong to the organisation, not the
              individual. We recommend transferring admin rights before deleting
              your account.
            </p>
          </Section>

          {/* 9 */}
          <Section id="security" title="9. Security measures">
            <p>
              We implement appropriate technical and organisational measures to
              protect your personal data against unauthorised access, loss,
              destruction, or alteration (GDPR Art. 32 / UK GDPR Art. 32).
            </p>

            <ul className="list-disc list-inside space-y-1.5 pl-2">
              <li>
                <strong className="text-foreground">Encryption at rest</strong>{" "}
                — all secret values are encrypted with AES-256-GCM. The master
                encryption key is never stored in the database.
              </li>
              <li>
                <strong className="text-foreground">
                  Encryption in transit
                </strong>{" "}
                — all traffic is served over HTTPS/TLS 1.2+ in production. HSTS
                is enforced with a 1-year max-age and preload.
              </li>
              <li>
                <strong className="text-foreground">Password hashing</strong> —
                bcrypt with 12 rounds. Plaintext passwords are never logged or
                stored.
              </li>
              <li>
                <strong className="text-foreground">
                  Short-lived access tokens
                </strong>{" "}
                — JWT access tokens expire after 15 minutes and are stored in
                memory only (not in localStorage or cookies readable by
                JavaScript).
              </li>
              <li>
                <strong className="text-foreground">
                  Refresh token rotation
                </strong>{" "}
                — each refresh token is single-use. A new token is issued on
                every refresh; the old one is immediately invalidated.
              </li>
              <li>
                <strong className="text-foreground">Account lockout</strong> —
                accounts are temporarily locked after 10 consecutive failed
                login attempts (ISO 27001 A.9.4.2).
              </li>
              <li>
                <strong className="text-foreground">Rate limiting</strong> —
                authentication endpoints are limited to 20 requests per 15
                minutes per IP.
              </li>
              <li>
                <strong className="text-foreground">Audit logging</strong> — all
                security-relevant events are logged with actor, action,
                timestamp, IP address, and User-Agent (ISO 27001 A.12.4.1).
              </li>
              <li>
                <strong className="text-foreground">Security headers</strong> —
                Content-Security-Policy, HSTS, X-Frame-Options: DENY,
                X-Content-Type-Options: nosniff, and others are set on every
                response.
              </li>
            </ul>

            <p>
              <strong className="text-foreground">
                Data breach notification.
              </strong>{" "}
              In the event of a personal data breach that is likely to result in
              a risk to your rights and freedoms, we will notify the relevant
              supervisory authority within 72 hours of becoming aware (Art. 33)
              and will notify affected users without undue delay where the
              breach is likely to result in a high risk (Art. 34).
            </p>
          </Section>

          {/* 10 */}
          <Section id="children" title="10. Children's data">
            <p>
              envShare is a developer tool intended for professional use. We do
              not knowingly collect personal data from individuals under the age
              of <strong className="text-foreground">16</strong> (or the
              applicable age of digital consent in your jurisdiction). If you
              become aware that a child has provided us with personal data
              without parental consent, please contact{" "}
              <a
                href={`mailto:${CONTACT_EMAIL}`}
                className="text-primary underline underline-offset-2 hover:text-primary/80"
              >
                {CONTACT_EMAIL}
              </a>{" "}
              and we will delete the data without delay.
            </p>
          </Section>

          {/* 11 */}
          <Section id="changes" title="11. Changes to this Privacy Policy">
            <p>
              We may update this Privacy Policy from time to time to reflect
              changes in the service, applicable law, or our practices. When we
              do:
            </p>
            <ul className="list-disc list-inside space-y-1.5 pl-2">
              <li>
                The <em>Last updated</em> date at the top of this page will be
                revised.
              </li>
              <li>
                For material changes, we will notify you by email (if we have
                your address) or by a prominent notice in the application at
                least <strong className="text-foreground">14 days</strong>{" "}
                before the changes take effect.
              </li>
              <li>
                Continued use of the service after the effective date
                constitutes acceptance of the updated policy. If you do not
                accept the changes, you may delete your account before the
                effective date.
              </li>
            </ul>
            <p>
              Version history is maintained in the project's source repository.
            </p>
          </Section>

          {/* 12 */}
          <Section
            id="contact"
            title="12. Contact and supervisory authority complaints"
          >
            <p>
              If you have any questions about this Privacy Policy, wish to
              exercise a data-subject right, or have a concern about our data
              practices, please contact:
            </p>

            <div className="rounded-xl border border-border/60 bg-muted/30 p-4 space-y-1.5 text-sm">
              <p>
                <strong className="text-foreground">
                  Data Protection Officer
                </strong>
              </p>
              <p>
                Email:{" "}
                <a
                  href={`mailto:${DPO_EMAIL}`}
                  className="text-primary underline underline-offset-2 hover:text-primary/80"
                >
                  {DPO_EMAIL}
                </a>
              </p>
              <p>
                General enquiries:{" "}
                <a
                  href={`mailto:${CONTACT_EMAIL}`}
                  className="text-primary underline underline-offset-2 hover:text-primary/80"
                >
                  {CONTACT_EMAIL}
                </a>
              </p>
            </div>

            <p className="mt-4">
              <strong className="text-foreground">
                Supervisory authority.
              </strong>{" "}
              If you are based in the UK and believe we have infringed your
              rights, you have the right to lodge a complaint with the{" "}
              <a
                href="https://ico.org.uk/make-a-complaint/"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-0.5 text-primary underline underline-offset-2 hover:text-primary/80"
              >
                Information Commissioner's Office (ICO)
                <ExternalLink className="h-2.5 w-2.5" />
              </a>
              . If you are based in the EU, you may contact your local Data
              Protection Authority (DPA). A list of EU DPAs is available at{" "}
              <a
                href="https://edpb.europa.eu/about-edpb/about-edpb/members_en"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-0.5 text-primary underline underline-offset-2 hover:text-primary/80"
              >
                edpb.europa.eu
                <ExternalLink className="h-2.5 w-2.5" />
              </a>
              .
            </p>
            <p>
              We would always prefer the opportunity to address your concern
              directly before you contact a supervisory authority, so please
              reach out to us first.
            </p>
          </Section>

          {/* Footer */}
          <div className="pt-6 border-t border-border/60">
            <p className="text-xs text-muted-foreground text-center">
              © {new Date().getFullYear()} {CONTROLLER_NAME}. This Privacy
              Policy was last updated on {LAST_UPDATED}. It applies to all users
              of envShare regardless of where they are located.
            </p>
          </div>
        </main>
      </div>
    </div>
  );
}
