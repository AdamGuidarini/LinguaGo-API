import type { Server } from 'node:http';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { sendRequest, startTestServer, stopTestServer } from '../test-utils.ts';

describe('GET /', () => {
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

  it('returns the service name and status', async () => {
    const response = await sendRequest(`${baseUrl}/`);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ name: 'linguago-api', status: 'ok' });
  });
});
