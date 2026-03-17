import { Router } from 'express';
import { z } from 'zod';
import { authenticate, AuthRequest } from '../middleware/auth';
import { accountService } from '../services/accountService';
import { authService } from '../services/authService';
import { AppError } from '../middleware/errorHandler';

/**
 * Account Router — /api/v1/account
 *
 * Implements GDPR data-subject rights and ISO 27001 account-management
 * controls for the authenticated user.
 *
 * Endpoints:
 *   GET    /me                — Art.15 right of access (profile)
 *   PATCH  /me                — Art.16 right to rectification (update name)
 *   PUT    /password          — ISO 27001 A.9.4.3 password management
 *   GET    /sessions          — ISO 27001 A.9.4 active session list
 *   DELETE /sessions          — ISO 27001 A.9.4 revoke all sessions
 *   DELETE /sessions/:id      — ISO 27001 A.9.4 revoke single session
 *   GET    /export            — Art.15 + Art.20 data portability export
 *   DELETE /                  — Art.17 right to erasure (delete account)
 */

export const accountRouter = Router();
accountRouter.use(authenticate);

// ── GET /api/v1/account/me ─────────────────────────────────────────────────
// GDPR Art. 15 — Right of access: return the caller's profile.
accountRouter.get('/me', async (req: AuthRequest, res, next) => {
  try {
    const profile = await accountService.getProfile(req.user!.id);
    res.json({ profile });
  } catch (err) { next(err); }
});

// ── PATCH /api/v1/account/me ────────────────────────────────────────────────
// GDPR Art. 16 — Right to rectification: update display name.
accountRouter.patch('/me', async (req: AuthRequest, res, next) => {
  try {
    const body = z.object({
      name: z.string().min(2, 'Name must be at least 2 characters').max(100),
    }).parse(req.body);

    const profile = await accountService.updateProfile(req.user!.id, body);
    res.json({ profile });
  } catch (err) { next(err); }
});

// ── PUT /api/v1/account/password ────────────────────────────────────────────
// ISO 27001 A.9.4.3 — Password management.
// Requires current password verification; invalidates all active sessions.
accountRouter.put('/password', async (req: AuthRequest, res, next) => {
  try {
    const body = z.object({
      currentPassword: z.string().min(1, 'Current password is required'),
      newPassword: z
        .string()
        .min(12, 'New password must be at least 12 characters'),
    }).parse(req.body);

    const result = await accountService.changePassword(
      req.user!.id,
      body.currentPassword,
      body.newPassword,
      {
        ipAddress: req.ctx?.ipAddress,
        userAgent: req.ctx?.userAgent,
      },
    );

    // Clear the refresh-token cookie — the user must re-authenticate
    res.clearCookie('refresh_token', { path: process.env.COOKIE_PATH || '/api/v1/auth' });
    res.json({ ok: true, sessionsRevoked: result.sessionsRevoked });
  } catch (err) { next(err); }
});

// ── GET /api/v1/account/sessions ────────────────────────────────────────────
// ISO 27001 A.9.4 — List all active sessions.
accountRouter.get('/sessions', async (req: AuthRequest, res, next) => {
  try {
    const sessions = await accountService.getSessions(req.user!.id);
    res.json({ sessions });
  } catch (err) { next(err); }
});

// ── DELETE /api/v1/account/sessions ─────────────────────────────────────────
// ISO 27001 A.9.4 — Revoke ALL active sessions ("sign out everywhere").
accountRouter.delete('/sessions', async (req: AuthRequest, res, next) => {
  try {
    const count = await authService.logoutAll(req.user!.id, {
      ipAddress: req.ctx?.ipAddress,
      userAgent: req.ctx?.userAgent,
    });

    res.clearCookie('refresh_token', { path: process.env.COOKIE_PATH || '/api/v1/auth' });
    res.json({ ok: true, sessionsRevoked: count });
  } catch (err) { next(err); }
});

// ── DELETE /api/v1/account/sessions/:id ─────────────────────────────────────
// ISO 27001 A.9.4 — Revoke a single session by token record ID.
accountRouter.delete('/sessions/:id', async (req: AuthRequest, res, next) => {
  try {
    const { id } = z.object({ id: z.string().cuid() }).parse(req.params);

    await accountService.revokeSession(req.user!.id, id, {
      ipAddress: req.ctx?.ipAddress,
      userAgent: req.ctx?.userAgent,
    });

    res.json({ ok: true });
  } catch (err) { next(err); }
});

// ── GET /api/v1/account/export ──────────────────────────────────────────────
// GDPR Art. 15 + Art. 20 — Right of access + Right to data portability.
// Returns a machine-readable JSON document of all personal data.
accountRouter.get('/export', async (req: AuthRequest, res, next) => {
  try {
    const data = await accountService.exportData(req.user!.id);

    // Serve as a downloadable JSON file
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="envshare-export-${new Date().toISOString().slice(0, 10)}.json"`,
    );
    res.setHeader('Content-Type', 'application/json');
    res.json(data);
  } catch (err) { next(err); }
});

// ── DELETE /api/v1/account ───────────────────────────────────────────────────
// GDPR Art. 17 — Right to erasure ("right to be forgotten").
// Permanently deletes the account after password confirmation.
//
// Body: { password: string, confirmPhrase: "DELETE MY ACCOUNT" }
// The confirmPhrase provides an extra guard against accidental deletion.
accountRouter.delete('/', async (req: AuthRequest, res, next) => {
  try {
    const body = z.object({
      password: z.string().min(1, 'Password confirmation is required'),
      confirmPhrase: z.literal('DELETE MY ACCOUNT', {
        errorMap: () => ({
          message: 'You must type "DELETE MY ACCOUNT" to confirm.',
        }),
      }),
    }).parse(req.body);

    await accountService.deleteAccount(req.user!.id, body.password, {
      ipAddress: req.ctx?.ipAddress,
      userAgent: req.ctx?.userAgent,
    });

    // Clear the session cookie — the user no longer exists
    res.clearCookie('refresh_token', { path: process.env.COOKIE_PATH || '/api/v1/auth' });
    res.json({
      ok: true,
      message:
        'Your account and all associated personal data have been permanently deleted ' +
        'in accordance with GDPR Art. 17 (Right to Erasure).',
    });
  } catch (err) { next(err); }
});
