import type { Server } from 'node:http';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { postJson, startTestServer, stopTestServer } from '../../test-utils.ts';

describe('POST /apertium/translate', () => {
  let server: Server;
  let baseUrl: string;

  const postTranslate = (body: unknown) => postJson(baseUrl, '/apertium/translate', body);

  beforeAll(async () => {
    ({ server, baseUrl } = await startTestServer());
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  afterAll(async () => {
    await stopTestServer(server);
  });

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

  // Bodies that violate the OpenAPI schema are rejected by express-openapi's
  // request validator before the handler runs (message comes from the schema
  // validator, e.g. "must have required property 'source'").
  it.each([
    {},
    { source: 'eng', target: 'spa' },
    { source: 'eng', target: 'spa', text: 123 }
  ])('rejects schema-invalid request fields: %j', async (body) => {
    const fetchMock = vi.spyOn(globalThis, 'fetch');
    const response = await postTranslate(body);

    expect(response.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  // Blank strings pass the schema (minLength: 1) and are rejected by the
  // handler's own validation.
  it('rejects blank request fields', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch');
    const response = await postTranslate({ source: ' ', target: 'spa', text: 'hello' });

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
});
