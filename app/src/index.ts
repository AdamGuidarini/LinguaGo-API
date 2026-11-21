import cors from 'cors';
import express, { NextFunction, Request, Response } from 'express';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { config } from './config.js';
import { HttpError, UpstreamError } from './errors.ts';
import { ILanguage, ITranslation, ITranslator } from './interfaces/global-transation-interfaces.ts';
import { Transaltor } from './interfaces/translator.ts';
import { ApertiumClient } from './TranslationClients/ApertiumClient/ApertiumClient.ts';
import { LibreTranslateClient } from './TranslationClients/LibreTranslateClient/LibreTranslateClient.ts';
import { parseTranslationBody } from './validation.ts';

const app = express();
const PORT = Number(process.env.PORT) || 3000;

const translators: Record<Transaltor, ITranslator> = {
  [Transaltor.APERTIUM]: new ApertiumClient(config.apyUrl),
  [Transaltor.LIBRETRANSLATE]: new LibreTranslateClient(config.ltUrl, config.ltKey),
};

const apertium = translators[Transaltor.APERTIUM];
const libre = translators[Transaltor.LIBRETRANSLATE];

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

const translateLimiter = rateLimit({
  windowMs: config.translationLimitWindow,
  limit: config.translationRateLimit,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Too many translation requests, please wait and try again.' }
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
 * Lists the available translation backends
 */
app.get('/translators', (_req: Request, res: Response<Transaltor[]>) => {
  res.json(Object.values(Transaltor));
});

/**
 * Unified translation endpoint. Routes to the backend named in the
 * `translator` field ("apertium" or "libretranslate").
 */
app.post('/translate', translateLimiter, async (req: Request, res: Response<ITranslation>) => {
  const body: unknown = req.body;

  if (
    typeof body !== 'object' || body === null ||
    !('translator' in body) ||
    typeof body.translator !== 'string' ||
    !Object.values(Transaltor).includes(body.translator as Transaltor)
  ) {
    throw new HttpError(400, `translator must be one of: ${Object.values(Transaltor).join(', ')}`);
  }

  const { source, target, text } = parseTranslationBody(body);
  const client = translators[body.translator as Transaltor];

  res.json(await client.translate(source, target, text));
});

/**
 * Basic API check
 */
app.get('/', (_req, res) => {
  res.json({ name: 'linguago-api', status: 'ok' });
});

/**
 * API Health check
 */
app.get('/health', (_req, res) => {
  res.send('ok');
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

  if (err instanceof HttpError) {
    res.status(err.status).json({ error: err.message });
    return;
  }

  if (err instanceof UpstreamError) {
    console.error(`${err.service} request failed:`, err);

    if (err.timeout) {
      res.status(504).json({ error: `${err.service} timed out` });
    } else {
      res.status(502).json({ error: `${err.service} unavailable` });
    }
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
