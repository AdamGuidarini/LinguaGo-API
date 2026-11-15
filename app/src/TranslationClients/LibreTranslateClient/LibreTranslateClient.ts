import { ILanguage, ITranslation, ITranslator } from '../../interfaces/global-transation-interfaces.ts';
import { HttpClient } from '../HttpClient/HttpClient.ts';

export class LibreTranslateClient extends HttpClient implements ITranslator {
  async getLanguages(): Promise<ILanguage[]> {
    return Promise.resolve([]);
  }

  async translate(source: string, target: string, text: string): Promise<ITranslation> {
    return Promise.resolve({} as unknown as ITranslation);
  };
}
