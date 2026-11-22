import { UpstreamError } from '../../errors.ts';
import type { ILanguage, ITranslation, ITranslator } from '../../interfaces/global-transation-interfaces.ts';
import type { ILibreRequest, ILibreTranslation } from '../../interfaces/libre-translate-interfaces.ts';
import { Transaltor } from '../../interfaces/translator.ts';
import { HttpClient } from '../HttpClient/HttpClient.ts';

export class LibreTranslateClient extends HttpClient implements ITranslator {
  private readonly apiKey?: string;

  constructor(baseUrl: string, apiKey?: string) {
    super(baseUrl, undefined, 'LibreTranslate');
    this.apiKey = apiKey;
  }

  /**
   * Retrieves all of LibreTranslate's languages and their targets
   * @returns All LibreTranslate languages
   */
  async getLanguages(): Promise<ILanguage[]> {
    try {
      return await this.get<ILanguage[]>('/languages');
    } catch (error) {
      throw UpstreamError.wrap(error, 'Error retrieving languages from LibreTranslate');
    }
  }

  /**
   * Translates text from source language to target language
   * @param source Text's original language ('auto' to let LibreTranslate detect it)
   * @param target Text's target language
   * @param text Text to translate
   * @returns ITranslation for the provided arguments
   */
  async translate(source: string, target: string, text: string): Promise<ITranslation> {
    const body: ILibreRequest = {
      q: text,
      source,
      target,
      api_key: this.apiKey
    };

    let libreTranslation: ILibreTranslation;

    try {
      libreTranslation = await this.post<ILibreTranslation>('/translate', body);
    } catch (error) {
      throw UpstreamError.wrap(error, 'Error translating in LibreTranslate');
    }

    return {
      source: source === 'auto' && libreTranslation.detectedLanguage
        ? libreTranslation.detectedLanguage.language
        : source,
      target,
      result: libreTranslation.translatedText,
      original: text,
      confidence: libreTranslation.detectedLanguage?.confidence,
      alternatives: libreTranslation.alternatives,
      translator: Transaltor.LIBRETRANSLATE
    };
  };
}
