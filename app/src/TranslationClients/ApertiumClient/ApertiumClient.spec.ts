import { beforeEach, describe, expect, it, vi } from 'vitest';
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
  let reject = false;

  beforeEach(() => {
    apyClient = new ApertiumClient(
      'https://apy.com'
    );
  });

  describe('getLanguages method', () => {
    beforeEach(() => {
      const fetchCallBack = (input: RequestInfo | URL): Promise<Response> => {

        if ((input as string).includes('listPairs')) {
          if (reject) {
            throw new Error(LANG_CODE_ERR);
          }

          return Promise.resolve(new Response(JSON.stringify({ responseData: pairs })));
        } else if ((input as string).includes('listLanguageNames')) {
          if (reject) {
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

    it('should throw an error in language codes cannot be retrieved', async () => {
      reject = true;

      await expect(apyClient.getLanguages()).rejects.toThrow(
        new Error(`Error retrieving language codes from Apertium: ${LANG_CODE_ERR}`)
      );
    });
  });
});