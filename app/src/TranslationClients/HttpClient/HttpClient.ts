
export class HttpClient {
  constructor(
    protected readonly baseUrl: string,
    private readonly timeoutMs = 10_000,
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
    const r = await fetch(url, { ...init, signal: AbortSignal.timeout(timeoutMs) });

    if (!r.ok) { 
      throw new Error(`${init.method ?? 'GET'} ${url} responded ${r.status}`);
    };

    return (await r.json()) as T;
  }
}
