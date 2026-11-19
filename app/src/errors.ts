/**
 * An error that should be returned to the client with a specific HTTP status
 * (e.g. request validation failures). The message is safe to expose.
 */
export class HttpError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'HttpError';
  }
}

export interface IUpstreamErrorOptions {
  service?: string;
  upstreamStatus?: number;
  timeout?: boolean;
  cause?: unknown;
}

/**
 * A failure while talking to an upstream translation service. The message may
 * contain internal details (URLs), so it should be logged server-side rather
 * than sent to the client.
 */
export class UpstreamError extends Error {
  readonly service: string;
  readonly upstreamStatus?: number;
  readonly timeout: boolean;

  constructor(message: string, options: IUpstreamErrorOptions = {}) {
    super(message, { cause: options.cause });
    this.name = 'UpstreamError';
    this.service = options.service ?? 'Upstream';
    this.upstreamStatus = options.upstreamStatus;
    this.timeout = options.timeout ?? false;
  }

  /**
   * Adds context (e.g. which operation failed) while preserving the
   * UpstreamError type and its metadata.
   */
  static wrap(error: unknown, context: string): UpstreamError {
    const detail = error instanceof Error ? error.message : String(error);

    if (error instanceof UpstreamError) {
      return new UpstreamError(`${context}: ${detail}`, {
        service: error.service,
        upstreamStatus: error.upstreamStatus,
        timeout: error.timeout,
        cause: error
      });
    }

    return new UpstreamError(`${context}: ${detail}`, { cause: error });
  }
}
