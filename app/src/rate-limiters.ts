import rateLimit from 'express-rate-limit';
import { config } from './config.ts';

/**
 * Rate limiter for translation endpoints, shared by index.ts and the
 * route files under src/paths/ so every translation route gets the same
 * limit from a single definition.
 */
export const translateLimiter = rateLimit({
  windowMs: config.translationLimitWindow,
  limit: config.translationRateLimit,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Too many translation requests, please wait and try again.' }
});
