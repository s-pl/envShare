import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { Prisma } from '@prisma/client';
import { logger } from '../utils/logger';

// ─── Error codes ──────────────────────────────────────────────────────────────
//
// AUTH_INVALID_CREDENTIALS  401  Wrong email or password
// AUTH_TOKEN_MISSING        401  No Authorization header
// AUTH_TOKEN_INVALID        401  JWT malformed, expired, or signed with wrong secret
// AUTH_REFRESH_INVALID      401  Refresh token not found or expired
// AUTH_EMAIL_TAKEN          409  Email already registered
//
// FORBIDDEN                 403  Authenticated but not a project member
// FORBIDDEN_ROLE            403  Role insufficient for this operation
//
// NOT_FOUND                 404  Requested resource does not exist
// CONFLICT                  409  Resource already exists (duplicate)
//
// VALIDATION_ERROR          400  Request body failed schema validation
//
// ENCRYPTION_FAILED         500  AES-GCM decryption failed — likely wrong
//                                MASTER_ENCRYPTION_KEY vs what was used to
//                                encrypt the project. Re-create the project or
//                                restore the correct key.
// CONFIG_MISSING_KEY        500  MASTER_ENCRYPTION_KEY or JWT_SECRET not set
// CONFIG_INVALID_KEY        500  MASTER_ENCRYPTION_KEY is not 64 hex chars
//
// DB_UNAVAILABLE            503  Cannot connect to PostgreSQL
// DB_CONSTRAINT             409  Unique / foreign-key constraint violation
// DB_NOT_FOUND              404  Prisma record not found (P2025)
//
// INTERNAL                  500  Unexpected error — check server logs
//
// ─────────────────────────────────────────────────────────────────────────────

export class AppError extends Error {
  constructor(
    public statusCode: number,
    message: string,
    public code: string = 'INTERNAL',
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  // ── Known application error ─────────────────────────────────────────────
  if (err instanceof AppError) {
    res.status(err.statusCode).json({ error: err.message, code: err.code });
    return;
  }

  // ── Zod validation ──────────────────────────────────────────────────────
  if (err instanceof ZodError) {
    const fields = err.errors.map(e => ({ field: e.path.join('.'), message: e.message }));
    res.status(400).json({
      error: fields[0]?.message ?? 'Validation error',
      code: 'VALIDATION_ERROR',
      fields,
    });
    return;
  }

  // ── Prisma known request errors ─────────────────────────────────────────
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    switch (err.code) {
      case 'P2002': // Unique constraint
        res.status(409).json({ error: 'Resource already exists', code: 'DB_CONSTRAINT' });
        return;
      case 'P2025': // Record not found
        res.status(404).json({ error: 'Resource not found', code: 'DB_NOT_FOUND' });
        return;
      case 'P2003': // Foreign key constraint
        res.status(409).json({ error: 'Related resource does not exist', code: 'DB_CONSTRAINT' });
        return;
      case 'P1001': // DB unreachable
        logger.error('Database unreachable', { prismaCode: err.code });
        res.status(503).json({ error: 'Database unavailable', code: 'DB_UNAVAILABLE' });
        return;
    }
  }

  // ── Prisma initialization / connection errors ────────────────────────────
  if (err instanceof Prisma.PrismaClientInitializationError) {
    logger.error('Prisma initialization error', { message: err.message });
    res.status(503).json({ error: 'Database unavailable', code: 'DB_UNAVAILABLE' });
    return;
  }

  // ── AES-GCM decryption failure ───────────────────────────────────────────
  // Node throws "Unsupported state or unable to authenticate data" when the
  // GCM auth tag doesn't match — this almost always means the MASTER_ENCRYPTION_KEY
  // running now is different from the one that was used to create the project.
  if (
    err.message.includes('Unsupported state or unable to authenticate data') ||
    err.message.includes('Invalid IV length') ||
    /^error:[0-9A-Fa-f]+:/.test(err.message) // native OpenSSL error strings
  ) {
    logger.error('Decryption failed', { message: err.message });
    res.status(500).json({
      error: 'Decryption failed. The MASTER_ENCRYPTION_KEY may not match the one used to create this project.',
      code: 'ENCRYPTION_FAILED',
    });
    return;
  }

  // ── Server configuration errors ──────────────────────────────────────────
  if (
    err.message.includes('MASTER_ENCRYPTION_KEY') ||
    err.message.includes('JWT_SECRET')
  ) {
    logger.error('Server configuration error', { message: err.message });
    const code = err.message.includes('must be') ? 'CONFIG_INVALID_KEY' : 'CONFIG_MISSING_KEY';
    res.status(500).json({ error: err.message, code });
    return;
  }

  // ── Fallthrough: unexpected error ────────────────────────────────────────
  logger.error('Unhandled error', { error: err.message, stack: err.stack });
  res.status(500).json({ error: 'Internal server error', code: 'INTERNAL' });
}
