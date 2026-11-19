import { UpstreamError } from '../../errors.ts';

export class HttpClient {
  constructor(
    protected readonly baseUrl: string,
    private readonly timeoutMs = 10_000,
    private readonly service = 'Upstream',
  ) { }

  protected async get<T>(path: string, params?: Record<string, string>): Promise<T> {
    const query = params ? `?${new URLSearchParams(params)}` : '';

    return this.request<T>(`${path}${query}`);
  }

  protected async post<T>(path: string, body: unknown, timeoutMs?: number): Promise<T> {
    return this.request<T>(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }, timeoutMs);
  }

  private async request<T>(path: string, init: RequestInit = {}, timeoutMs = this.timeoutMs): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    let r: Response;

    try {
      r = await fetch(url, { ...init, signal: AbortSignal.timeout(timeoutMs) });
    } catch (error) {
      if (error instanceof Error && (error.name === 'TimeoutError' || error.name === 'AbortError')) {
        throw new UpstreamError(`Request to ${url} timed out after ${timeoutMs}ms`, {
          service: this.service,
          timeout: true,
          cause: error
        });
      }

      throw new UpstreamError(error instanceof Error ? error.message : String(error), {
        service: this.service,
        cause: error
      });
    }

    if (!r.ok) {
      throw new UpstreamError(`${init.method ?? 'GET'} ${url} responded ${r.status}`, {
        service: this.service,
        upstreamStatus: r.status
      });
    };

    try {
      return (await r.json()) as T;
    } catch (error) {
      throw new UpstreamError(`Invalid JSON in response from ${url}`, {
        service: this.service,
        cause: error
      });
    }
  }
}
