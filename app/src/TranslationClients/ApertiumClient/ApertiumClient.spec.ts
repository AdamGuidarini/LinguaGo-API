import { beforeEach, describe, expect, it, vi } from 'vitest';
import { UpstreamError } from '../../errors.ts';
import { ApertiumClient } from './ApertiumClient.ts';

const pairs = [
  { sourceLanguage: 'it', targetLanguage: 'spa' },
  { sourceLanguage: 'eng', targetLanguage: 'spa' },
  { sourceLanguage: 'spa', targetLanguage: 'eng' },
  { sourceLanguage: 'spa', targetLanguage: 'it' }
];

const langNames = { 'eng': 'English', 'it': 'Italian', 'spa': 'Spanish' };

const LANG_CODE_ERR = 'lang code err';
const LANG_NAME_ERR = 'lang name err';

describe('ApertiumClient', () => {
  let apyClient: ApertiumClient;
  let reject: string;

  beforeEach(() => {
    apyClient = new ApertiumClient(
      'https://apy.com'
    );
  });

  describe('getLanguages method', () => {
    beforeEach(() => {
      const fetchCallBack = (input: RequestInfo | URL): Promise<Response> => {

        if ((input as string).includes('listPairs')) {
          if (reject && reject.includes('listPairs')) {
            throw new Error(LANG_CODE_ERR);
          }

          return Promise.resolve(new Response(JSON.stringify({ responseData: pairs })));
        } else if ((input as string).includes('listLanguageNames')) {
          if (reject && reject.includes('listLanguageNames')) {
            throw new Error(LANG_NAME_ERR);
          }

          return Promise.resolve(new Response(JSON.stringify({ responseData: langNames })));
        }

        return Promise.reject('No know path given');
      };

      globalThis.fetch = vi.fn(fetchCallBack);
    });

    it('should retrieve languages', async () => {
      const langs = await apyClient.getLanguages();

      expect(langs).toStrictEqual(
        [
          {
            code: 'it',
            name: undefined,
            targets: ['spa']
          },
          {
            code: 'eng',
            name: undefined,
            targets: ['spa']
          },
          {
            code: 'spa',
            name: undefined,
            targets: [
              'it',
              'eng'
            ]
          }
        ]
      );
    });

    it('should throw an UpstreamError in language codes cannot be retrieved', async () => {
      reject = 'listPairs';

      const error = await apyClient.getLanguages().catch((e: unknown) => e);

      expect(error).toBeInstanceOf(UpstreamError);
      expect((error as Error).message).toBe(
        `Error retrieving language codes from Apertium: ${LANG_CODE_ERR}`
      );
    });

    it('should throw an UpstreamError in language names cannot be retrieved', async () => {
      reject = 'listLanguageNames';

      const error = await apyClient.getLanguages().catch((e: unknown) => e);

      expect(error).toBeInstanceOf(UpstreamError);
      expect((error as Error).message).toBe(
        `Error retrieving language names from Apertium: ${LANG_NAME_ERR}`
      );
    });
  });
});