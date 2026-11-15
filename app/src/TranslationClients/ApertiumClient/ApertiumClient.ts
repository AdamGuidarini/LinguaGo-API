import { ILanguage } from '../../interfaces/global-transation-interfaces.ts';
import { HttpClient } from '../HttpClient/HttpClient.ts';

export class ApertiumClient extends HttpClient{
  constructor(baseUrl: string) {
    super(baseUrl);
  }

  getLanguages(): Promise<ILanguage[]> {

  }
}
