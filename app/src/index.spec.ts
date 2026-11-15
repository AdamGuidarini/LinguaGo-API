import { once } from 'node:events';
import { createServer, type Server } from 'node:http';
import express from 'express';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

describe('POST /apertium/translate', () => {
  let server: Server;
  let url: string;
  const sendRequest = globalThis.fetch;

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
    url = `http://127.0.0.1:${address.port}/apertium/translate`;
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

  it('passes the request fields to Apertium and returns the translation', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ responseData: { translatedText: 'hola' } }))
    );
    const response = await sendRequest(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ source: 'eng', target: 'spa', text: 'hello & goodbye + friend' })
    });

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
    const response = await sendRequest(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: 'source, target, and text must be non-empty strings' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('returns an upstream error when Apertium fails', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('unavailable', { status: 503 }));
    const log = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const response = await sendRequest(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ source: 'eng', target: 'spa', text: 'hello' })
    });

    expect(response.status).toBe(502);
    expect(await response.json()).toEqual({ error: 'Apertium translation unavailable' });
    expect(log).toHaveBeenCalled();
  });
});
