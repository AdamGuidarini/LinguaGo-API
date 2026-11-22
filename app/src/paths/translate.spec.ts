import type { Server } from 'node:http';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { postJson, startTestServer, stopTestServer } from '../test-utils.ts';

describe('POST /translate', () => {
  let server: Server;
  let baseUrl: string;

  const postUnified = (body: unknown) => postJson(baseUrl, '/translate', body);

  beforeAll(async () => {
    ({ server, baseUrl } = await startTestServer());
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  afterAll(async () => {
    await stopTestServer(server);
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
