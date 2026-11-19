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

  const postLibreTranslate = (body: unknown) => sendRequest(`${baseUrl}/libretranslate/translate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: typeof body === 'string' ? body : JSON.stringify(body)
  });

  beforeAll(async () => {
    vi.stubEnv('APY_URL', 'http://apertium.test');
    vi.stubEnv('LT_URL', 'http://libretranslate.test');
    vi.stubEnv('LT_KEY', 'test-key');
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

    it('returns 500 for unexpected body-parser errors such as an oversized body', async () => {
      const fetchMock = vi.spyOn(globalThis, 'fetch');
      const log = vi.spyOn(console, 'error').mockImplementation(() => undefined);
      const response = await postTranslate(JSON.stringify({ source: 'eng', target: 'spa', text: 'x'.repeat(200_000) }));

      expect(response.status).toBe(500);
      expect(await response.json()).toEqual({ error: 'Internal server error' });
      expect(fetchMock).not.toHaveBeenCalled();
      expect(log).toHaveBeenCalled();
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

  describe('GET /', () => {
    it('returns the service name and status', async () => {
      const response = await sendRequest(`${baseUrl}/`);

      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ name: 'linguago-api', status: 'ok' });
    });
  });

  describe('GET /health', () => {
    it('returns ok', async () => {
      const response = await sendRequest(`${baseUrl}/health`);

      expect(response.status).toBe(200);
      expect(await response.text()).toBe('ok');
    });
  });

  describe('GET /apertium/languages', () => {
    it('returns the languages and pairs from Apertium', async () => {
      const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation((input: RequestInfo | URL) => {
        const url = String(input);

        if (url.includes('listPairs')) {
          return Promise.resolve(new Response(JSON.stringify({
            responseData: [
              { sourceLanguage: 'eng', targetLanguage: 'spa' },
              { sourceLanguage: 'spa', targetLanguage: 'eng' }
            ]
          })));
        }

        return Promise.resolve(new Response(JSON.stringify({ eng: 'English', spa: 'Spanish' })));
      });
      const response = await sendRequest(`${baseUrl}/apertium/languages`);

      expect(response.status).toBe(200);
      expect(await response.json()).toEqual([
        { code: 'eng', name: 'English', targets: ['spa'] },
        { code: 'spa', name: 'Spanish', targets: ['eng'] }
      ]);
      expect(String(fetchMock.mock.calls[0][0])).toContain('http://apertium.test/listPairs');
    });
  });

  describe('GET /libretranslate/languages', () => {
    it('returns the languages from LibreTranslate', async () => {
      const languages = [
        { code: 'en', name: 'English', targets: ['es'] },
        { code: 'es', name: 'Spanish', targets: ['en'] }
      ];
      const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        new Response(JSON.stringify(languages))
      );
      const response = await sendRequest(`${baseUrl}/libretranslate/languages`);

      expect(response.status).toBe(200);
      expect(await response.json()).toEqual(languages);
      expect(String(fetchMock.mock.calls[0][0])).toBe('http://libretranslate.test/languages');
    });

    it('returns 502 with a generic message when LibreTranslate responds with an error', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('unavailable', { status: 503 }));
      const log = vi.spyOn(console, 'error').mockImplementation(() => undefined);
      const response = await sendRequest(`${baseUrl}/libretranslate/languages`);

      expect(response.status).toBe(502);
      const body = await response.json();
      expect(body).toEqual({ error: 'LibreTranslate unavailable' });
      expect(JSON.stringify(body)).not.toContain('libretranslate.test');
      expect(log).toHaveBeenCalled();
    });

    it('returns 504 when LibreTranslate times out', async () => {
      vi.spyOn(globalThis, 'fetch').mockRejectedValue(new DOMException('The operation timed out', 'TimeoutError'));
      const log = vi.spyOn(console, 'error').mockImplementation(() => undefined);
      const response = await sendRequest(`${baseUrl}/libretranslate/languages`);

      expect(response.status).toBe(504);
      expect(await response.json()).toEqual({ error: 'LibreTranslate timed out' });
      expect(log).toHaveBeenCalled();
    });
  });

  describe('POST /libretranslate/translate', () => {
    it('passes the request fields and api key to LibreTranslate and returns the translation', async () => {
      const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        new Response(JSON.stringify({
          translatedText: 'hola',
          alternatives: ['buenas'],
          detectedLanguage: { confidence: 0.9, language: 'en' }
        }))
      );
      const response = await postLibreTranslate({ source: 'auto', target: 'es', text: 'hello' });

      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({
        source: 'en',
        target: 'es',
        original: 'hello',
        result: 'hola',
        confidence: 0.9,
        alternatives: ['buenas'],
        translator: 'libretranslate'
      });

      const [upstreamUrl, init] = fetchMock.mock.calls[0];
      expect(String(upstreamUrl)).toBe('http://libretranslate.test/translate');
      expect(init?.method).toBe('POST');
      expect(JSON.parse(String(init?.body))).toEqual({
        q: 'hello',
        source: 'auto',
        target: 'es',
        api_key: 'test-key'
      });
    });

    it.each([
      {},
      { source: 'en', target: 'es' },
      { source: 'en', target: 'es', text: 123 },
      { source: ' ', target: 'es', text: 'hello' }
    ])('rejects invalid request fields: %j', async (body) => {
      const fetchMock = vi.spyOn(globalThis, 'fetch');
      const response = await postLibreTranslate(body);

      expect(response.status).toBe(400);
      expect(await response.json()).toEqual({ error: 'source, target, and text must be non-empty strings' });
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('returns 502 with a generic message when LibreTranslate responds with an error', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('unavailable', { status: 503 }));
      const log = vi.spyOn(console, 'error').mockImplementation(() => undefined);
      const response = await postLibreTranslate({ source: 'en', target: 'es', text: 'hello' });

      expect(response.status).toBe(502);
      const body = await response.json();
      expect(body).toEqual({ error: 'LibreTranslate unavailable' });
      expect(JSON.stringify(body)).not.toContain('libretranslate.test');
      expect(log).toHaveBeenCalled();
    });

    it('returns 504 when LibreTranslate times out', async () => {
      vi.spyOn(globalThis, 'fetch').mockRejectedValue(new DOMException('The operation timed out', 'TimeoutError'));
      const log = vi.spyOn(console, 'error').mockImplementation(() => undefined);
      const response = await postLibreTranslate({ source: 'en', target: 'es', text: 'hello' });

      expect(response.status).toBe(504);
      expect(await response.json()).toEqual({ error: 'LibreTranslate timed out' });
      expect(log).toHaveBeenCalled();
    });
  });

  describe('GET /translators', () => {
    it('returns the list of available translators', async () => {
      const response = await sendRequest(`${baseUrl}/translators`);

      expect(response.status).toBe(200);
      expect(await response.json()).toEqual(['apertium', 'libretranslate']);
    });
  });

  describe('POST /translate', () => {
    const postUnified = (body: unknown) => sendRequest(`${baseUrl}/translate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });

    it('routes to Apertium when translator is "apertium"', async () => {
      const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        new Response(JSON.stringify({ responseData: { translatedText: 'hola' } }))
      );
      const response = await postUnified({ translator: 'apertium', source: 'eng', target: 'spa', text: 'hello' });

      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({
        source: 'eng',
        target: 'spa',
        original: 'hello',
        result: 'hola',
        translator: 'apertium'
      });
      expect(String(fetchMock.mock.calls[0][0])).toContain('http://apertium.test/translate');
    });

    it('routes to LibreTranslate when translator is "libretranslate"', async () => {
      const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        new Response(JSON.stringify({ translatedText: 'hola' }))
      );
      const response = await postUnified({ translator: 'libretranslate', source: 'en', target: 'es', text: 'hello' });

      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({
        source: 'en',
        target: 'es',
        original: 'hello',
        result: 'hola',
        confidence: undefined,
        alternatives: undefined,
        translator: 'libretranslate'
      });
      expect(String(fetchMock.mock.calls[0][0])).toBe('http://libretranslate.test/translate');
    });

    it.each([
      {},
      { source: 'en', target: 'es', text: 'hello' },
      { translator: 'deepl', source: 'en', target: 'es', text: 'hello' },
      { translator: 42, source: 'en', target: 'es', text: 'hello' },
      { translator: 'apertium', source: 'en', target: 'es' },
      { translator: 'apertium', source: ' ', target: 'es', text: 'hello' }
    ])('rejects invalid requests: %j', async (body) => {
      const fetchMock = vi.spyOn(globalThis, 'fetch');
      const response = await postUnified(body);

      expect(response.status).toBe(400);
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('returns 400 with a helpful message when translator is unknown', async () => {
      const response = await postUnified({ translator: 'deepl', source: 'en', target: 'es', text: 'hello' });

      expect(response.status).toBe(400);
      expect(await response.json()).toEqual({ error: 'translator must be one of: apertium, libretranslate' });
    });

    it('returns 502 when the chosen backend fails', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('unavailable', { status: 503 }));
      const log = vi.spyOn(console, 'error').mockImplementation(() => undefined);
      const response = await postUnified({ translator: 'libretranslate', source: 'en', target: 'es', text: 'hello' });

      expect(response.status).toBe(502);
      expect(await response.json()).toEqual({ error: 'LibreTranslate unavailable' });
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
