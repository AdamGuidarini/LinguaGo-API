import express, { Request, Response } from 'express';
import { ILanguage, ITranslation } from './interfaces/global-transation-interfaces.ts';

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.use(express.json());

/**
 * Retrieves all languages and pairs from Libre Translate
 */
app.get('/api/libretranslate/languages', (req: Request, res: Response<ILanguage[]>) => {
  res.send([]);
});

app.post('/api/libretranslate/translate', (req: Request, res: Response<ITranslation>) => {
  res.send(req as unknown as ITranslation);
});

app.get('/api/apertium/languages', (req: Request, res: Response<ILanguage[]>) => {
  res.send([]);
});

app.post('/api/apertium/translate', (req: Request, res: Response<ITranslation>) => {
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