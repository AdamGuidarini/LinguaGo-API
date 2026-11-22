import cors from 'cors';
import express, { NextFunction, Request, Response } from 'express';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { initialize } from 'express-openapi';
import { fileURLToPath } from 'node:url';
import { config } from './config.js';
import { apiDoc } from './openapi.js';
import { HttpError, UpstreamError } from './errors.ts';
import type { ILanguage, ITranslation } from './interfaces/global-transation-interfaces.ts';
import { Transaltor } from './interfaces/translator.ts';
import { parseTranslationBody } from './validation.ts';
import { translators } from './translators.ts';
import { translateLimiter } from './rate-limiters.ts';

const app = express();
const PORT = Number(process.env.PORT) || 3000;

export const apertium = translators[Transaltor.APERTIUM];
export const libre = translators[Transaltor.LIBRETRANSLATE];

// General limiter for all routes: 100 requests per 15 minutes per IP
const generalLimiter = rateLimit({
  windowMs: config.generalLimitWindow,
  limit: config.generalRateLimit,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  // keep health probes and CORS preflights unthrottled
  skip: (req) => req.path === '/health' || req.method === 'OPTIONS',
  message: { error: 'Too many requests, please try again later.' }
});

/**
 * CORS origins, driven entirely by env config:
 * - no Origin header (curl, server-to-server) -> allowed
 * - CORS_ALLOWED_ORIGINS='*' -> any origin (dev only!)
 * - CORS_ALLOW_EXTENSION_ORIGINS=true (default) -> any moz-extension:// or
 *   chrome-extension:// origin. Extensions have no stable origin: Firefox
 *   add-ons send `moz-extension://<uuid>/` with a UUID that is random per
 *   install/profile, so they can only be allowed by scheme, never by value.
 * - CORS_DOMAIN / CORS_ALLOWED_ORIGINS -> exact web origins (hosted frontend)
 */
const corsAllowedOrigins = new Set(
  [config.corsDomain, ...config.corsAllowedOrigins].filter((o): o is string => Boolean(o))
);

const corsConfig = {
  origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
    if (!origin) return callback(null, true);
    if (corsAllowedOrigins.has('*')) return callback(null, true);
    if (config.corsAllowExtensionOrigins && /^(moz-extension):\/\//.test(origin)) {
      return callback(null, true);
    }
    if (corsAllowedOrigins.has(origin)) return callback(null, true);
    return callback(null, false);
  },
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: config.corsAllowedHeaders,
  // let extension JS read the rate-limit headers sent by express-rate-limit (draft-7)
  exposedHeaders: ['RateLimit-Limit', 'RateLimit-Remaining', 'RateLimit-Reset'],
  optionsSuccessStatus: 200
};

app.use(generalLimiter);
app.use(cors(corsConfig));

/**
 * Security headers. This is a pure JSON API consumed by a browser
 * extension — it never serves HTML — so the CSP can be maximally
 * restrictive. Do NOT enable COEP (require-corp): it would block
 * cross-origin loading of these responses.
 */
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ['\'none\''],
      frameAncestors: ['\'none\'']
    }
  },
  strictTransportSecurity: {
    maxAge: 31536000, // 1 year; includeSubDomains since we have no subdomains to protect differently
    includeSubDomains: true
  },
  crossOriginResourcePolicy: { policy: 'same-origin' },
  referrerPolicy: { policy: 'no-referrer' }
}));

app.use(express.json({ limit: '10kb' }));

/**
 * Retrieves all languages and pairs from LibreTranslate
 */
app.get('/libretranslate/languages', async (_req: Request, res: Response<ILanguage[]>) => {
  res.send(await libre.getLanguages());
});

/**
 * Translate via LibreTranslate
 */
app.post('/libretranslate/translate', translateLimiter, async (req: Request, res: Response<ITranslation>) => {
  const { source, target, text } = parseTranslationBody(req.body);
  res.json(await libre.translate(source, target, text));
});

/**
 * Retrieve all Apertium language pairs
 */
app.get('/apertium/languages', async (_req: Request, res: Response<ILanguage[]>) => {
  res.send(await apertium.getLanguages());
});

/**
 * Translate via Apertium
 */
app.post('/apertium/translate', translateLimiter, async (req: Request, res: Response<ITranslation>) => {
  const { source, target, text } = parseTranslationBody(req.body);
  res.json(await apertium.translate(source, target, text));
});

/**
 * Basic API check
 */
app.get('/', (_req, res) => {
  res.json({ name: 'linguago-api', status: 'ok' });
});

/**
 * OpenAPI integration. Serves the spec as JSON at GET /api-docs and registers
 * every route file in the paths directory against its entry in `apiDoc`.
 * Documented operations get request/response validation for free.
 *
 * Route files are authored in TypeScript (src/paths/*.ts) and compiled to
 * dist/paths/*.js by tsc. The directory is resolved relative to this module,
 * so it points at src/paths under vitest/tsx and dist/paths under node dist.
 * The glob matches both extensions so either runtime finds the route files.
 */
await initialize({
  app,
  apiDoc,
  paths: fileURLToPath(new URL('./paths/', import.meta.url)),
  routesGlob: '**/*.{js,ts}',
  routesIndexFileRegExp: /(?:index)?\.(js|ts)$/,
});

/**
 * Invalid route handler
 */
app.use((_req: Request, res: Response) => {
  res.status(404).json({ error: 'Not found' });
});

/**
 * Central error handler. Express 5 forwards rejected promises from async
 * handlers here, so routes don't need their own try/catch.
 */
app.use((err: unknown, _req: Request, res: Response, next: NextFunction) => {
  if (res.headersSent) {
    next(err);
    return;
  }

  // Route files under paths/ are loaded by express-openapi via a native
  // dynamic import under vitest, which produces a second copy of the modules
  // they import — so instanceof fails across that boundary. Fall back to the
  // error `name`, which survives module duplication. (Shape-based checks like
  // `typeof err.status === 'number'` are NOT safe: body-parser errors also
  // carry a numeric status.)
  const httpError = err instanceof HttpError
    ? err
    : err instanceof Error && err.name === 'HttpError'
      ? err as HttpError
      : null;

  if (httpError) {
    res.status(httpError.status).json({ error: httpError.message });
    return;
  }

  const upstreamError = err instanceof UpstreamError
    ? err
    : err instanceof Error && err.name === 'UpstreamError'
      ? err as UpstreamError
      : null;

  if (upstreamError) {
    console.error(`${upstreamError.service} request failed:`, upstreamError);

    if (upstreamError.timeout) {
      res.status(504).json({ error: `${upstreamError.service} timed out` });
    } else {
      res.status(502).json({ error: `${upstreamError.service} unavailable` });
    }
    return;
  }

  // express-openapi request-validation errors (thrown before route handlers
  // run). Shape: { status: number, errors: [...] } from openapi-request-validator.
  if (
    typeof err === 'object' && err !== null &&
    typeof (err as { status?: unknown }).status === 'number' &&
    Array.isArray((err as { errors?: unknown }).errors)
  ) {
    const validationError = err as { status: number; errors: { message?: string }[] };
    res.status(validationError.status).json({
      error: validationError.errors[0]?.message ?? 'Invalid request'
    });
    return;
  }

  // body-parser rejects malformed JSON bodies with a SyntaxError carrying status 400
  if (err instanceof SyntaxError) {
    res.status(400).json({ error: 'Malformed JSON in request body' });
    return;
  }

  console.error('Unexpected error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
  console.log(
    `Rate limits — general: ${config.generalRateLimit} req / ${config.generalLimitWindow}ms per IP, ` +
    `translation: ${config.translationRateLimit} req / ${config.translationLimitWindow}ms per IP`
  );
});
