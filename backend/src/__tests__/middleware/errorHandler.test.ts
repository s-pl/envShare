import { describe, it, expect, vi } from 'vitest';
import { Request, Response, NextFunction } from 'express';
import { ZodError, z } from 'zod';
import { Prisma } from '@prisma/client';
import { errorHandler, AppError } from '../../middleware/errorHandler';

function makeRes() {
  const res = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  } as unknown as Response;
  return res;
}

const req = {} as Request;
const next = vi.fn() as NextFunction;

describe('errorHandler', () => {
  it('maps AppError to correct status and code', () => {
    const res = makeRes();
    const err = new AppError(403, 'Forbidden', 'FORBIDDEN');
    errorHandler(err, req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ error: 'Forbidden', code: 'FORBIDDEN' });
  });

  it('maps ZodError to 400/VALIDATION_ERROR', () => {
    const res = makeRes();
    let zodErr: ZodError;
    try {
      z.object({ name: z.string().min(1) }).parse({ name: '' });
    } catch (e) {
      zodErr = e as ZodError;
    }
    errorHandler(zodErr!, req, res, next);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'VALIDATION_ERROR' }),
    );
  });

  it('maps Prisma P2002 to 409/DB_CONSTRAINT', () => {
    const res = makeRes();
    const err = new Prisma.PrismaClientKnownRequestError('Unique', {
      code: 'P2002',
      clientVersion: '5',
    });
    errorHandler(err, req, res, next);
    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'DB_CONSTRAINT' }));
  });

  it('maps Prisma P2025 to 404/DB_NOT_FOUND', () => {
    const res = makeRes();
    const err = new Prisma.PrismaClientKnownRequestError('Not found', {
      code: 'P2025',
      clientVersion: '5',
    });
    errorHandler(err, req, res, next);
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'DB_NOT_FOUND' }));
  });

  it('maps Prisma P1001 to 503/DB_UNAVAILABLE', () => {
    const res = makeRes();
    const err = new Prisma.PrismaClientKnownRequestError('DB unreachable', {
      code: 'P1001',
      clientVersion: '5',
    });
    errorHandler(err, req, res, next);
    expect(res.status).toHaveBeenCalledWith(503);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'DB_UNAVAILABLE' }));
  });

  it('maps OpenSSL decryption error to ENCRYPTION_FAILED', () => {
    const res = makeRes();
    const err = new Error('error:1C800064:Provider routines::bad decrypt');
    errorHandler(err, req, res, next);
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'ENCRYPTION_FAILED' }));
  });

  it('does NOT classify generic "error:" messages as ENCRYPTION_FAILED', () => {
    const res = makeRes();
    // A normal error message that happens to contain "error:" but is not an OpenSSL error
    const err = new Error('Validation error: field is required');
    errorHandler(err, req, res, next);
    expect(res.json).not.toHaveBeenCalledWith(
      expect.objectContaining({ code: 'ENCRYPTION_FAILED' }),
    );
    expect(res.status).toHaveBeenCalledWith(500);
  });

  it('maps "Unsupported state" decryption error to ENCRYPTION_FAILED', () => {
    const res = makeRes();
    const err = new Error('Unsupported state or unable to authenticate data');
    errorHandler(err, req, res, next);
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'ENCRYPTION_FAILED' }));
  });

  it('maps unknown error to 500/INTERNAL', () => {
    const res = makeRes();
    const err = new Error('Something completely unexpected');
    errorHandler(err, req, res, next);
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'INTERNAL' }));
  });

  it('maps CONFIG_MISSING_KEY error to 500', () => {
    const res = makeRes();
    const err = new Error('MASTER_ENCRYPTION_KEY environment variable is not set');
    errorHandler(err, req, res, next);
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'CONFIG_MISSING_KEY' }));
  });
});
