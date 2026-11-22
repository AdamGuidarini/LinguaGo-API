import { HttpError } from './errors.ts';
import type { ITranslationBody } from './interfaces/translate-body.ts';

/**
 * Validates that a request body has non-empty string source, target, and
 * text fields. Throws HttpError(400) otherwise.
 */
export function parseTranslationBody(body: unknown): ITranslationBody {
  if (
    typeof body !== 'object' || body === null ||
    !('source' in body) || typeof body.source !== 'string' || !body.source.trim() ||
    !('target' in body) || typeof body.target !== 'string' || !body.target.trim() ||
    !('text' in body) || typeof body.text !== 'string' || !body.text.trim()
  ) {
    throw new HttpError(400, 'source, target, and text must be non-empty strings');
  }

  return body as unknown as ITranslationBody;
}
