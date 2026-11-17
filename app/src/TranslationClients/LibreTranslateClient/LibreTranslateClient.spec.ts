import { beforeEach, describe, expect, it, vi } from 'vitest';
import { UpstreamError } from '../../errors.ts';
import { Transaltor } from '../../interfaces/translator.ts';
import { LibreTranslateClient } from './LibreTranslateClient.ts';

const languages = [
  { code: 'en', name: 'English', targets: ['es', 'fr'] },
  { code: 'es', name: 'Spanish', targets: ['en'] }
];

const LANG_ERR = 'languages err';
const TRANSLATE_ERR = 'translate err';

describe('LibreTranslateClient', () => {
  let ltClient: LibreTranslateClient;
  let reject: string;

  beforeEach(() => {
    ltClient = new LibreTranslateClient('https://lt.example.com', 'secret-key');
    reject = '';

    const fetchCallBack = (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      const url = input as string;

      if (url.includes('/languages')) {
        if (reject.includes('languages')) {
          throw new Error(LANG_ERR);
        }

        return Promise.resolve(new Response(JSON.stringify(languages)));
      }

      if (url.includes('/translate')) {
        if (reject.includes('translate')) {
          throw new Error(TRANSLATE_ERR);
        }

        const body = JSON.parse(init?.body as string);

        return Promise.resolve(new Response(JSON.stringify({
          translatedText: body.target === 'es' ? 'hola' : 'hello',
          alternatives: ['buenos días'],
          detectedLanguage: body.source === 'auto'
            ? { confidence: 0.98, language: 'en' }
            : undefined
        })));
      }

      return Promise.reject('No known path given');
    };

    globalThis.fetch = vi.fn(fetchCallBack);
  });

  describe('getLanguages method', () => {
    it('should retrieve languages', async () => {
      const langs = await ltClient.getLanguages();

      expect(langs).toStrictEqual(languages);
      expect(globalThis.fetch).toHaveBeenCalledWith(
        'https://lt.example.com/languages',
        expect.objectContaining({ signal: expect.anything() })
      );
    });

    it('should throw an UpstreamError when languages cannot be retrieved', async () => {
      reject = 'languages';

      const error = await ltClient.getLanguages().catch((e: unknown) => e);

      expect(error).toBeInstanceOf(UpstreamError);
      expect((error as Error).message).toBe(
        `Error retrieving languages from LibreTranslate: ${LANG_ERR}`
      );
    });
  });

  describe('translate method', () => {
    it('should translate and map the response', async () => {
      const translation = await ltClient.translate('es', 'en', 'hola');

      expect(translation).toStrictEqual({
        source: 'es',
        target: 'en',
        result: 'hello',
        original: 'hola',
        confidence: undefined,
        alternatives: ['buenos días'],
        translator: Transaltor.LIBRETRANSLATE
      });

      expect(globalThis.fetch).toHaveBeenCalledWith(
        'https://lt.example.com/translate',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ q: 'hola', source: 'es', target: 'en', api_key: 'secret-key' })
        })
      );
    });

    it('should use the detected language when source is auto', async () => {
      const translation = await ltClient.translate('auto', 'es', 'hello');

      expect(translation.source).toBe('en');
      expect(translation.confidence).toBe(0.98);
      expect(translation.result).toBe('hola');
      expect(translation.translator).toBe(Transaltor.LIBRETRANSLATE);
    });

    it('should omit the api key when none is configured', async () => {
      ltClient = new LibreTranslateClient('https://lt.example.com');

      await ltClient.translate('en', 'es', 'hello');

      const body = JSON.parse((globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0][1].body);

      expect(body).toStrictEqual({ q: 'hello', source: 'en', target: 'es' });
    });

    it('should throw an UpstreamError when translation fails', async () => {
      reject = 'translate';

      const error = await ltClient.translate('en', 'es', 'hello').catch((e: unknown) => e);

      expect(error).toBeInstanceOf(UpstreamError);
      expect((error as Error).message).toBe(
        `Error translating in LibreTranslate: ${TRANSLATE_ERR}`
      );
    });
  });
});
