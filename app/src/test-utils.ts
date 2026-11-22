import { once } from 'node:events';
import { createServer, type Server } from 'node:http';
import express from 'express';
import { vi } from 'vitest';

export interface TestServer {
  server: Server;
  baseUrl: string;
}

/**
 * Boots the real app (src/index.ts) on an ephemeral port with upstream URLs
 * pointed at fake hosts and rate limits effectively disabled. Each spec file
 * runs in its own isolated module registry, so every file gets a fresh server.
 */
export async function startTestServer(): Promise<TestServer> {
  vi.stubEnv('APY_URL', 'http://apertium.test');
  vi.stubEnv('LT_URL', 'http://libretranslate.test');
  vi.stubEnv('LT_KEY', 'test-key');
  // disable rate limiting in tests: the suite makes more translation
  // requests per minute than the production limit allows
  vi.stubEnv('GENERAL_RATE_LIMIT', '1000000');
  vi.stubEnv('TRANSLATION_RATE_LIMIT', '1000000');

  let server!: Server;
  vi.spyOn(express.application, 'listen').mockImplementation(function (this: express.Application) {
    server = createServer(this).listen(0, '127.0.0.1');
    return server;
  });

  await import('./index.ts');
  if (!server.listening) await once(server, 'listening');
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Server did not bind to a TCP port');
  return { server, baseUrl: `http://127.0.0.1:${address.port}` };
}

export async function stopTestServer(server: Server): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
  });
  vi.unstubAllEnvs();
}

// Captured at module load, before any test mocks globalThis.fetch — tests mock
// fetch to fake upstream responses, but must still reach the local test server.
export const sendRequest = globalThis.fetch;

/** POST a JSON body (or a raw string, for malformed-body tests) to the test server. */
export function postJson(baseUrl: string, path: string, body: unknown): Promise<Response> {
  return sendRequest(`${baseUrl}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: typeof body === 'string' ? body : JSON.stringify(body)
  });
}
