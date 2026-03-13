import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { randomBytes } from 'crypto';
import { prisma } from '../utils/prisma';
import { AppError } from '../middleware/errorHandler';

const BCRYPT_ROUNDS = 12;
const ACCESS_TOKEN_TTL = '15m';
const REFRESH_TOKEN_TTL_DAYS = 7;

function signAccess(userId: string, email: string): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET not configured');
  return jwt.sign({ sub: userId, email }, secret, { expiresIn: ACCESS_TOKEN_TTL });
}

export const authService = {
  async register(email: string, password: string, name: string) {
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) throw new AppError(409, 'Email already registered');

    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    const user = await prisma.user.create({
      data: { email, passwordHash, name },
      select: { id: true, email: true, name: true, createdAt: true },
    });
    return user;
  },

  async login(email: string, password: string) {
    const user = await prisma.user.findUnique({ where: { email } });
    // Constant-time comparison even if user doesn't exist
    const hash = user?.passwordHash ?? '$2a$12$invalidhashfortimingnormalization';
    const valid = await bcrypt.compare(password, hash);

    if (!user || !valid) {
      throw new AppError(401, 'Invalid email or password');
    }

    const accessToken = signAccess(user.id, user.email);

    const refreshToken = randomBytes(40).toString('hex');
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + REFRESH_TOKEN_TTL_DAYS);

    await prisma.refreshToken.create({
      data: { token: refreshToken, userId: user.id, expiresAt },
    });

    return {
      accessToken,
      refreshToken,
      user: { id: user.id, email: user.email, name: user.name },
    };
  },

  async refresh(refreshToken: string) {
    const record = await prisma.refreshToken.findUnique({
      where: { token: refreshToken },
      include: { user: true },
    });

    if (!record || record.expiresAt < new Date()) {
      // Rotate invalid token to prevent reuse attacks
      if (record) await prisma.refreshToken.delete({ where: { id: record.id } });
      throw new AppError(401, 'Refresh token invalid or expired');
    }

    // Rotate refresh token (one-time use)
    await prisma.refreshToken.delete({ where: { id: record.id } });

    const newRefresh = randomBytes(40).toString('hex');
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + REFRESH_TOKEN_TTL_DAYS);

    await prisma.refreshToken.create({
      data: { token: newRefresh, userId: record.userId, expiresAt },
    });

    const accessToken = signAccess(record.user.id, record.user.email);
    return {
      accessToken,
      refreshToken: newRefresh,
      user: { id: record.user.id, email: record.user.email, name: record.user.name },
    };
  },

  async logout(refreshToken: string) {
    await prisma.refreshToken.deleteMany({ where: { token: refreshToken } });
  },

};
