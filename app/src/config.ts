function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required environment variable: ${name}`);
  return v;
}

/**
 * Reads a positive-integer env var with a fallback. Throws on invalid
 * values instead of silently falling back, so a typo or a zero can't
 * quietly weaken a rate limit.
 */
function intEnv(name: string, fallback: number): number {
  const raw = process.env[name];

  if (raw === undefined || raw === '') {
    return fallback
  };

  const value = Number(raw);

  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`Environment variable ${name} must be a positive integer, got: ${JSON.stringify(raw)}`);
  }

  return value;
}

export const config = {
  port: Number(process.env.PORT) || 3000,
  apyUrl: requireEnv('APY_URL'),
  ltUrl: requireEnv('LT_URL'),
  ltKey: process.env.LT_KEY,
  generalLimitWindow: intEnv('GENERAL_LIMIT_WINDOW', 15 * 60 * 1000), // 15 minute default
  generalRateLimit: intEnv('GENERAL_RATE_LIMIT', 100), // 100 non-translation requests (health and getLanguages are cheap)
  translationLimitWindow: intEnv('TRANSLATION_LIMIT_WINDOW', 60 * 1000), // 1 minute default
  translationRateLimit: intEnv('TRANSLATION_RATE_LIMIT', 10) // 10 translation requests per minute per IP
} as const;