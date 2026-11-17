import express, { NextFunction, Request, Response } from 'express';
import { config } from './config.js';
import { HttpError, UpstreamError } from './errors.ts';
import { ILanguage, ITranslation } from './interfaces/global-transation-interfaces.ts';
import { ApertiumClient } from './TranslationClients/ApertiumClient/ApertiumClient.ts';
import { LibreTranslateClient } from './TranslationClients/LibreTranslateClient/LibreTranslateClient.ts';

const app = express();
const PORT = Number(process.env.PORT) || 3000;

const apertium = new ApertiumClient(config.apyUrl);
const libre = new LibreTranslateClient(config.ltUrl, config.ltKey);

app.use(express.json());

/**
 * Retrieves all languages and pairs from Libre Translate
 */
app.get('/libretranslate/languages', async (_req: Request, res: Response<ILanguage[]>) => {
  res.send(await libre.getLanguages());
});

app.post('/libretranslate/translate', (req: Request, res: Response<ITranslation>) => {
  res.send(req as unknown as ITranslation);
});

app.get('/apertium/languages', async (_req: Request, res: Response<ILanguage[]>) => {
  res.send(await apertium.getLanguages());
});

app.post('/apertium/translate', async (req: Request, res: Response<ITranslation>) => {
  const body: unknown = req.body;

  if (
    typeof body !== 'object' || body === null ||
    !('source' in body) || typeof body.source !== 'string' || !body.source.trim() ||
    !('target' in body) || typeof body.target !== 'string' || !body.target.trim() ||
    !('text' in body) || typeof body.text !== 'string' || !body.text.trim()
  ) {
    throw new HttpError(400, 'source, target, and text must be non-empty strings');
  }

  res.json(await apertium.translate(body.source, body.target, body.text));
});

app.get('/', (_req, res) => {
  res.json({ name: 'linguago-api', status: 'ok' });
});

app.get('/health', (_req, res) => {
  res.send('ok');
});

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
});
