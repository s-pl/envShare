import { Router } from 'express';
import { z } from 'zod';
import { authenticate, AuthRequest } from '../middleware/auth';
import { auditService } from '../services/auditService';

export const auditRouter = Router();
auditRouter.use(authenticate);

auditRouter.get('/', async (req: AuthRequest, res, next) => {
  try {
    const query = z.object({
      resourceType: z.string().optional(),
      action: z.string().optional(),
      from: z.string().datetime().optional(),
      to: z.string().datetime().optional(),
      limit: z.coerce.number().min(1).max(200).default(50),
      offset: z.coerce.number().min(0).default(0),
    }).parse(req.query);

    const result = await auditService.query({
      ...query,
      from: query.from ? new Date(query.from) : undefined,
      to: query.to ? new Date(query.to) : undefined,
    });

    res.json(result);
  } catch (err) {
    next(err);
  }
});
