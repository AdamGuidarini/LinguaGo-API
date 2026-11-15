import { IApertiumLanguageCode, IApertiumLanguageNames, IApertiumResponse } from '../../interfaces/apertium-interfaces.ts';
import { ILanguage } from '../../interfaces/global-transation-interfaces.ts';
import { HttpClient } from '../HttpClient/HttpClient.ts';

export class ApertiumClient extends HttpClient {
  constructor(baseUrl: string) {
    super(baseUrl);
  }

  async getLanguages(locale: string = 'en'): Promise<ILanguage[]> {
    const listPairs = (await this.get<IApertiumResponse<IApertiumLanguageCode[]>>('/listpairs')).responseData;
    const codes = new Set<string>();

    listPairs.forEach((p) => codes.add(p.sourceLanguage));

    const langNames = await this.get<IApertiumLanguageNames>(
      `${this.baseUrl}/listLanguageNames?locale=${locale}${codes.size > 0 ? '&languages=' : ''}${Array.from(codes.values()).join('+')}`
    );

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
}
