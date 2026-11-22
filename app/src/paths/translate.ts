import type { Request, Response } from 'express';
import type { ITranslation } from '../interfaces/global-transation-interfaces.ts';
import { Transaltor } from '../interfaces/translator.ts';
import { HttpError } from '../errors.ts';
import { parseTranslationBody } from '../validation.ts';
import { translateLimiter } from '../rate-limiters.ts';
import { translators } from '../translators.ts';

/**
 * Route file for POST /translate — the operation documented at
 * apiDoc.paths['/translate'] (operationId: translate). Routes to the
 * backend named in the `translator` field ("apertium" or "libretranslate").
 */
export default function translate() {
  return {
    POST: [translateLimiter, async (req: Request, res: Response<ITranslation>) => {
      const body: unknown = req.body;
      if (typeof body !== 'object' || body === null ||
          !('translator' in body) || typeof body.translator !== 'string' ||
          !Object.values(Transaltor).includes(body.translator as Transaltor)) {
        throw new HttpError(400, `translator must be one of: ${Object.values(Transaltor).join(', ')}`);
      }
      const { source, target, text } = parseTranslationBody(body);

      res.json(await translators[body.translator as Transaltor].translate(source, target, text));
    }],
  };
}
