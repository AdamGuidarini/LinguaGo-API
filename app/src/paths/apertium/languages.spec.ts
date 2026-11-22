import type { Server } from 'node:http';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { sendRequest, startTestServer, stopTestServer } from '../../test-utils.ts';

describe('GET /apertium/languages', () => {
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
