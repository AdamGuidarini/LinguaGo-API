import type { Request, Response } from 'express';

/**
 * Root endpoint
 */
export default function () {
  return {
    GET: (req: Request, res: Response) => {
      res.json({ name: 'linguago-api', status: 'ok' });
    }
  }
}
