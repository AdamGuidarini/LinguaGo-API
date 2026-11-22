import type { Server } from 'node:http';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { postJson, startTestServer, stopTestServer } from '../../test-utils.ts';

describe('POST /libretranslate/translate', () => {
  let server: Server;
  let baseUrl: string;

  const postTranslate = (body: unknown) => postJson(baseUrl, '/libretranslate/translate', body);

  beforeAll(async () => {
    ({ server, baseUrl } = await startTestServer());
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  afterAll(async () => {
    await stopTestServer(server);
  });

  it('passes the request fields and api key to LibreTranslate and returns the translation', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({
        translatedText: 'hola',
        alternatives: ['buenas'],
        detectedLanguage: { confidence: 0.9, language: 'en' }
      }))
    );
    const response = await postTranslate({ source: 'auto', target: 'es', text: 'hello' });

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

  // Bodies that violate the OpenAPI schema are rejected by express-openapi's
  // request validator before the handler runs (message comes from the schema
  // validator, e.g. "must have required property 'source'").
  it.each([
    {},
    { source: 'en', target: 'es' },
    { source: 'en', target: 'es', text: 123 }
  ])('rejects schema-invalid request fields: %j', async (body) => {
    const fetchMock = vi.spyOn(globalThis, 'fetch');
    const response = await postTranslate(body);

    expect(response.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  // Blank strings pass the schema and are rejected by the handler's own validation.
  it('rejects blank request fields', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch');
    const response = await postTranslate({ source: ' ', target: 'es', text: 'hello' });

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: 'source, target, and text must be non-empty strings' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('returns 502 with a generic message when LibreTranslate responds with an error', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('unavailable', { status: 503 }));
    const log = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const response = await postTranslate({ source: 'en', target: 'es', text: 'hello' });

    expect(response.status).toBe(502);
    const body = await response.json();
    expect(body).toEqual({ error: 'LibreTranslate unavailable' });
    expect(JSON.stringify(body)).not.toContain('libretranslate.test');
    expect(log).toHaveBeenCalled();
  });

  it('returns 504 when LibreTranslate times out', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new DOMException('The operation timed out', 'TimeoutError'));
    const log = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const response = await postTranslate({ source: 'en', target: 'es', text: 'hello' });

    expect(response.status).toBe(504);
    expect(await response.json()).toEqual({ error: 'LibreTranslate timed out' });
    expect(log).toHaveBeenCalled();
  });
});
