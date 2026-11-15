import express, { Request, Response } from 'express';
import { config } from './config.js';
import { ILanguage, ITranslation } from './interfaces/global-transation-interfaces.ts';
import { ApertiumClient } from './TranslationClients/ApertiumClient/ApertiumClient.ts';
import { LibreTranslateClient } from './TranslationClients/LibreTranslateClient/LibreTranslateClient.ts';

const app = express();
const PORT = Number(process.env.PORT) || 3000;

const apertium = new ApertiumClient(config.apyUrl);
const libre = new LibreTranslateClient(config.ltUrl);

app.use(express.json());

/**
 * Retrieves all languages and pairs from Libre Translate
 */
app.get('/libretranslate/languages', async (req: Request, res: Response<ILanguage[] | { error: string }>) => {
  try {
    res.send([]);
  } catch {
    res.status(502).json({ error: 'Apertium unavailable' });
  }
});

app.post('/libretranslate/translate', (req: Request, res: Response<ITranslation>) => {
  res.send(req as unknown as ITranslation);
});

app.get('/apertium/languages', async (req: Request, res: Response<ILanguage[] | { error: string }>) => {
  try {
    res.send(await apertium.getLanguages());
  } catch (error) {
    const err = error instanceof Error ? error.message : error as string;

    console.error(`Failed to retrieve Apertium languages: ${error}`);

    res.status(500).json({ error: err });
  }
});

app.post('/apertium/translate', async (req: Request, res: Response<ITranslation | { error: string }>) => {
  const body: unknown = req.body;

  if (
    typeof body !== 'object' || body === null ||
    !('source' in body) || typeof body.source !== 'string' || !body.source.trim() ||
    !('target' in body) || typeof body.target !== 'string' || !body.target.trim() ||
    !('text' in body) || typeof body.text !== 'string' || !body.text.trim()
  ) {
    res.status(400).json({ error: 'source, target, and text must be non-empty strings' });
    return;
  }

  try {
    res.json(await apertium.translate(body.source, body.target, body.text));
  } catch (error) {
    console.error('Failed to translate with Apertium:', error);
    res.status(502).json({ error: 'Apertium translation unavailable' });
  }
});

app.get('/', (_req, res) => {
  res.json({ name: 'linguago-api', status: 'ok' });
});

app.get('/health', (_req, res) => {
  res.send('ok');
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});