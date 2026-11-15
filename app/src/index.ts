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
  } catch {
    res.status(502).json({ error: 'Apertium unavailable' });
  }
});

app.post('/apertium/translate', (req: Request, res: Response<ITranslation>) => {
  res.send(req as unknown as ITranslation);
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