import {
  IApertiumLanguageCode,
  IApertiumLanguageNames,
  IApertiumResponse,
  IApertiumTranslationRepsonse
} from '../../interfaces/apertium-interfaces.ts';
import { ILanguage, ITranslation, ITranslator } from '../../interfaces/global-transation-interfaces.ts';
import { Transaltor } from '../../interfaces/translator.ts';
import { HttpClient } from '../HttpClient/HttpClient.ts';

export class ApertiumClient extends HttpClient implements ITranslator {
  /**
   * Retrieves all of Apertium's languages and pairs
   * @param locale Language locale, what language should the language names be in
   * @returns All Apertium languages and codes
   */
  async getLanguages(locale = 'en'): Promise<ILanguage[]> {
    let listPairs: IApertiumLanguageCode[];
    const codes = new Set<string>();

    try {
      listPairs = (await this.get<IApertiumResponse<IApertiumLanguageCode[]>>('/listPairs')).responseData;
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);

      throw new Error(
        `Error retrieving language codes from Apertium: ${detail}`,
        { cause: error }
      );
    }

    listPairs.forEach((p) => codes.add(p.sourceLanguage));

    let langNames: IApertiumLanguageNames;

    try {
      langNames = await this.get<IApertiumLanguageNames>(
        `/listLanguageNames?locale=${locale}${codes.size > 0 ? '&languages=' : ''}${Array.from(codes.values()).join('+')}`
      );
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);

      throw new Error(`Error retrieving language names from Apertium: ${detail}`,
        { cause: error }
      );
    }

    return Array.from(codes).map(
      (code) => ({
        code,
        name: langNames[code],
        targets: Object.entries(listPairs)
          .filter((entry) => entry[1].targetLanguage === code)
          .map((entry) => entry[1].sourceLanguage)
      })
    );
  }

  /**
   * Translates text from source language to target language
   * @param source Text's original language
   * @param target Text's target language
   * @param text Text to translate
   * @returns ITranslation for the provided arguments
   */
  async translate(source: string, target: string, text: string): Promise<ITranslation> {
    let apyTranslation: IApertiumResponse<IApertiumTranslationRepsonse>;

    try {
      apyTranslation = await this.get<IApertiumResponse<IApertiumTranslationRepsonse>>(
        '/translate',
        { langpair: `${source}|${target}`, q: text }
      );
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);

      throw new Error(`Error translating in Apertium: ${detail}`,
        { cause: error }
      );
    }

    return {
      source,
      target,
      result: apyTranslation.responseData.translatedText,
      original: text,
      translator: Transaltor.APERTIUM
    };
  };
}
