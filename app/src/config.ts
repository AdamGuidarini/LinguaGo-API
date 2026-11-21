function requireEnv(name: string): string {
  const v = process.env[name];
  
  if (!v) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  
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
    return fallback;
  };

  const value = Number(raw);

  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`Environment variable ${name} must be a positive integer, got: ${JSON.stringify(raw)}`);
  }

  return value;
}

/**
 * Reads a comma-separated env var into a trimmed, non-empty list.
 * `CORS_ALLOWED_ORIGINS=https://a.com, https://b.com` -> ['https://a.com', 'https://b.com']
 */
function listEnv(name: string): string[] {
  const raw = process.env[name];
  
  if (!raw) {
    return [];
  }

  return raw.split(',').map((s) => s.trim()).filter((s) => s.length > 0);
}

/**
 * Reads a boolean env var with a fallback. Only 'true'/'1' count as true;
 * anything else is false, so a typo can't silently enable a permissive policy.
 */
function boolEnv(name: string, fallback: boolean): boolean {
  const raw = process.env[name];

  if (raw === undefined || raw === '') {
    return fallback;
  }
  
  return raw === 'true' || raw === '1';
}

const corsAllowedHeadersEnv = listEnv('CORS_ALLOWED_HEADERS');

export const config = {
  port: Number(process.env.PORT) || 3000,
  apyUrl: requireEnv('APY_URL'),
  ltUrl: requireEnv('LT_URL'),
  ltKey: process.env.LT_KEY,
  // Single web origin, kept for backwards compatibility; CORS_ALLOWED_ORIGINS is the general form.
  corsDomain: process.env.CORS_DOMAIN,
  // Extra exact origins to allow, comma-separated. Use '*' to allow any origin (dev only!).
  corsAllowedOrigins: listEnv('CORS_ALLOWED_ORIGINS'),
  // Allow browser-extension origins (moz-extension://<uuid>, chrome-extension://<id>).
  // The extension UUID is random per install, so these can only be allowed by scheme.
  corsAllowExtensionOrigins: boolEnv('CORS_ALLOW_EXTENSION_ORIGINS', true),
  corsAllowedHeaders: corsAllowedHeadersEnv.length > 0 ? corsAllowedHeadersEnv : ['Content-Type'],
  generalLimitWindow: intEnv('GENERAL_LIMIT_WINDOW', 15 * 60 * 1000), // 15 minute default
  generalRateLimit: intEnv('GENERAL_RATE_LIMIT', 100), // 100 non-translation requests (health and getLanguages are cheap)
  translationLimitWindow: intEnv('TRANSLATION_LIMIT_WINDOW', 60 * 1000), // 1 minute default
  translationRateLimit: intEnv('TRANSLATION_RATE_LIMIT', 10) // 10 translation requests per minute per IP
} as const;