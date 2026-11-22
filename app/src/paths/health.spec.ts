import type { Server } from 'node:http';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { sendRequest, startTestServer, stopTestServer } from '../test-utils.ts';

describe('GET /health', () => {
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

  it('returns ok', async () => {
    const response = await sendRequest(`${baseUrl}/health`);

    expect(response.status).toBe(200);
    expect(await response.text()).toBe('ok');
  });
});
