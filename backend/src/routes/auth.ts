import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { authService } from '../services/authService';
import { AppError } from '../middleware/errorHandler';

export const authRouter = Router();

const COOKIE_NAME = 'refresh_token';
const COOKIE_OPTS = {
  httpOnly: true,                                      // JS cannot read this cookie
  secure: process.env.NODE_ENV === 'production',       // HTTPS only in prod
  sameSite: 'strict' as const,                         // CSRF protection
  maxAge: 7 * 24 * 60 * 60 * 1000,                    // 7 days in ms
  path: '/api/v1/auth',                                // Only sent to auth routes
};

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(12, 'Password must be at least 12 characters'),
  name: z.string().min(2),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

authRouter.post('/register', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = registerSchema.parse(req.body);
    const user = await authService.register(body.email, body.password, body.name);
    res.status(201).json({ user });
  } catch (err) { next(err); }
});

authRouter.post('/login', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = loginSchema.parse(req.body);
    const { accessToken, refreshToken, user } = await authService.login(body.email, body.password);

    // Set refresh token as HttpOnly cookie — browser sends it automatically, JS cannot read it
    res.cookie(COOKIE_NAME, refreshToken, COOKIE_OPTS);

    // Access token goes in the response body — stored in memory only, never persisted
    res.json({ accessToken, user });
  } catch (err) { next(err); }
});

authRouter.post('/refresh', async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Browser sends cookie automatically; CLI sends token in request body (backward compat)
    const fromCookie = req.cookies?.[COOKIE_NAME];
    const fromBody   = req.body?.refreshToken as string | undefined;
    const token      = fromCookie ?? fromBody;

    if (!token) throw new AppError(401, 'No refresh token provided');

    const { accessToken, refreshToken: newRefresh, user } = await authService.refresh(token);

    if (fromCookie) {
      // Browser path: rotate cookie, return only access token
      res.cookie(COOKIE_NAME, newRefresh, COOKIE_OPTS);
      res.json({ accessToken, user });
    } else {
      // CLI path: return full token pair in body (CLI stores it itself)
      res.json({ accessToken, refreshToken: newRefresh, user });
    }
  } catch (err) { next(err); }
});

authRouter.post('/logout', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const fromCookie = req.cookies?.[COOKIE_NAME];
    const fromBody   = req.body?.refreshToken as string | undefined;
    const token      = fromCookie ?? fromBody;

    if (token) await authService.logout(token);

    res.clearCookie(COOKIE_NAME, { path: '/api/v1/auth' });
    res.json({ ok: true });
  } catch (err) { next(err); }
});
