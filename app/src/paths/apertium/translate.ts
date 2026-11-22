import type { Request, Response } from 'express';
import type { ITranslation } from '../../interfaces/global-transation-interfaces.ts';
import { translateLimiter } from '../../rate-limiters.ts';
import { translators } from '../../translators.ts';
import { Transaltor } from '../../interfaces/translator.ts';
import { parseTranslationBody } from '../../validation.ts';

/**
 * Translate via Apertium
 */
export default function translate() {
  return {
    POST: [translateLimiter, async (req: Request, res: Response<ITranslation>) => {
      const { source, target, text } = parseTranslationBody(req.body);
      res.json(await translators[Transaltor.APERTIUM].translate(source, target, text));
    }]
  };
}
