import type { Request, Response } from 'express';
import { Transaltor } from '../interfaces/translator.ts';

/**
 * Route file for GET /translators — the operation documented at
 * apiDoc.paths['/translators'] (operationId: listTranslators).
 *
 * express-openapi loads every file in src/paths/ (compiled to dist/paths/)
 * and expects a default export returning an object keyed by HTTP method.
 * To move another endpoint here: create src/paths/<name>.ts, add the
 * matching entry to apiDoc.paths, and delete the inline route in index.ts.
 */
export default function translators() {
  return {
    GET: (_req: Request, res: Response<Transaltor[]>) => {
      res.json(Object.values(Transaltor));
    },
  };
}
