import type { Server } from 'node:http';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { sendRequest, startTestServer, stopTestServer } from '../test-utils.ts';

describe('GET /translators', () => {
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

  it('returns the list of available translators', async () => {
    const response = await sendRequest(`${baseUrl}/translators`);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(['apertium', 'libretranslate']);
  });
});
