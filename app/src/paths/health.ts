import type { Request, Response } from 'express';

/**
 * API Health check
 */
export default function health() {
  return {
    GET: (req: Request, res: Response) => {
      res.type('text/plain').send('ok');
    }
  };
}
