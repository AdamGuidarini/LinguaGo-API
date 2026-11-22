import type { Server } from 'node:http';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { postJson, sendRequest, startTestServer, stopTestServer } from './test-utils.ts';

// App-level behavior that spans routes: 404 handling and body-parser errors.
// Per-endpoint tests live next to their route files under paths/.
describe('server', () => {
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

  describe('API docs', () => {
    it('serves the OpenAPI document as JSON at /api-docs', async () => {
      const response = await sendRequest(`${baseUrl}/api-docs`);

      expect(response.status).toBe(200);
      expect(response.headers.get('content-type')).toContain('application/json');
      const doc = await response.json();
      expect(doc.openapi).toBe('3.0.3');
      expect(Object.keys(doc.paths).sort()).toEqual([
        '/',
        '/apertium/languages',
        '/apertium/translate',
        '/health',
        '/libretranslate/languages',
        '/libretranslate/translate',
        '/translate',
        '/translators'
      ]);
    });

    it('serves Swagger UI at /docs', async () => {
      const response = await sendRequest(`${baseUrl}/docs`);

      expect(response.status).toBe(200);
      expect(response.headers.get('content-type')).toContain('text/html');
      expect(await response.text()).toContain('swagger-ui');
    });
  });

  describe('unmatched routes', () => {
    it('returns a JSON 404', async () => {
      const response = await sendRequest(`${baseUrl}/does-not-exist`);

      expect(response.status).toBe(404);
      expect(await response.json()).toEqual({ error: 'Not found' });
    });
  });

  describe('body parsing', () => {
    it('returns 400 for a malformed JSON body', async () => {
      const fetchMock = vi.spyOn(globalThis, 'fetch');
      const response = await postJson(baseUrl, '/apertium/translate', '{not json');

      expect(response.status).toBe(400);
      expect(await response.json()).toEqual({ error: 'Malformed JSON in request body' });
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('returns 500 for unexpected body-parser errors such as an oversized body', async () => {
      const fetchMock = vi.spyOn(globalThis, 'fetch');
      const log = vi.spyOn(console, 'error').mockImplementation(() => undefined);
      const response = await postJson(baseUrl, '/apertium/translate', { source: 'eng', target: 'spa', text: 'x'.repeat(200_000) });

      expect(response.status).toBe(500);
      expect(await response.json()).toEqual({ error: 'Internal server error' });
      expect(fetchMock).not.toHaveBeenCalled();
      expect(log).toHaveBeenCalled();
    });
  });
});
