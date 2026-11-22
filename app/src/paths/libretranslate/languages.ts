import type { Request, Response } from 'express';
import type { ILanguage } from '../../interfaces/global-transation-interfaces.ts';
import { translators } from '../../translators.ts';
import { Transaltor } from '../../interfaces/translator.ts';

/**
 * Retrieve all LibreTranslate language pairs
 */
export default function getLanguages() {
  return {
    GET: async (req: Request, res: Response<ILanguage[]>) => {
      res.send(await translators[Transaltor.LIBRETRANSLATE].getLanguages());
    }
  }
}
