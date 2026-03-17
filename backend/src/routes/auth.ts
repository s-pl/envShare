import { Router, Request, Response, NextFunction } from "express";
import { z } from "zod";
import { authService } from "../services/authService";
import { AppError } from "../middleware/errorHandler";

export const authRouter = Router();

const COOKIE_NAME = "refresh_token";
// COOKIE_PATH can be overridden when the API is served under a path prefix
// e.g. COOKIE_PATH=/secrets/api/v1/auth when proxied at /secrets
const COOKIE_PATH = process.env.COOKIE_PATH || "/api/v1/auth";
const COOKIE_OPTS = {
  httpOnly: true, // JS cannot read this cookie
  secure: process.env.NODE_ENV === "production", // HTTPS only in prod
  sameSite: "strict" as const, // CSRF protection
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days in ms
  path: COOKIE_PATH, // Only sent to auth routes
};

// ── Schemas ────────────────────────────────────────────────────────────────────

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(12, "Password must be at least 12 characters"),
  name: z.string().min(2),
  /**
   * GDPR Art. 7 — explicit, informed consent is required before we may process
   * the user's personal data. The frontend presents the Privacy Policy link and
   * requires this checkbox to be ticked before the form can be submitted.
   */
  consent: z.literal(true, {
    errorMap: () => ({
      message: "You must accept the Privacy Policy to create an account.",
    }),
  }),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

// ── Helpers ────────────────────────────────────────────────────────────────────

/** Extract request context (IP + UA) populated by requestContextMiddleware. */
function sessionCtx(req: Request) {
  return {
    ipAddress: req.ctx?.ipAddress,
    userAgent: req.ctx?.userAgent,
  };
}

// ── Routes ─────────────────────────────────────────────────────────────────────

authRouter.post(
  "/register",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = registerSchema.parse(req.body);
      const user = await authService.register(
        body.email,
        body.password,
        body.name,
        body.consent, // GDPR Art. 7 consent flag
      );
      res.status(201).json({ user });
    } catch (err) {
      next(err);
    }
  },
);

authRouter.post(
  "/login",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = loginSchema.parse(req.body);
      const { accessToken, refreshToken, user } = await authService.login(
        body.email,
        body.password,
        sessionCtx(req), // ISO 27001 A.12.4 — capture IP + UA for audit log
      );

      // Set refresh token as HttpOnly cookie — browser sends it automatically, JS cannot read it
      res.cookie(COOKIE_NAME, refreshToken, COOKIE_OPTS);

      // CLI path: no cookie storage, return full token pair in body
      const isCli = req.headers["x-client"] === "cli";
      res.json({ accessToken, user, ...(isCli ? { refreshToken } : {}) });
    } catch (err) {
      next(err);
    }
  },
);

authRouter.post(
  "/refresh",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Browser sends cookie automatically; CLI sends token in request body (backward compat)
      const fromCookie = req.cookies?.[COOKIE_NAME];
      const fromBody = req.body?.refreshToken as string | undefined;
      const token = fromCookie ?? fromBody;

      if (!token)
        throw new AppError(
          401,
          "No refresh token provided",
          "AUTH_TOKEN_MISSING",
        );

      const {
        accessToken,
        refreshToken: newRefresh,
        user,
      } = await authService.refresh(
        token,
        sessionCtx(req), // ISO 27001 A.12.4 — carry IP + UA to new session record
      );

      if (fromCookie) {
        // Browser path: rotate cookie, return only access token
        res.cookie(COOKIE_NAME, newRefresh, COOKIE_OPTS);
        res.json({ accessToken, user });
      } else {
        // CLI path: return full token pair in body (CLI stores it itself)
        res.json({ accessToken, refreshToken: newRefresh, user });
      }
    } catch (err) {
      next(err);
    }
  },
);

authRouter.post(
  "/logout",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const fromCookie = req.cookies?.[COOKIE_NAME];
      const fromBody = req.body?.refreshToken as string | undefined;
      const token = fromCookie ?? fromBody;

      if (token) await authService.logout(token);

      res.clearCookie(COOKIE_NAME, { path: COOKIE_PATH });
      res.json({ ok: true });
    } catch (err) {
      next(err);
    }
  },
);
