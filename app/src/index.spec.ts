import { once } from 'node:events';
import { createServer, type Server } from 'node:http';
import express from 'express';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

describe('server', () => {
  let server: Server;
  let baseUrl: string;
  const sendRequest = globalThis.fetch;

  const postTranslate = (body: unknown) => sendRequest(`${baseUrl}/apertium/translate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: typeof body === 'string' ? body : JSON.stringify(body)
  });

  beforeAll(async () => {
    vi.stubEnv('APY_URL', 'http://apertium.test');
    vi.stubEnv('LT_URL', 'http://libretranslate.test');
    vi.spyOn(express.application, 'listen').mockImplementation(function (this: express.Application) {
      server = createServer(this).listen(0, '127.0.0.1');
      return server;
    });

    await import('./index.ts');
    if (!server.listening) await once(server, 'listening');
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('Server did not bind to a TCP port');
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  afterAll(async () => {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => error ? reject(error) : resolve());
    });
    vi.unstubAllEnvs();
  });

  describe('POST /apertium/translate', () => {
    it('passes the request fields to Apertium and returns the translation', async () => {
      const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        new Response(JSON.stringify({ responseData: { translatedText: 'hola' } }))
      );
      const response = await postTranslate({ source: 'eng', target: 'spa', text: 'hello & goodbye + friend' });

      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({
        source: 'eng',
        target: 'spa',
        original: 'hello & goodbye + friend',
        result: 'hola',
        translator: 'apertium'
      });
      const upstreamUrl = new URL(String(fetchMock.mock.calls[0][0]));
      expect(upstreamUrl.pathname).toBe('/translate');
      expect(upstreamUrl.searchParams.get('langpair')).toBe('eng|spa');
      expect(upstreamUrl.searchParams.get('q')).toBe('hello & goodbye + friend');
    });

    it.each([
      {},
      { source: 'eng', target: 'spa' },
      { source: 'eng', target: 'spa', text: 123 },
      { source: ' ', target: 'spa', text: 'hello' }
    ])('rejects invalid request fields: %j', async (body) => {
      const fetchMock = vi.spyOn(globalThis, 'fetch');
      const response = await postTranslate(body);

      expect(response.status).toBe(400);
      expect(await response.json()).toEqual({ error: 'source, target, and text must be non-empty strings' });
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('returns 502 with a generic message when Apertium responds with an error', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('unavailable', { status: 503 }));
      const log = vi.spyOn(console, 'error').mockImplementation(() => undefined);
      const response = await postTranslate({ source: 'eng', target: 'spa', text: 'hello' });

      expect(response.status).toBe(502);
      const body = await response.json();
      expect(body).toEqual({ error: 'Apertium unavailable' });
      expect(JSON.stringify(body)).not.toContain('apertium.test');
      expect(log).toHaveBeenCalled();
    });

    it('returns 504 when Apertium times out', async () => {
      vi.spyOn(globalThis, 'fetch').mockRejectedValue(new DOMException('The operation timed out', 'TimeoutError'));
      const log = vi.spyOn(console, 'error').mockImplementation(() => undefined);
      const response = await postTranslate({ source: 'eng', target: 'spa', text: 'hello' });

      expect(response.status).toBe(504);
      expect(await response.json()).toEqual({ error: 'Apertium timed out' });
      expect(log).toHaveBeenCalled();
    });

    it('returns 400 for a malformed JSON body', async () => {
      const fetchMock = vi.spyOn(globalThis, 'fetch');
      const response = await postTranslate('{not json');

      expect(response.status).toBe(400);
      expect(await response.json()).toEqual({ error: 'Malformed JSON in request body' });
      expect(fetchMock).not.toHaveBeenCalled();
    });
  });

  describe('GET /apertium/languages', () => {
    it('returns 502 with a generic message when Apertium fails, without leaking internals', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('unavailable', { status: 503 }));
      const log = vi.spyOn(console, 'error').mockImplementation(() => undefined);
      const response = await sendRequest(`${baseUrl}/apertium/languages`);

      expect(response.status).toBe(502);
      const body = await response.json();
      expect(body).toEqual({ error: 'Apertium unavailable' });
      expect(JSON.stringify(body)).not.toContain('apertium.test');
      expect(log).toHaveBeenCalled();
    });
  });

  describe('unmatched routes', () => {
    it('returns a JSON 404', async () => {
      const response = await sendRequest(`${baseUrl}/does-not-exist`);

      expect(response.status).toBe(404);
      expect(await response.json()).toEqual({ error: 'Not found' });
    });
  });
});
