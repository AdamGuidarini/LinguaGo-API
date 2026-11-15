// src/clients/http-client.spec.ts
import { describe, it, expect, vi } from 'vitest';
import { HttpClient } from './HttpClient.ts';

class TestClient extends HttpClient {
  doGet<T>(path: string, params?: Record<string, string>) {
    return this.get<T>(path, params);
  }
  doPost<T>(path: string, body: unknown, timeoutMs?: number) {
    return this.post<T>(path, body, timeoutMs);
  }
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('HttpClient', () => {
  const baseUrl = 'http://engine.test';

  it('GET builds the URL with encoded query params and parses JSON', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ ok: true }));
    vi.stubGlobal('fetch', fetchMock);

    const client = new TestClient(baseUrl);
    const result = await client.doGet<{ ok: boolean }>('/translate', {
      langpair: 'eng|spa',
      q: 'hello world',
    });

    expect(result).toEqual({ ok: true });
    const [url] = fetchMock.mock.calls[0];
    expect(url).toBe(`${baseUrl}/translate?langpair=eng%7Cspa&q=hello+world`);
  });

  it('GET without params has no query string', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse([]));
    vi.stubGlobal('fetch', fetchMock);

    await new TestClient(baseUrl).doGet('/languages');

    expect(fetchMock.mock.calls[0][0]).toBe(`${baseUrl}/languages`);
  });

  it('POST sends a JSON body with the right headers', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ translatedText: 'hola' }));
    vi.stubGlobal('fetch', fetchMock);

    const body = { q: 'hello', source: 'en', target: 'es' };
    const result = await new TestClient(baseUrl).doPost('/translate', body);

    expect(result).toEqual({ translatedText: 'hola' });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(`${baseUrl}/translate`);
    expect(init.method).toBe('POST');
    expect(init.headers).toEqual({ 'Content-Type': 'application/json' });
    expect(JSON.parse(init.body)).toEqual(body);
  });

  it('throws on a non-2xx response, including method and URL', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({}, 500)));

    await expect(new TestClient(baseUrl).doGet('/boom')).rejects.toThrow(
      `GET ${baseUrl}/boom responded 500`,
    );
  });

  it('passes an abort signal so requests can time out', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({}));
    vi.stubGlobal('fetch', fetchMock);

    await new TestClient(baseUrl, 1234).doGet('/x');

    expect(fetchMock.mock.calls[0][1].signal).toBeInstanceOf(AbortSignal);
  });

  it('propagates network errors', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('fetch failed')));

    await expect(new TestClient(baseUrl).doGet('/x')).rejects.toThrow('fetch failed');
  });
});