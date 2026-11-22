import { config } from './config.ts';
import type { ITranslator } from './interfaces/global-transation-interfaces.ts';
import { Transaltor } from './interfaces/translator.ts';
import { ApertiumClient } from './TranslationClients/ApertiumClient/ApertiumClient.ts';
import { LibreTranslateClient } from './TranslationClients/LibreTranslateClient/LibreTranslateClient.ts';

/**
 * Registry of available translation backends, keyed by Transaltor.
 *
 * Lives in its own module (not index.ts) so route files under src/paths/
 * can import it without importing index.ts, which starts the server.
 */
export const translators: Record<Transaltor, ITranslator> = {
  [Transaltor.APERTIUM]: new ApertiumClient(config.apyUrl),
  [Transaltor.LIBRETRANSLATE]: new LibreTranslateClient(config.ltUrl, config.ltKey),
};
