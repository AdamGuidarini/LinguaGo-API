import { Transaltor } from './translator.ts';

export interface ILanguage {
    code: string;
    name: string;
    targets?: string[];
}

export interface ITranslation {
    source: string;
    target: string;
    result: string;
    original: string;
    confidence?: number;
    alternatives?: string[];
    key?: string;
    timestamp?: string;
    translator: Transaltor
}
