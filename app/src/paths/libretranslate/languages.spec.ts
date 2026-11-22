import type { Server } from 'node:http';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { sendRequest, startTestServer, stopTestServer } from '../../test-utils.ts';

describe('GET /libretranslate/languages', () => {
  let server: Server;
  let baseUrl: string;

  beforeAll(async () => {
    ({ server, baseUrl } = await startTestServer());
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  afterAll(async () => {
    await stopTestServer(server);
  });

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
